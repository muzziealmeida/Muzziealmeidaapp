-- Initial schema for a NEW, dedicated Supabase project.
-- Reviewed source; not yet applied to a remote project.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_staff() returns boolean language sql stable security invoker
set search_path = '' as $$
  select coalesce((select auth.jwt())->'app_metadata'->>'office_role' in ('admin','team'), false)
    and (select auth.uid()) is not null;
$$;
revoke all on function private.is_staff() from public;
grant execute on function private.is_staff() to authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '', email text not null default '', created_at timestamptz not null default now()
);
create function private.handle_user() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  insert into public.profiles (id,full_name,email)
  values (new.id,coalesce(new.raw_user_meta_data->>'full_name','Cliente'),coalesce(new.email,''));
  return new;
end;
$$;
revoke all on function private.handle_user() from public, anon, authenticated;
create trigger on_user_created after insert on auth.users for each row execute function private.handle_user();
insert into public.profiles (id,full_name,email) select id,coalesce(raw_user_meta_data->>'full_name','Cliente'),coalesce(email,'') from auth.users on conflict do nothing;

create table public.cases (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references public.profiles(id),
 title text not null check(length(trim(title))>0), number text not null default '',
 status text not null default 'Em andamento' check(status in ('Em andamento','Aguardando decisão','Em recurso','Encerrado')),
 description text not null default '', next_step text not null default '', created_at timestamptz not null default now()
);
create table public.events (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references public.profiles(id),
 title text not null check(length(trim(title))>0), starts_at timestamptz not null,
 kind text not null default 'Audiência' check(kind in ('Audiência','Prazo','Reunião','Próximo passo')),
 status text not null default 'Agendado' check(status in ('Agendado','Concluído','Cancelado')),
 location text not null default '', description text not null default '', created_at timestamptz not null default now()
);
create table public.payments (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references public.profiles(id),
 title text not null check(length(trim(title))>0), amount numeric(14,2) not null check(amount >= 0), due_date date not null,
 method text not null default 'Boleto' check(method in ('Boleto','Pix','Transferência','Cartão','Dinheiro','Outro')),
 status text not null default 'Pendente' check(status in ('Pendente','Pago','Cancelado')),
 paid_at date, notes text not null default '', created_at timestamptz not null default now(),
 constraint paid_date_consistent check ((status='Pago' and paid_at is not null) or (status<>'Pago' and paid_at is null))
);
create table public.documents (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references public.profiles(id),
 title text not null check(length(trim(title))>0),
 kind text not null default 'Documento' check(kind in ('Contrato','Boleto','Decisão','Sentença','Comprovante','Documento')),
 description text not null default '', storage_path text not null,
 created_at timestamptz not null default now(), constraint correct_folder check(split_part(storage_path,'/',1)=client_id::text)
);
create table public.articles (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title))>0),
 category text not null default 'Artigo', summary text not null default '', body text not null default '',
 pdf_url text not null default '' check(pdf_url='' or pdf_url ~ '^https?://'),
 published boolean not null default false, created_at timestamptz not null default now()
);
create table public.site_settings (id integer primary key check(id=1), value jsonb not null default '{}'::jsonb);
insert into public.site_settings(id,value) values (1,'{}');

alter table public.profiles enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=(select auth.uid()) or (select private.is_staff()));
-- Profiles created only by the Auth trigger. Clients cannot change authorization.
revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;

do $$ declare t text; begin
 foreach t in array array['cases','events','payments','documents'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create index %I on public.%I(client_id)',t||'_client_idx',t);
  execute format('create policy client_read on public.%I for select to authenticated using(client_id=(select auth.uid()) or (select private.is_staff()))',t);
  execute format('create policy staff_insert on public.%I for insert to authenticated with check((select private.is_staff()))',t);
  execute format('create policy staff_update on public.%I for update to authenticated using((select private.is_staff())) with check((select private.is_staff()))',t);
  execute format('create policy staff_delete on public.%I for delete to authenticated using((select private.is_staff()))',t);
 end loop;
end $$;
create index events_date_idx on public.events(starts_at);
create index payments_due_idx on public.payments(due_date);
create index articles_published_idx on public.articles(published,created_at desc);

alter table public.articles enable row level security;
revoke all on public.articles from anon,authenticated;
grant select on public.articles to anon;
grant select,insert,update,delete on public.articles to authenticated;
create policy public_articles on public.articles for select to anon,authenticated using(published);
create policy staff_articles_read on public.articles for select to authenticated using((select private.is_staff()));
create policy staff_articles_insert on public.articles for insert to authenticated with check((select private.is_staff()));
create policy staff_articles_update on public.articles for update to authenticated using((select private.is_staff())) with check((select private.is_staff()));
create policy staff_articles_delete on public.articles for delete to authenticated using((select private.is_staff()));

alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon,authenticated;
grant select on public.site_settings to anon;
grant select,insert,update on public.site_settings to authenticated;
create policy public_settings on public.site_settings for select to anon,authenticated using(true);
create policy staff_settings_insert on public.site_settings for insert to authenticated with check((select private.is_staff()));
create policy staff_settings_update on public.site_settings for update to authenticated using((select private.is_staff())) with check((select private.is_staff()));

-- Private documents: never expose a public bucket or permanent public URL.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('client-documents','client-documents',false,20971520,array['application/pdf','image/png','image/jpeg']);
create policy document_read on storage.objects for select to authenticated
using(bucket_id='client-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_staff())));
create policy document_insert on storage.objects for insert to authenticated
with check(bucket_id='client-documents' and (select private.is_staff()));
create policy document_update on storage.objects for update to authenticated
using(bucket_id='client-documents' and (select private.is_staff()))
with check(bucket_id='client-documents' and (select private.is_staff()));
create policy document_delete on storage.objects for delete to authenticated
using(bucket_id='client-documents' and (select private.is_staff()));
commit;

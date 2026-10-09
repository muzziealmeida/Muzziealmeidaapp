-- Apply AFTER bootstrap.sql to the same dedicated project.
begin;
create table public.user_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check(username ~ '^[a-z0-9][a-z0-9._-]{2,39}$'),
 role text not null check(role in ('client','team','admin')),
 must_change_password boolean not null default true,
 credentials_valid_after timestamptz not null default clock_timestamp(),
 created_at timestamptz not null default now()
);
alter table public.user_access enable row level security;
revoke all on public.user_access from anon,authenticated;
grant select on public.user_access to authenticated;
grant all on public.user_access to service_role;

-- Private and narrowly scoped SECURITY DEFINER is necessary to read Auth session
-- timestamps without granting clients access to auth.sessions. No caller-supplied IDs.
create function private.session_is_current() returns boolean language sql stable security definer
set search_path='' as $$
 select (select auth.uid()) is not null and exists (
  select 1 from public.user_access a join auth.sessions s on s.user_id=a.user_id
  where a.user_id=(select auth.uid()) and s.id::text=(select auth.jwt())->>'session_id'
  and s.created_at >= a.credentials_valid_after
 );
$$;
revoke all on function private.session_is_current() from public;
grant execute on function private.session_is_current() to authenticated;

create function private.access_ready() returns boolean language sql stable security definer
set search_path='' as $$
 select (select private.session_is_current()) and exists (
  select 1 from public.user_access where user_id=(select auth.uid()) and not must_change_password
 );
$$;
revoke all on function private.access_ready() from public;
grant execute on function private.access_ready() to authenticated;

create or replace function private.is_staff() returns boolean language sql stable security definer
set search_path='' as $$
 select (select private.access_ready()) and exists (
  select 1 from public.user_access where user_id=(select auth.uid()) and role in ('admin','team')
 );
$$;
create policy access_read on public.user_access for select to authenticated
using(user_id=(select auth.uid()) or (select private.is_staff()));

create function public.access_session_is_current() returns boolean language sql stable security invoker
set search_path='' as $$ select private.session_is_current(); $$;
revoke all on function public.access_session_is_current() from public;
grant execute on function public.access_session_is_current() to authenticated;

create function public.mark_access_password_changed(account_id uuid) returns void language sql security invoker
set search_path='' as $$
 update public.user_access set must_change_password=false,credentials_valid_after=clock_timestamp() where user_id=account_id;
$$;
create function public.require_new_access_password(account_id uuid) returns void language sql security invoker
set search_path='' as $$
 update public.user_access set must_change_password=true,credentials_valid_after=clock_timestamp() where user_id=account_id;
$$;
revoke all on function public.mark_access_password_changed(uuid),public.require_new_access_password(uuid) from public,anon,authenticated;
grant execute on function public.mark_access_password_changed(uuid),public.require_new_access_password(uuid) to service_role;

do $$ declare t text; begin
 foreach t in array array['cases','events','payments','documents'] loop
  execute format('alter policy client_read on public.%I to authenticated using((select private.access_ready()) and (client_id=(select auth.uid()) or (select private.is_staff())))',t);
 end loop;
end $$;
alter policy document_read on storage.objects to authenticated
using(bucket_id='client-documents' and (select private.access_ready()) and ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_staff())));
commit;

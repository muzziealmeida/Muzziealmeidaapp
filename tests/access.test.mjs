import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const alice='11111111-1111-4111-8111-111111111111';
const bob='22222222-2222-4222-8222-222222222222';
const staff='33333333-3333-4333-8333-333333333333';
const tables=['cases','events','payments','documents'];
async function setup(){
 const pg=new PGlite();
 await pg.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz not null default clock_timestamp());
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 grant usage on schema auth to anon,authenticated;
 grant execute on all functions in schema auth to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated;
 grant select,insert,update,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
 `);
 await pg.exec(await readFile(new URL('../supabase/bootstrap.sql',import.meta.url),'utf8'));
 await pg.exec(await readFile(new URL('../supabase/access-control.sql',import.meta.url),'utf8'));
 for(const [index,id] of [alice,bob,staff].entries()) {
  await pg.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{"full_name":"Test User"}')`,[id,id+'@test.invalid']);
  await pg.query(`insert into user_access(user_id,username,role,must_change_password,credentials_valid_after) values($1,$2,$3,false,'2020-01-01')`,[id,'user'+index,id===staff?'team':'client']);
  await pg.query(`insert into auth.sessions(id,user_id) values($1,$1)`,[id]);
 }
 for(const id of [alice,bob]){
  await pg.query(`insert into cases(client_id,title) values($1,'Processo')`,[id]);
  await pg.query(`insert into events(client_id,title,starts_at) values($1,'Audiência','2027-01-10T12:00:00Z')`,[id]);
  await pg.query(`insert into payments(client_id,title,amount,due_date) values($1,'Honorários',100,'2027-01-10')`,[id]);
  await pg.query(`insert into documents(client_id,title,storage_path) values($1,'Contrato',$2)`,[id,id+'/contract.pdf']);
  await pg.query(`insert into storage.objects(bucket_id,name) values('client-documents',$1)`,[id+'/contract.pdf']);
 }
 await pg.exec(`insert into articles(title,published) values('Público',true),('Rascunho',false)`);
 return pg;
}
async function as(pg,id,role='client',metadata={}){
 await pg.exec('reset role');
 await pg.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)`,[id||'',JSON.stringify({sub:id,session_id:id,app_metadata:{office_role:role},user_metadata:metadata})]);
 await pg.exec('set role '+(id?'authenticated':'anon'));
}
test('clients see only their own resources and cannot write or change ownership',async()=>{
 const pg=await setup();
 try{await as(pg,alice);
  for(const table of tables){
   const {rows}=await pg.query(`select * from ${table}`);assert.equal(rows.length,1,table);assert.equal(rows[0].client_id,alice);
   await pg.query(`update ${table} set title='Tampered'`);
   assert.equal((await pg.query(`select title from ${table}`)).rows[0].title,rows[0].title);
   await pg.query(`delete from ${table}`);assert.equal((await pg.query(`select count(*)::int as n from ${table}`)).rows[0].n,1);
  }
  await assert.rejects(pg.query(`insert into cases(client_id,title) values($1,'Unauthorized')`,[alice]),/row-level security/);
  await assert.rejects(pg.query(`update profiles set email='changed@test.invalid'`),/permission denied/);
  assert.equal((await pg.query('select * from profiles')).rows.length,1);
 }finally{await pg.close()}
});
test('forging user_metadata cannot grant staff privileges',async()=>{
 const pg=await setup();try{await as(pg,alice,'client',{office_role:'admin'});assert.equal((await pg.query('select * from cases')).rows.length,1);await assert.rejects(pg.query(`insert into cases(client_id,title) values($1,'Unauthorized')`,[bob]),/row-level security/)}finally{await pg.close()}
});
test('team can create, edit, and delete records across clients',async()=>{
 const pg=await setup();try{await as(pg,staff,'team');assert.equal((await pg.query('select * from profiles')).rows.length,3);
 for(const table of tables){assert.equal((await pg.query(`select * from ${table}`)).rows.length,2);await pg.exec(`update ${table} set title='Updated'`);assert.equal((await pg.query(`select title from ${table} limit 1`)).rows[0].title,'Updated')}
 const {rows}=await pg.query(`insert into cases(client_id,title) values($1,'New') returning id`,[bob]);await pg.query('delete from cases where id=$1',[rows[0].id]);assert.equal((await pg.query('select * from cases')).rows.length,2);
 assert.equal((await pg.query('select * from articles')).rows.length,2);
 await pg.exec(`update site_settings set value='{"phone":"123"}'`);
 }finally{await pg.close()}
});
test('anonymous visitors see published content only and no private records',async()=>{
 const pg=await setup();try{await as(pg,null);assert.equal((await pg.query('select * from articles')).rows.length,1);assert.equal((await pg.query('select * from site_settings')).rows.length,1);for(const table of [...tables,'profiles'])await assert.rejects(pg.query('select * from '+table),/permission denied/);await assert.rejects(pg.exec(`insert into articles(title) values('Spam')`),/permission denied/)}finally{await pg.close()}
});
test('storage enforces client folders and prevents client uploads',async()=>{
 const pg=await setup();try{await as(pg,alice);const {rows}=await pg.query('select * from storage.objects');assert.equal(rows.length,1);assert.equal(rows[0].name,alice+'/contract.pdf');await assert.rejects(pg.query(`insert into storage.objects(bucket_id,name) values('client-documents',$1)`,[alice+'/new.pdf']),/row-level security/);await as(pg,staff,'admin');assert.equal((await pg.query('select * from storage.objects')).rows.length,2);await pg.query(`insert into storage.objects(bucket_id,name) values('client-documents',$1)`,[bob+'/new.pdf']);assert.equal((await pg.query('select * from storage.objects')).rows.length,3)}finally{await pg.close()}
});
test('document ownership and payment constraints reject inconsistent data',async()=>{
 const pg=await setup();try{await as(pg,staff,'admin');await assert.rejects(pg.query(`insert into documents(client_id,title,storage_path) values($1,'Wrong folder',$2)`,[alice,bob+'/bad.pdf']),/correct_folder/);await assert.rejects(pg.query(`insert into payments(client_id,title,amount,due_date,status) values($1,'Paid',100,'2027-01-10','Pago')`,[alice]),/paid_date_consistent/);await assert.rejects(pg.query(`insert into payments(client_id,title,amount,due_date) values($1,'Negative',-1,'2027-01-10')`,[alice]),/check constraint/)}finally{await pg.close()}
});

test('first access blocks client data, staff writes, and private files until password is changed',async()=>{
 const pg=await setup();try{
  await pg.query('update user_access set must_change_password=true where user_id in ($1,$2)',[alice,staff]);
  await as(pg,alice);
  assert.equal((await pg.query('select * from user_access')).rows.length,1);
  for(const table of tables)assert.equal((await pg.query('select * from '+table)).rows.length,0);
  assert.equal((await pg.query('select * from storage.objects')).rows.length,0);
  await assert.rejects(pg.exec('update user_access set must_change_password=false'),/permission denied/);
  await assert.rejects(pg.query('select mark_access_password_changed($1)',[alice]),/permission denied/);
  await as(pg,staff,'admin');
  await assert.rejects(pg.query("insert into cases(client_id,title) values($1,'Bypass')",[alice]),/row-level security/);
 }finally{await pg.close()}
});
test('a password change rejects old sessions; a new session restores access',async()=>{
 const pg=await setup();try{
  await pg.query('select mark_access_password_changed($1)',[alice]);
  await as(pg,alice);
  assert.equal((await pg.query('select access_session_is_current() as valid')).rows[0].valid,false);
  assert.equal((await pg.query('select * from cases')).rows.length,0);
  await pg.exec('reset role');
  const session='44444444-4444-4444-8444-444444444444';
  await pg.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,alice]);
  await as(pg,alice);
  await pg.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:alice,session_id:session,app_metadata:{office_role:'client'}})]);
  assert.equal((await pg.query('select access_session_is_current() as valid')).rows[0].valid,true);
  assert.equal((await pg.query('select * from cases')).rows.length,1);
 }finally{await pg.close()}
});
test('access role cannot be changed by the client and is not derived from a forged JWT',async()=>{
 const pg=await setup();try{
  await as(pg,alice,'admin');
  assert.equal((await pg.query('select * from cases')).rows.length,1);
  await assert.rejects(pg.query("insert into cases(client_id,title) values($1,'Forged')",[bob]),/row-level security/);
  await assert.rejects(pg.exec("update user_access set role='admin'"),/permission denied/);
 }finally{await pg.close()}
});

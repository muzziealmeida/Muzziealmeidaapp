import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUsername,loginEmail,newPassword} from '../shared/access-utils.js';
import handler from '../api/access.js';

test('username accepts @ prefix and case, rejects invalid names',()=>{
 assert.equal(normalizeUsername(' @RafaelMuzzi '),'rafaelmuzzi');
 assert.equal(loginEmail('@RafaelMuzzi'),'rafaelmuzzi@access.muzziealmeida.app');
 for(const s of ['a','name with spaces','@@username','name@example.com','../admin'])assert.throws(()=>normalizeUsername(s));
});
test('password change refuses the configured provisional password and invalid lengths',()=>{
 assert.throws(()=>newPassword('Temporary123','Temporary123'));
 assert.throws(()=>newPassword('short','Temporary123'));
 assert.throws(()=>newPassword('x'.repeat(129),'Temporary123'));
 assert.equal(newPassword('MyPersonalPassword456','Temporary123'),'MyPersonalPassword456');
});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this}}}
test('account API rejects requests without a session and foreign origins',async()=>{
 const unauth=response();await handler({method:'POST',headers:{host:'muzziealmeidaapp.vercel.app'},body:{action:'create'}},unauth);assert.equal(unauth.code,401);
 const foreign=response();await handler({method:'POST',headers:{host:'muzziealmeidaapp.vercel.app',origin:'https://example.invalid'},body:{}},foreign);assert.equal(foreign.code,403);
 const wrongMethod=response();await handler({method:'GET',headers:{}},wrongMethod);assert.equal(wrongMethod.code,405);
});

test('Vercel proxy forwards the user token, overrides provisional credentials and preserves authorization failures',async()=>{
 const before={url:process.env.SUPABASE_ACCESS_FUNCTION_URL,password:process.env.INITIAL_ACCESS_PASSWORD,key:process.env.VITE_SUPABASE_PUBLISHABLE_KEY,fetch:globalThis.fetch};
 process.env.SUPABASE_ACCESS_FUNCTION_URL='https://example.supabase.co/functions/v1/office-access';
 process.env.INITIAL_ACCESS_PASSWORD='ConfiguredTemporary123';
 process.env.VITE_SUPABASE_PUBLISHABLE_KEY='public-test-key';
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,process.env.SUPABASE_ACCESS_FUNCTION_URL);
  assert.equal(options.headers.Authorization,'Bearer test-user-token');
  assert.equal(options.headers.apikey,'public-test-key');
  assert.equal(JSON.parse(options.body).provisional_password,'ConfiguredTemporary123');
  return {status:403,json:async()=>({error:'Altere a senha provisória antes de continuar.'})};
 };
 try{
  const res=response();
  await handler({method:'POST',headers:{host:'muzziealmeidaapp.vercel.app',authorization:'Bearer test-user-token'},body:{action:'create',provisional_password:'caller-supplied'}},res);
  assert.equal(res.code,403);assert.match(res.body.error,/Altere/);assert.equal(res.headers['Cache-Control'],'no-store');
 }finally{
  for(const [name,value] of [['SUPABASE_ACCESS_FUNCTION_URL',before.url],['INITIAL_ACCESS_PASSWORD',before.password],['VITE_SUPABASE_PUBLISHABLE_KEY',before.key]])if(value===undefined)delete process.env[name];else process.env[name]=value;
  globalThis.fetch=before.fetch;
 }
});

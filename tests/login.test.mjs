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

import { createClient } from '@supabase/supabase-js';
import {normalizeUsername,loginEmail} from '../shared/access-utils.js';
export {newPassword} from '../shared/access-utils.js';
export function services(token,env=process.env) {
 const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL;
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 const publicKey=env.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key||!publicKey||!env.INITIAL_ACCESS_PASSWORD)throw new Error('O acesso ainda está em configuração.');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 return {admin:createClient(url,key,options),caller:createClient(url,publicKey,{...options,global:{headers:{Authorization:`Bearer ${token}`}}})};
}
export async function createAccess(admin,{username,full_name,role},env=process.env){
 username=normalizeUsername(username);
 if(!['client','team','admin'].includes(role))throw new Error('Perfil de acesso inválido.');
 if(!String(full_name||'').trim())throw new Error('Informe o nome completo.');
 const password=env.INITIAL_ACCESS_PASSWORD;
 if(!password)throw new Error('A senha provisória ainda não foi configurada no servidor.');
 const {data,error}=await admin.auth.admin.createUser({email:loginEmail(username),password,email_confirm:true,user_metadata:{full_name:String(full_name).trim()},app_metadata:{office_role:role}});
 if(error)throw new Error('Não foi possível criar este usuário. Confira se o nome de usuário já está em uso.');
 const {error:accountError}=await admin.from('user_access').insert({user_id:data.user.id,username,role,must_change_password:true});
 if(accountError){await admin.auth.admin.deleteUser(data.user.id);throw new Error('Não foi possível registrar o acesso. Confira a configuração do banco.');}
 return {username,role,user_id:data.user.id};
}

import {createClient} from '@supabase/supabase-js';
import {createAccess} from '../server/accounts.js';
const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key||!process.env.INITIAL_ACCESS_PASSWORD)throw new Error('Configure as variáveis de servidor antes de executar.');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const account=await createAccess(admin,{username:'rafaelmuzzi',full_name:'Rafael Muzzi',role:'admin'});
console.log('Acesso criado: @'+account.username+'. Troca de senha obrigatória no primeiro acesso.');

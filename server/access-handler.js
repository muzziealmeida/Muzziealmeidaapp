import {services,createAccess,newPassword} from './accounts.js';

export const config={api:{bodyParser:{sizeLimit:'16kb'}}};
export default async function handler(req,res,env=process.env){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido.'})}
 const origin=req.headers.origin;
 const expected=env.APP_URL||`https://${req.headers.host}`;
 if(origin&&origin!==expected&&origin!==`https://${req.headers.host}`)return res.status(403).json({error:'Origem não autorizada.'});
 const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
 if(!token)return res.status(401).json({error:'Entre novamente para continuar.'});
 let service;
 try{service=services(token,env)}catch{return res.status(503).json({error:'O acesso ainda está em configuração.'})}
 const {admin,caller}=service;
 try{
  const {data:identity,error:identityError}=await admin.auth.getUser(token);
  if(identityError||!identity.user)return res.status(401).json({error:'Sua sessão expirou. Entre novamente.'});
  const uid=identity.user.id;
  const {data:current,error:sessionError}=await caller.rpc('access_session_is_current');
  if(sessionError||!current)return res.status(401).json({error:'Esta sessão não está mais válida. Entre novamente.'});
  const {data:account,error:accountError}=await admin.from('user_access').select('*').eq('user_id',uid).single();
  if(accountError||!account)return res.status(403).json({error:'Acesso não cadastrado pelo escritório.'});
  const {action,...payload}=req.body||{};
  if(action==='password'){
   const password=newPassword(payload.password,env.INITIAL_ACCESS_PASSWORD);
   const {error}=await admin.auth.admin.updateUserById(uid,{password});
   if(error)throw new Error('Não foi possível atualizar a senha. Tente novamente.');
   const {error:gateError}=await admin.rpc('mark_access_password_changed',{account_id:uid});
   if(gateError)throw new Error('A senha foi alterada, mas o acesso ainda precisa ser liberado. Contate o escritório.');
   // RLS rejects ALL sessions created before the password change, including this one.
   return res.status(200).json({success:true,require_login:true});
  }
  if(account.must_change_password)return res.status(403).json({error:'Altere a senha provisória antes de continuar.'});
  if(!['team','admin'].includes(account.role))return res.status(403).json({error:'Somente advogados podem gerenciar acessos.'});
  if(action==='create')return res.status(201).json({success:true,account:await createAccess(admin,payload,env)});
  if(action==='reset'){
   if(payload.user_id===uid)throw new Error('Use a opção de alteração de senha para o seu próprio acesso.');
   const {data:target,error:targetError}=await admin.from('user_access').select('user_id').eq('user_id',payload.user_id).single();
   if(targetError||!target)throw new Error('Usuário não encontrado.');
   if(!env.INITIAL_ACCESS_PASSWORD)throw new Error('Senha provisória não configurada.');
   // Block existing sessions before resetting credentials. A failure stays closed.
   const {error:resetError}=await admin.rpc('require_new_access_password',{account_id:target.user_id});
   if(resetError)throw new Error('Não foi possível bloquear as sessões anteriores.');
   const {error}=await admin.auth.admin.updateUserById(target.user_id,{password:env.INITIAL_ACCESS_PASSWORD});
   if(error)throw new Error('Não foi possível redefinir a senha.');
   return res.status(200).json({success:true});
  }
  return res.status(400).json({error:'Ação inválida.'});
 }catch(error){return res.status(400).json({error:error.message||'Não foi possível concluir a solicitação.'})}
}

import localHandler from '../server/access-handler.js';
export const config={api:{bodyParser:{sizeLimit:'16kb'}}};
export default async function handler(req,res){
 if(!process.env.SUPABASE_ACCESS_FUNCTION_URL)return localHandler(req,res);
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido.'})}
 const origin=req.headers.origin;
 const expected=process.env.APP_URL||`https://${req.headers.host}`;
 if(origin&&origin!==expected&&origin!==`https://${req.headers.host}`)return res.status(403).json({error:'Origem não autorizada.'});
 if(!req.headers.authorization?.match(/^Bearer (.+)$/))return res.status(401).json({error:'Entre novamente para continuar.'});
 try{
  const upstream=await fetch(process.env.SUPABASE_ACCESS_FUNCTION_URL,{
   method:'POST',headers:{'Content-Type':'application/json','Authorization':req.headers.authorization,apikey:process.env.VITE_SUPABASE_PUBLISHABLE_KEY},
   body:JSON.stringify({...req.body,provisional_password:process.env.INITIAL_ACCESS_PASSWORD}),signal:AbortSignal.timeout(20000)
  });
  const result=await upstream.json();
  return res.status(upstream.status).json(result);
 }catch{return res.status(503).json({error:'Não foi possível concluir a solicitação. Tente novamente.'})}
}

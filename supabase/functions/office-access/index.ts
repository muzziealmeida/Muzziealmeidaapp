import handler from '../../../server/access-handler.js';
const expectedPasswordHash='c97bd563e1b2adbdafa7ffbc1c767f7d244ea0bea0e2db0dde06fad4b01cb80f';
const digest=async(value)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
Deno.serve(async(req)=>{
 if(req.method!=='POST')return Response.json({error:'Método não permitido.'},{status:405});
 const text=await req.text();
 if(text.length>16384)return Response.json({error:'Solicitação muito grande.'},{status:413});
 let body;try{body=JSON.parse(text)}catch{return Response.json({error:'Solicitação inválida.'},{status:400})}
 if(typeof body.provisional_password!=='string'||await digest(body.provisional_password)!==expectedPasswordHash)return Response.json({error:'Configuração do acesso inválida.'},{status:403});
 const env={
  SUPABASE_URL:Deno.env.get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY:JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  VITE_SUPABASE_PUBLISHABLE_KEY:JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY'),
  INITIAL_ACCESS_PASSWORD:body.provisional_password,
  APP_URL:'https://muzziealmeidaapp.vercel.app'
 };
 delete body.provisional_password;
 const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
 let status=200,result;
 const res={setHeader(k,v){headers[k]=v},status(code){status=code;return this},json(value){result=value;return this}};
 await handler({method:req.method,headers:{authorization:req.headers.get('Authorization')},body},res,env);
 return new Response(JSON.stringify(result),{status,headers});
});

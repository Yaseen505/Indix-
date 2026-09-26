import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {state} from '@/lib/server/state';
import {action} from '@/lib/server/actions';
import {upload,download,report} from '@/lib/server/files';
import {Store,actor,AppError} from '@/lib/server/store';
import {ZodError} from 'zod';
export const dynamic='force-dynamic';
async function handle(req:Request){try{
 const store=env as unknown as Store;if(!store.DB||!store.BUCKET)return Response.json({error:'STORAGE_UNAVAILABLE'},{status:503});
 const identity=await getChatGPTUser();if(!identity)return Response.json({error:'SIGN_IN'},{status:401});
 const parts=new URL(req.url).pathname.split('/').filter(Boolean).slice(2);
 if(req.method==='GET'){
  if(parts[0]==='state')return json(await state(store,identity));
  const p=await actor(store,identity);
  if(parts[0]==='file'&&parts[1])return await download(store,p,parts[1],req);
  if(['receipt','handover'].includes(parts[0])&&parts[1])return await report(store,p,parts[0],parts[1]);
 }else{
  const origin=req.headers.get('origin');if(!origin||![new URL(req.url).origin,'https://indix-buildview-buyer.yasensuiss.chatgpt.site'].includes(origin))return Response.json({error:'ORIGIN_REJECTED'},{status:403});
  if(parts[0]==='upload')return json(await upload(store,await actor(store,identity),req));
  if(parts[0]==='action'){if(Number(req.headers.get('content-length')||0)>32768)return json({error:'INVALID_INPUT'},413);const body=await req.text();if(body.length>32768)return json({error:'INVALID_INPUT'},413);return json(await action(store,identity,JSON.parse(body)));}
 }
 return json({error:'NOT_FOUND'},404);
}catch(e){if(e instanceof AppError)return json({error:e.code},e.status);if(e instanceof ZodError||e instanceof SyntaxError)return json({error:'INVALID_INPUT'},400);console.error('BuildView operation failed',e instanceof Error?e.message:'unknown');return json({error:'SAVE_FAILED'},503)}}
function json(v:any,status=200){return Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}})}
export const GET=handle;export const POST=handle;

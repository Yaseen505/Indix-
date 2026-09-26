import {Store,Person,unit,project,admin,one,all,stmt,uid,now,log,fail} from './store';
export async function upload(env:Store,p:Person,req:Request){
const length=Number(req.headers.get('content-length')||0);if(length>22*1024*1024)fail(413,'FILE_TOO_LARGE');
const data=await req.formData(),file=data.get('file');if(!(file instanceof File)||!file.size||file.size>20*1024*1024)fail(400,'FILE_TOO_LARGE');
const kind=String(data.get('kind')||''),target=String(data.get('targetId')||''),unitId=String(data.get('unitId')||''),projectId=String(data.get('projectId')||'');
const mime=file.type,allowed=['application/pdf','image/jpeg','image/png','image/webp','video/mp4','video/webm'];if(!allowed.includes(mime))fail(400,'FILE_TYPE');
let u:string|null=null,proj:string|null=null;
if(kind==='document'){admin(p);await unit(env,p,unitId);u=unitId;}
else if(kind==='update'){admin(p);const row=await one(env,'SELECT * FROM updates WHERE id=?',target);if(!row)fail(404,'NOT_FOUND');await project(env,p,row.project_id);if(row.unit_id)await unit(env,p,row.unit_id);u=row.unit_id;proj=row.project_id;}
else if(['request','payment','snag'].includes(kind)){
 const table=kind==='request'?'requests':kind==='payment'?'payments':'snags';const row=await one(env,`SELECT * FROM ${table} WHERE id=?`,target);if(!row)fail(404,'NOT_FOUND');await unit(env,p,row.unit_id);if(kind==='payment'&&row.status!=='pending')fail(409,'ALREADY_REVIEWED');u=row.unit_id;
}else fail(400,'INVALID_INPUT');
const label=String(data.get('label')||file.name).trim().slice(0,200),name=file.name.replace(/[\x00-\x1f\\/]/g,'_').slice(0,200)||'attachment';
const prefix=new Uint8Array(await file.slice(0,16).arrayBuffer());const str=String.fromCharCode(...prefix);
const valid=mime==='application/pdf'?str.startsWith('%PDF-'):mime==='image/jpeg'?prefix[0]===255&&prefix[1]===216:mime==='image/png'?prefix[0]===137&&str.slice(1,4)==='PNG':mime==='image/webp'?str.startsWith('RIFF')&&str.slice(8,12)==='WEBP':mime==='video/mp4'?str.slice(4,8)==='ftyp':prefix[0]===26&&prefix[1]===69&&prefix[2]===223&&prefix[3]===163;
if(!valid)fail(400,'FILE_TYPE');
const id=uid(),key=`${p.company_id}/${id}`;await env.BUCKET.put(key,file.stream(),{httpMetadata:{contentType:mime}});
try{await env.DB.batch([stmt(env,'INSERT INTO files(id,company_id,unit_id,project_id,kind,target_id,name,label,mime,size,object_key,author_id,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',id,p.company_id,u,proj,kind,target||null,name,label,mime,file.size,key,p.id,now()),log(env,p,'file.upload',id,u)]);}catch(e){await env.BUCKET.delete(key);throw e;}return {id};
}
export async function download(env:Store,p:Person,id:string,req:Request){
const f=await one(env,'SELECT * FROM files WHERE id=? AND company_id=?',id,p.company_id);if(!f)fail(404,'NOT_FOUND');if(f.unit_id)await unit(env,p,f.unit_id);else await project(env,p,f.project_id);
const obj=await env.BUCKET.get(f.object_key,{range:req.headers});if(!obj)fail(404,'NOT_FOUND');const download=new URL(req.url).searchParams.has('download');const headers=new Headers({'Content-Type':f.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`${download?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,'Content-Security-Policy':"default-src 'none'; sandbox",'Accept-Ranges':'bytes'});
let status=200;if(obj.range&&'offset'in obj.range&&obj.range.offset!==undefined&&'length'in obj.range&&obj.range.length!==undefined){status=206;headers.set('Content-Range',`bytes ${obj.range.offset}-${obj.range.offset+obj.range.length-1}/${obj.size}`);headers.set('Content-Length',String(obj.range.length));}else headers.set('Content-Length',String(obj.size));return new Response(obj.body,{status,headers});
}
const escape=(s:any)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function report(env:Store,p:Person,kind:string,id:string){
let title='',rows:any[]=[];
if(kind==='receipt'){const pay=await one(env,"SELECT * FROM payments WHERE id=? AND status='approved'",id);if(!pay)fail(404,'NOT_FOUND');const u=await unit(env,p,pay.unit_id);const buyer=u.buyer_id?await one(env,'SELECT name FROM people WHERE id=?',u.buyer_id):null;title='Payment acknowledgement / إيصال دفعة معتمدة';rows=[['Reference / المرجع','BV-'+pay.id.slice(0,8).toUpperCase()],['Buyer / المشتري',buyer?.name||'—'],['Unit / الوحدة',u.code],['Amount / المبلغ',new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED'}).format(pay.amount/100)],['Payment reference / مرجع الدفع',pay.reference],['Approved / تاريخ الاعتماد',pay.reviewed_at],['Review note / ملاحظة الاعتماد',pay.review_note]];}
else{const u=await unit(env,p,id),h=await one(env,'SELECT * FROM handovers WHERE unit_id=?',u.id);if(!h?.signed_at)fail(404,'NOT_FOUND');title='Handover record / محضر التسليم';rows=[['Unit / الوحدة',u.code],['Keys received / المفاتيح',h.keys?'Yes / نعم':'No / لا'],['Meters checked / العدادات',h.meters?'Yes / نعم':'No / لا'],['Documents received / المستندات',h.documents?'Yes / نعم':'No / لا'],['Notes / الملاحظات',h.notes],['Buyer acknowledgement / إقرار المشتري',h.signed_name],['Recorded at / وقت الإقرار',h.signed_at]];}
const company=await one(env,'SELECT name FROM companies WHERE id=?',p.company_id);
return new Response(`<!doctype html><html lang="ar"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)}</title><style>body{font:16px Arial,sans-serif;color:#24272c;max-width:800px;padding:40px;margin:auto}h1{font-size:26px}table{border-collapse:collapse;width:100%}td{padding:15px;border-bottom:1px solid #ddd;white-space:pre-wrap;overflow-wrap:anywhere}td:first-child{width:45%;color:#666}footer{margin-top:35px;font-size:14px;color:#666}@media print{body{padding:10px}}</style><h3>INDIX BuildView</h3><p>${escape(company?.name)}</p><h1>${escape(title)}</h1><table>${rows.map(([a,b])=>`<tr><td>${escape(a)}</td><td>${escape(b)}</td></tr>`).join('')}</table><footer>Save as PDF or print from your browser. / احفظ نسخة PDF أو اطبع من المتصفح.<br>This record reflects the developer’s recorded approval. / يعكس هذا السجل الاعتماد المسجّل لدى المطوّر.</footer></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox",'X-Content-Type-Options':'nosniff'}});
}

import {z} from 'zod';
import {Store,Identity,Person,actor,admin,unit,project,stmt,one,all,uid,now,log,fail,sha,token} from './store';
const str=z.string().trim().min(1).max(200), detail=z.string().trim().min(1).max(5000), id=z.string().uuid();
const cents=z.number().int().positive().max(1e12), percent=z.number().int().min(0).max(100);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v)),'Invalid date');
const opt=z.string().trim().max(200).default('');
export async function action(env:Store,identity:Identity|null,input:any){
if(!identity)fail(401,'SIGN_IN');const type=z.string().parse(input.action);
if(type==='setup'){
 const v=z.object({name:str}).parse(input); const exists=await one(env,'SELECT id FROM companies LIMIT 1');if(exists)fail(409,'ALREADY_SETUP');
 const company='buildview';const person=uid(),time=now();
 await env.DB.batch([stmt(env,'INSERT OR IGNORE INTO companies(id,name,owner_subject,created) VALUES(?,?,?,?)',company,v.name,identity!.userId,time),stmt(env,"INSERT OR IGNORE INTO people(id,company_id,subject,name,email,phone,role,active,created) SELECT ?,id,?,?,?,?, 'developer',1,? FROM companies WHERE id=? AND owner_subject=?",person,identity!.userId,identity!.displayName,identity!.email,'',time,company,identity!.userId)]);
 return {ok:true};
}
if(type==='claim'){
 const v=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).parse(input);if(await one(env,'SELECT id FROM people WHERE subject=?',identity!.userId))fail(409,'ALREADY_LINKED');
 const result=await stmt(env,'UPDATE people SET subject=?,invite_hash=NULL,invite_expires=NULL WHERE invite_hash=? AND invite_expires>? AND active=1 AND subject IS NULL',identity!.userId,await sha(v.token),now()).run();if(!result.meta.changes)fail(400,'INVITE_INVALID');return {ok:true};
}
const p=await actor(env,identity),time=now(),newId=uid();
if(type==='project.create'){
 admin(p);const v=z.object({name:str,location:str,handover:opt}).parse(input);await env.DB.batch([stmt(env,'INSERT INTO projects(id,company_id,name,location,handover,created) VALUES(?,?,?,?,?,?)',newId,p.company_id,v.name,v.location,v.handover,time),log(env,p,type,newId)]);return {id:newId};
}
if(type==='unit.create'){
 admin(p);const v=z.object({projectId:id,code:str,floor:str,bedrooms:z.number().int().min(0).max(30),area:z.number().int().positive().max(1e7),parking:opt,dewa:opt,price:cents}).parse(input);await project(env,p,v.projectId);await env.DB.batch([stmt(env,'INSERT INTO units(id,company_id,project_id,code,floor,bedrooms,area,parking,dewa,price,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)',newId,p.company_id,v.projectId,v.code,v.floor,v.bedrooms,v.area,v.parking,v.dewa,v.price,time),log(env,p,type,newId,newId)]);return {id:newId};
}
if(type==='buyer.create'){
 admin(p);const v=z.object({name:str,email:z.string().email().max(200),phone:opt}).parse(input);const secret=token();await env.DB.batch([stmt(env,"INSERT INTO people(id,company_id,name,email,phone,role,invite_hash,invite_expires,created) VALUES(?,?,?,?,?,'buyer',?,?,?)",newId,p.company_id,v.name,v.email,v.phone,await sha(secret),new Date(Date.now()+7*864e5).toISOString(),time),log(env,p,type,newId)]);return {id:newId,inviteToken:secret};
}
if(type==='buyer.invite'||type==='buyer.active'){
 admin(p);const v=z.object({id,active:z.boolean().optional()}).parse(input);const buyer=await one(env,"SELECT * FROM people WHERE id=? AND company_id=? AND role='buyer'",v.id,p.company_id);if(!buyer)fail(404,'NOT_FOUND');if(type==='buyer.invite'){if(buyer.subject)fail(409,'ALREADY_LINKED');const secret=token();await stmt(env,'UPDATE people SET invite_hash=?,invite_expires=? WHERE id=?',await sha(secret),new Date(Date.now()+7*864e5).toISOString(),v.id).run();return {inviteToken:secret};}await env.DB.batch([stmt(env,'UPDATE people SET active=? WHERE id=?',v.active?1:0,v.id),log(env,p,type,v.id)]);return {ok:true};
}
if(type==='unit.assign'){
 admin(p);const v=z.object({unitId:id,buyerId:id}).parse(input);const u=await unit(env,p,v.unitId);if(u.buyer_id&&u.buyer_id!==v.buyerId)fail(409,'UNIT_ALREADY_ASSIGNED');if(!await one(env,"SELECT id FROM people WHERE id=? AND company_id=? AND role='buyer' AND active=1",v.buyerId,p.company_id))fail(400,'INVALID_BUYER');await env.DB.batch([stmt(env,'UPDATE units SET buyer_id=? WHERE id=?',v.buyerId,u.id),log(env,p,type,u.id,u.id)]);return {ok:true};
}
if(type==='installment.create'){
 admin(p);const v=z.object({unitId:id,label:str,amount:cents,due:date}).parse(input);const u=await unit(env,p,v.unitId);const results=await env.DB.batch([stmt(env,'INSERT INTO installments(id,unit_id,label,amount,due,created) SELECT ?,?,?,?,?,? WHERE (SELECT COALESCE(SUM(amount),0) FROM installments WHERE unit_id=?) + ? <= ?',newId,u.id,v.label,v.amount,v.due,time,u.id,v.amount,u.price),log(env,p,type,newId,u.id)]);if(!results[0].meta.changes)fail(409,'PLAN_EXCEEDS_PRICE');return {id:newId};
}
if(type==='payment.create'){
 const v=z.object({unitId:id,installmentId:id,amount:cents,reference:str}).parse(input);const u=await unit(env,p,v.unitId);const bill=await one(env,'SELECT * FROM installments WHERE id=? AND unit_id=?',v.installmentId,u.id);if(!bill)fail(404,'NOT_FOUND');const result=await stmt(env,"INSERT INTO payments(id,unit_id,installment_id,author_id,amount,reference,status,created) SELECT ?,?,?,?,?,?,'pending',? WHERE (SELECT COALESCE(SUM(amount),0) FROM payments WHERE installment_id=? AND status IN ('pending','approved'))+?<=?",newId,u.id,bill.id,p.id,v.amount,v.reference,time,bill.id,v.amount,bill.amount).run();if(!result.meta.changes)fail(409,'PAYMENT_EXCEEDS_DUE');await log(env,p,type,newId,u.id).run();return {id:newId};
}
if(type==='payment.review'){
 admin(p);const v=z.object({id,status:z.enum(['approved','rejected']),note:detail}).parse(input);const pay=await one(env,'SELECT * FROM payments WHERE id=?',v.id);if(!pay)fail(404,'NOT_FOUND');await unit(env,p,pay.unit_id);if(pay.status!=='pending')fail(409,'ALREADY_REVIEWED');if(v.status==='approved'&&!await one(env,"SELECT id FROM files WHERE target_id=? AND kind='payment'",pay.id))fail(400,'PROOF_REQUIRED');const result=await stmt(env,"UPDATE payments SET status=?,review_note=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending' AND (?='rejected' OR amount+(SELECT COALESCE(SUM(amount),0) FROM payments WHERE installment_id=? AND status='approved') <= (SELECT amount FROM installments WHERE id=?))",v.status,v.note,p.id,time,pay.id,v.status,pay.installment_id,pay.installment_id).run();if(!result.meta.changes)fail(409,'PAYMENT_CONFLICT');await log(env,p,type,pay.id,pay.unit_id).run();return {ok:true};
}
if(type==='request.create'){
 const v=z.object({unitId:id,type:str,title:str,body:detail}).parse(input);await unit(env,p,v.unitId);await env.DB.batch([stmt(env,'INSERT INTO requests(id,unit_id,author_id,type,title,body,created) VALUES(?,?,?,?,?,?,?)',newId,v.unitId,p.id,v.type,v.title,v.body,time),log(env,p,type,newId,v.unitId)]);return {id:newId};
}
if(type==='request.status'||type==='request.reply'){
 const v=z.object({id,status:z.enum(['received','processing','completed']).optional(),body:detail.optional()}).parse(input);const r=await one(env,'SELECT * FROM requests WHERE id=?',v.id);if(!r)fail(404,'NOT_FOUND');await unit(env,p,r.unit_id);
 if(type==='request.status'){admin(p);if(!v.status)fail(400,'INVALID_INPUT');await env.DB.batch([stmt(env,'UPDATE requests SET status=? WHERE id=?',v.status,r.id),log(env,p,type,r.id,r.unit_id)]);}else{if(!v.body)fail(400,'INVALID_INPUT');await env.DB.batch([stmt(env,'INSERT INTO messages(id,request_id,author_id,body,created) VALUES(?,?,?,?,?)',newId,r.id,p.id,v.body,time),log(env,p,type,r.id,r.unit_id)]);}return {id:type==='request.reply'?newId:r.id};
}
if(type==='update.create'){
 admin(p);const v=z.object({projectId:id,unitId:id.nullable(),title:str,body:detail,progress:percent,stage:z.enum(['site','structure','mep','finishing','inspection','handover'])}).parse(input);await project(env,p,v.projectId);if(v.unitId){const u=await unit(env,p,v.unitId);if(u.project_id!==v.projectId)fail(400,'INVALID_UNIT');}
 await env.DB.batch([stmt(env,'INSERT INTO updates(id,project_id,unit_id,title,body,progress,stage,created) VALUES(?,?,?,?,?,?,?,?)',newId,v.projectId,v.unitId,v.title,v.body,v.progress,v.stage,time),v.unitId?stmt(env,'UPDATE units SET progress=? WHERE id=?',v.progress,v.unitId):stmt(env,'UPDATE projects SET progress=? WHERE id=?',v.progress,v.projectId),log(env,p,type,newId,v.unitId)]);return {id:newId};
}
if(type==='snag.create'){
 const v=z.object({unitId:id,title:str,body:detail,location:str}).parse(input);await unit(env,p,v.unitId);await env.DB.batch([stmt(env,'INSERT INTO snags(id,unit_id,author_id,title,body,location,created) VALUES(?,?,?,?,?,?,?)',newId,v.unitId,p.id,v.title,v.body,v.location,time),log(env,p,type,newId,v.unitId)]);return {id:newId};
}
if(type==='snag.status'){
 const v=z.object({id,status:z.enum(['open','fixing','resolved','accepted']),resolution:z.string().trim().max(5000).default('')}).parse(input);const r=await one(env,'SELECT * FROM snags WHERE id=?',v.id);if(!r)fail(404,'NOT_FOUND');await unit(env,p,r.unit_id);if(p.role==='developer'){if(v.status==='accepted')fail(403,'BUYER_CONFIRMATION_REQUIRED');if(v.status==='resolved'&&!v.resolution)fail(400,'RESOLUTION_REQUIRED');}else if(r.status!=='resolved'||!['accepted','open'].includes(v.status))fail(403,'FORBIDDEN');await env.DB.batch([stmt(env,'UPDATE snags SET status=?,resolution=? WHERE id=?',v.status,p.role==='developer'?v.resolution:r.resolution,r.id),log(env,p,type,r.id,r.unit_id)]);return {ok:true};
}
if(type==='slot.create'){
 admin(p);const v=z.object({unitId:id,start:z.string().datetime()}).parse(input);await unit(env,p,v.unitId);if(Date.parse(v.start)<Date.now())fail(400,'FUTURE_DATE_REQUIRED');await env.DB.batch([stmt(env,'INSERT INTO slots(id,unit_id,start,created) VALUES(?,?,?,?)',newId,v.unitId,v.start,time),log(env,p,type,newId,v.unitId)]);return {id:newId};
}
if(type==='slot.book'||type==='slot.confirm'){
 const v=z.object({id}).parse(input);const r=await one(env,'SELECT * FROM slots WHERE id=?',v.id);if(!r)fail(404,'NOT_FOUND');const u=await unit(env,p,r.unit_id);if(type==='slot.confirm')admin(p);else if(p.role!=='buyer')fail(403,'BUYER_CONFIRMATION_REQUIRED');if(Date.parse(r.start)<Date.now())fail(400,'SLOT_EXPIRED');const result=type==='slot.book'?await stmt(env,"UPDATE slots SET status='booked',booked_by=? WHERE id=? AND status='available' AND NOT EXISTS(SELECT id FROM slots WHERE unit_id=? AND status IN ('booked','confirmed'))",p.id,r.id,u.id).run():await stmt(env,"UPDATE slots SET status='confirmed' WHERE id=? AND status='booked'",r.id).run();if(!result.meta.changes)fail(409,'SLOT_UNAVAILABLE');await log(env,p,type,r.id,u.id).run();return {ok:true};
}
if(type==='handover.save'){
 admin(p);const v=z.object({unitId:id,keys:z.boolean(),meters:z.boolean(),documents:z.boolean(),notes:z.string().trim().max(5000)}).parse(input);await unit(env,p,v.unitId);const existing=await one(env,'SELECT * FROM handovers WHERE unit_id=?',v.unitId);if(existing?.signed_at)fail(409,'HANDOVER_SIGNED');await env.DB.batch([stmt(env,'INSERT INTO handovers(id,unit_id,keys,meters,documents,notes,created) VALUES(?,?,?,?,?,?,?) ON CONFLICT(unit_id) DO UPDATE SET keys=excluded.keys,meters=excluded.meters,documents=excluded.documents,notes=excluded.notes WHERE signed_at IS NULL',newId,v.unitId,+v.keys,+v.meters,+v.documents,v.notes,time),log(env,p,type,newId,v.unitId)]);return {ok:true};
}
if(type==='handover.sign'){
 if(p.role!=='buyer')fail(403,'BUYER_CONFIRMATION_REQUIRED');const v=z.object({unitId:id,name:str,consent:z.literal(true)}).parse(input);await unit(env,p,v.unitId);const r=await one(env,'SELECT * FROM handovers WHERE unit_id=?',v.unitId);if(!r||!r.keys||!r.meters||!r.documents)fail(400,'CHECKLIST_INCOMPLETE');if(await one(env,"SELECT id FROM snags WHERE unit_id=? AND status!='accepted'",v.unitId))fail(400,'SNAGS_OPEN');const res=await stmt(env,'UPDATE handovers SET signed_name=?,signed_by=?,signed_at=? WHERE unit_id=? AND signed_at IS NULL',v.name,p.id,time,v.unitId).run();if(!res.meta.changes)fail(409,'HANDOVER_SIGNED');await log(env,p,type,r.id,v.unitId).run();return {ok:true};
}
if(type==='task.create'){
 admin(p);const v=z.object({unitId:id,title:str,due:date}).parse(input);await unit(env,p,v.unitId);await env.DB.batch([stmt(env,'INSERT INTO tasks(id,unit_id,title,due,created) VALUES(?,?,?,?,?)',newId,v.unitId,v.title,v.due,time),log(env,p,type,newId,v.unitId)]);return {id:newId};
}
if(type==='task.status'){
 const v=z.object({id,status:z.enum(['open','done'])}).parse(input);const r=await one(env,'SELECT * FROM tasks WHERE id=?',v.id);if(!r)fail(404,'NOT_FOUND');await unit(env,p,r.unit_id);await env.DB.batch([stmt(env,'UPDATE tasks SET status=? WHERE id=?',v.status,r.id),log(env,p,type,r.id,r.unit_id)]);return {ok:true};
}
if(type==='demo.create')return seed(env,p);
fail(400,'UNKNOWN_ACTION');
}
async function seed(env:Store,p:Person){admin(p);if(await one(env,'SELECT id FROM projects WHERE company_id=? AND demo=1',p.company_id))fail(409,'DEMO_EXISTS');const proj=uid(),a=uid(),b=uid(),t=now(),up=uid();await env.DB.batch([
 stmt(env,'INSERT INTO projects(id,company_id,name,location,progress,handover,demo,created) VALUES(?,?,?,?,?,?,1,?)',proj,p.company_id,'BuildView Demo Residences','Dubai · Demo',68,'Q4 2027',t),
 ...[[a,'A-1204',12,200000000],[b,'A-1205',12,150000000]].map(([id,code,floor,price])=>stmt(env,"INSERT INTO units(id,company_id,project_id,code,floor,bedrooms,area,parking,price,progress,created) VALUES(?,?,?,?,?,2,1181,'1',?,45,?)",id,p.company_id,proj,code,String(floor),price,t)),
 ...[a,b].flatMap(u=>[stmt(env,'INSERT INTO installments(id,unit_id,label,amount,due,created) VALUES(?,?,?,?,?,?)',uid(),u,'Booking / دفعة الحجز',10000000,'2026-10-30',t),stmt(env,'INSERT INTO tasks(id,unit_id,title,due,created) VALUES(?,?,?,?,?)',uid(),u,'Review your payment plan / مراجعة خطة الدفع','2026-10-30',t)]),
 stmt(env,"INSERT INTO updates(id,project_id,title,body,progress,stage,created) VALUES(?,?,?,?,68,'mep',?)",up,proj,'September update / تحديث سبتمبر','Demo: electrical and plumbing installation is progressing. / تجريبي: أعمال الكهرباء والسباكة قيد التنفيذ.',t),log(env,p,'demo.create',proj)
]);return {id:proj};}

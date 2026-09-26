import {Store,Identity,actor,one,all,fail} from './store';
export async function state(env:Store,identity:Identity|null){
if(!identity)fail(401,'SIGN_IN');const company=await one(env,'SELECT id,name FROM companies LIMIT 1');if(!company)return {setup:true,identity};
let p;try{p=await actor(env,identity)}catch{return {invitationRequired:true,identity}};
const where=p.role==='developer'?'company_id=?':'company_id=? AND buyer_id=?',args=p.role==='developer'?[p.company_id]:[p.company_id,p.id];
const units=await all(env,`SELECT * FROM units WHERE ${where}`, ...args),ids=units.map(u=>u.id);const marks=ids.map(()=>'?').join(',')||'NULL';
const projects=p.role==='developer'?await all(env,'SELECT * FROM projects WHERE company_id=?',p.company_id):await all(env,`SELECT * FROM projects WHERE id IN (SELECT project_id FROM units WHERE id IN (${marks}))`,...ids);
const projectIds=projects.map(p=>p.id),pm=projectIds.map(()=>'?').join(',')||'NULL';
const names=p.role==='developer'?await all(env,'SELECT id,name,email,phone,role,active,subject IS NOT NULL AS linked,invite_expires FROM people WHERE company_id=?',p.company_id):[p];
const results=await Promise.all(['installments','payments','requests','snags','slots','handovers','tasks','quotes'].map(table=>all(env,`SELECT * FROM ${table} WHERE unit_id IN (${marks}) ORDER BY created DESC`,...ids)));
const [installments,payments,requests,snags,slots,handovers,tasks,quotes]=results;
const messages=await all(env,`SELECT m.*,p.name AS author_name,p.role AS author_role FROM messages m JOIN people p ON p.id=m.author_id WHERE request_id IN(SELECT id FROM requests WHERE unit_id IN (${marks})) ORDER BY m.created`,...ids);
const updates=await all(env,`SELECT * FROM updates WHERE project_id IN (${pm}) AND (unit_id IS NULL OR unit_id IN (${marks})) ORDER BY created DESC`,...projectIds,...ids);
const files=await all(env,`SELECT id,unit_id,project_id,kind,target_id,name,label,category,mime,size,created FROM files WHERE company_id=? AND (unit_id IN (${marks}) OR (unit_id IS NULL AND project_id IN (${pm}))) ORDER BY created DESC`,p.company_id,...ids,...projectIds);
const audit=p.role==='developer'?await all(env,'SELECT a.*,p.name AS actor_name FROM audit a LEFT JOIN people p ON p.id=a.actor_id WHERE a.company_id=? ORDER BY a.created DESC LIMIT 100',p.company_id):await all(env,`SELECT a.*,p.name AS actor_name FROM audit a LEFT JOIN people p ON p.id=a.actor_id WHERE a.company_id=? AND (a.unit_id IN (${marks}) OR a.entity_id IN (SELECT id FROM updates WHERE project_id IN (${pm}) AND unit_id IS NULL)) ORDER BY a.created DESC LIMIT 60`,p.company_id,...ids,...projectIds);
return {me:p,company,people:names,projects,units,installments,payments,requests,messages,updates,snags,slots,handovers,tasks,quotes,files,audit};
}

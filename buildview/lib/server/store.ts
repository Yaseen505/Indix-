export type Store={DB:D1Database;BUCKET:R2Bucket};
export type Identity={userId:string;email:string;displayName:string};
export type Person={id:string;company_id:string;subject:string|null;name:string;email:string;phone:string;role:string;active:number};
export class AppError extends Error{constructor(public status:number,public code:string){super(code)}}
export function fail(status:number,code:string):never{throw new AppError(status,code)}
export const uid=()=>crypto.randomUUID();
export const now=()=>new Date().toISOString();
export function stmt(env:Store,sql:string,...args:unknown[]){return env.DB.prepare(sql).bind(...args)}
export async function one<T=any>(env:Store,sql:string,...args:unknown[]):Promise<T|null>{return stmt(env,sql,...args).first<T>()}
export async function all<T=any>(env:Store,sql:string,...args:unknown[]):Promise<T[]>{return (await stmt(env,sql,...args).all<T>()).results||[]}
export async function actor(env:Store,identity:Identity|null){if(!identity)fail(401,'SIGN_IN');const p=await one<Person>(env,'SELECT id,company_id,subject,name,email,phone,role,active FROM people WHERE subject=?',identity!.userId);if(!p||!p.active)fail(403,'INVITATION_REQUIRED');return p!}
export function admin(p:Person){if(p.role!=='developer')fail(403,'FORBIDDEN')}
export async function unit(env:Store,p:Person,id:string){const u=await one(env,'SELECT * FROM units WHERE id=? AND company_id=?',id,p.company_id);if(!u||(p.role!=='developer'&&u.buyer_id!==p.id))fail(404,'NOT_FOUND');return u}
export async function project(env:Store,p:Person,id:string){const value=await one(env,'SELECT * FROM projects WHERE id=? AND company_id=?',id,p.company_id);if(!value)fail(404,'NOT_FOUND');if(p.role!=='developer'&&!await one(env,'SELECT id FROM units WHERE project_id=? AND buyer_id=?',id,p.id))fail(404,'NOT_FOUND');return value}
export function log(env:Store,p:Person,action:string,entity:string,unitId:string|null=null){return stmt(env,'INSERT INTO audit(id,company_id,actor_id,action,entity_id,unit_id,created) VALUES(?,?,?,?,?,?,?)',uid(),p.company_id,p.id,action,entity,unitId,now())}
export async function sha(value:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')}
export const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');

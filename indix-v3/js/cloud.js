"use strict";
/* =========================================================================
   INDIX — שכבת ענן (Supabase): התחברות, סנכרון, קבצים, זמן אמת
   אם אין הגדרות ב-config.js — המערכת עובדת במצב מקומי (כמו קודם).
   ========================================================================= */
const COLLS = ["users","projects","boq","tasks","reports","daily","plans","stock","movements","suppliers","requests","bills","tenders","meetings","docs","notes","audit","subbills"];
const FILE_FIELDS = ["photo","img","signature","file","data"];
const CACHE_KEY = "indix_cloud_cache";

const CLOUD = {
  enabled:false, sb:null, email:null, snap:new Map(), idBlock:null, timer:null, busy:false, again:false,
  online:true, channel:null, pendingRender:false,

  init(){
    const c = window.INDIX_CONFIG || {};
    if (!c.supabaseUrl || !c.supabaseAnonKey) return false;
    if (!window.supabase?.createClient){ console.warn("supabase-js לא נטען — מצב מקומי"); return false; }
    this.sb = window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, {auth:{persistSession:true, autoRefreshToken:true}});
    this.enabled = true;
    window.addEventListener("online", () => this.schedule(10));
    setInterval(() => { if (this.dirty()) this.schedule(10); }, 20000);
    setInterval(() => this.checkRole(), 60000);
    return true;
  },

  key(coll, id){ return coll + "|" + id; },
  metaRecord(){ return {settings:DB.settings, customMaterials:DB.customMaterials || {}}; },
  records(){
    const out = new Map();
    COLLS.forEach(c => (DB[c]||[]).forEach(r => out.set(this.key(c, r.id), [c, r])));
    out.set(this.key("meta", 1), ["meta", {id:1, ...this.metaRecord()}]);
    return out;
  },
  dirty(){ if (!this.enabled || !DB) return false; for (const [k,[c,r]] of this.records()) if (this.snap.get(k) !== JSON.stringify(r)) return true; return false; },

  status(state, text){
    const el = document.getElementById("syncState"); if (!el) return;
    el.className = "sync " + state; el.textContent = text; el.title = text;
  },

  /* בדיקה שהמשתמש עדיין פעיל ומורשה (למשל אם המנכ״ל השבית אותו) */
  async checkRole(){
    if (!this.enabled || !S.user) return;
    try { const {data, error} = await this.sb.rpc("indix_role"); if (error) return;
      if (!data){ toast("הגישה שלך למערכת בוטלה","danger"); setTimeout(logout, 1500); }
      else if (data !== S.user.role){ toast("התפקיד שלך עודכן — המסך מתרענן","warning"); setTimeout(() => location.reload(), 1500); }
    } catch(e){}
  },

  /* ---------- מספור משותף ---------- */
  async reserve(){
    try { const {data, error} = await this.sb.rpc("indix_reserve_ids"); if (error) throw error; this.idBlock = {next:Number(data), end:Number(data)+49}; }
    catch(e){ console.warn("reserve ids", e); }
  },
  nextId(){
    if (this.idBlock && this.idBlock.next <= this.idBlock.end){
      const v = this.idBlock.next++;
      if (this.idBlock.end - this.idBlock.next < 10 && !this._res){ this._res = true; this.reserve().finally(()=>this._res=false); }
      return v;
    }
    // ללא חיבור: מזהה ייחודי לפי זמן (לא מתנגש בין מכשירים)
    return Math.floor(Date.now()/10) * 10 + Math.floor(Math.random()*10);
  },

  /* ---------- התחברות ---------- */
  async session(){ const {data} = await this.sb.auth.getSession(); return data?.session || null; },
  async signIn(email, password){ const {data, error} = await this.sb.auth.signInWithPassword({email, password}); if (error) throw error; return data.session; },
  async signUp(email, password){ const {data, error} = await this.sb.auth.signUp({email, password, options:{emailRedirectTo: location.origin + location.pathname}}); if (error) throw error; return data; },
  async signOut(){ try { await this.sb.auth.signOut(); } catch(e){} localStorage.removeItem(CACHE_KEY); },

  /* ---------- טעינה ---------- */
  async fetchAll(){
    const rows = []; let from = 0;
    for(;;){
      const {data, error} = await this.sb.from("indix_records").select("coll,id,data").order("coll").order("id").range(from, from+999);
      if (error) throw error; rows.push(...data); if (data.length < 1000) break; from += 1000;
    }
    return rows;
  },
  build(rows){
    const db = {ver:DB_VER, seq:0, settings:{company:""}, customMaterials:{}}; COLLS.forEach(c => db[c] = []);
    rows.forEach(r => { if (r.coll === "meta"){ db.settings = r.data.settings || db.settings; db.customMaterials = r.data.customMaterials || {}; } else if (db[r.coll]) db[r.coll].push(r.data); });
    COLLS.forEach(c => db[c].sort((a,b)=>a.id-b.id));
    db.audit.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
    db.notes.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
    return db;
  },
  takeSnapshot(){ this.snap = new Map(); for (const [k,[c,r]] of this.records()) this.snap.set(k, JSON.stringify(r)); },
  cache(){ try { localStorage.setItem(CACHE_KEY, JSON.stringify({email:this.email, db:DB})); } catch(e){} },
  cached(){ try { const c = JSON.parse(localStorage.getItem(CACHE_KEY)); return c && c.email === this.email ? c.db : null; } catch(e){ return null; } },

  /* מחזיר: "ok" | "empty" (מערכת חדשה) | "denied" (המייל לא רשום) | "offline" */
  async loadRemote(){
    try {
      const {data:role} = await this.sb.rpc("indix_role");
      if (!role){ const {data:empty, error} = await this.sb.rpc("indix_empty"); if (error) throw error; return empty ? "empty" : "denied"; }
      DB = this.build(await this.fetchAll());
      Object.assign(MATERIALS, DB.customMaterials || {});
      this.takeSnapshot(); this.cache(); this.online = true;
      await this.reserve(); this.subscribe();
      return "ok";
    } catch(e){
      console.warn("load", e);
      const c = this.cached(); if (!c) throw e;
      DB = c; Object.assign(MATERIALS, DB.customMaterials || {});
      this.snap = new Map(); this.online = false; // הכל ייחשב "לא מסונכרן" ויישלח כשהחיבור יחזור — upsert בטוח
      this.takeSnapshot();
      return "offline";
    }
  },

  /* הקמה ראשונה: המנכ״ל בוחר נתוני דוגמה או מערכת ריקה */
  async bootstrap(withDemo, name, company){
    DB = withDemo ? seed() : emptyDB(company);
    DB.audit.forEach(a => { if (!a.id) a.id = this.nextId(); });
    const ceo = DB.users.find(u => u.role === "ceo"); ceo.email = this.email; if (name) ceo.name = name;
    if (company) DB.settings.company = company;
    DB.users.forEach(u => { if (u !== ceo && !u.email) u.email = ""; });
    await this.reserve();
    this.snap = new Map();
    // קודם המשתמשים (כדי שה-RLS יזהה את המנכ״ל), אחר כך כל השאר
    const users = DB.users.map(u => ({coll:"users", id:u.id, data:u}));
    const {error} = await this.sb.from("indix_records").upsert(users); if (error) throw error;
    DB.users.forEach(u => this.snap.set(this.key("users", u.id), JSON.stringify(u)));
    await this.sync(true);
    await this.reserve(); this.subscribe(); this.cache();
  },

  /* ---------- שמירה לענן (הפרשים בלבד) ---------- */
  schedule(ms = 600){ if (!this.enabled) return; clearTimeout(this.timer); this.status("saving","⏳ שומר…"); this.timer = setTimeout(() => this.sync(), ms); },
  async uploadFiles(coll, r){
    for (const f of FILE_FIELDS){
      const v = r[f];
      if (typeof v !== "string" || !v.startsWith("data:") || v.length < 3000) continue;
      const m = v.match(/^data:([^;,]+)?(;base64)?,/); const type = m?.[1] || "application/octet-stream";
      const blob = await (await fetch(v)).blob();
      const ext = (type.split("/")[1] || "bin").replace(/[^a-z0-9]/gi,"").slice(0,5);
      const path = `${coll}/${r.id}-${f}-${Math.random().toString(36).slice(2,10)}.${ext}`;
      const {error} = await this.sb.storage.from("indix").upload(path, blob, {contentType:type, upsert:false});
      if (error) throw error;
      r[f] = this.sb.storage.from("indix").getPublicUrl(path).data.publicUrl;
    }
  },
  async sync(force){
    if (!this.enabled || !S.user && !force) return;
    if (this.busy){ this.again = true; return; }
    this.busy = true;
    try {
      const cur = this.records(), up = [], del = [];
      for (const [k,[c,r]] of cur){
        if (this.snap.get(k) === JSON.stringify(r)) continue;
        if (c !== "meta") await this.uploadFiles(c, r);
        up.push({coll:c, id:r.id, data:c === "meta" ? {id:1, ...this.metaRecord()} : r});
      }
      for (const k of this.snap.keys()) if (!cur.has(k)){ const [c,id] = k.split("|"); del.push([c, +id]); }
      // המשתמשים קודם (חשוב לשינויי הרשאות)
      up.sort((a,b) => (a.coll==="users"?0:1) - (b.coll==="users"?0:1));
      let rejected = 0;
      for (let i = 0; i < up.length; i += 200){
        const batch = up.slice(i, i+200);
        const {error} = await this.sb.from("indix_records").upsert(batch);
        if (!error){ batch.forEach(x => this.snap.set(this.key(x.coll, x.id), JSON.stringify(x.data))); continue; }
        if (!this.isDenied(error)) throw error;
        // השרת דחה חלק מהרשומות (הרשאה) — שולחים אחת-אחת, ומחזירים את הנדחות לגרסת השרת
        for (const x of batch){
          const {error:e1} = await this.sb.from("indix_records").upsert([x]);
          if (!e1){ this.snap.set(this.key(x.coll, x.id), JSON.stringify(x.data)); continue; }
          if (!this.isDenied(e1)) throw e1;
          rejected++; this.revert(x.coll, x.id);
        }
      }
      for (const [c,id] of del){
        const {error} = await this.sb.from("indix_records").delete().eq("coll", c).eq("id", id); if (error) throw error;
        this.snap.delete(this.key(c, id));
      }
      this.online = true; this.cache();
      if (rejected){ this.status("err", "⛔ שינוי נדחה (הרשאה)"); toast(`השרת דחה ${rejected} שינויים — אין הרשאה. הנתונים הוחזרו למצב השרת.`,"danger"); this.checkRole(); if (S.user) render(); }
      else this.status("ok", "☁ מסונכרן");
      if (up.some(x => FILE_FIELDS.some(f => typeof x.data[f] === "string" && x.data[f].startsWith("http"))) && S.user && $("modal").classList.contains("hidden")) render();
    } catch(e){
      console.warn("sync", e); this.online = false; this.cache();
      const denied = this.isDenied(e);
      this.status("err", denied ? "⛔ אין הרשאה לשמור" : "⚠ לא מקוון — יישמר כשיחזור חיבור");
      if (denied){ toast("השרת דחה את השמירה — אין הרשאה לפעולה זו","danger"); this.checkRole(); }
    } finally {
      this.busy = false;
      if (this.again){ this.again = false; this.schedule(50); }
    }
  },

  isDenied(e){ return /row-level security|permission|42501/i.test((e?.message || "") + (e?.code || "")); },
  revert(coll, id){
    const k = this.key(coll, id), old = this.snap.get(k);
    if (coll === "meta") return;
    const arr = DB[coll]; if (!arr) return;
    const i = arr.findIndex(x => x.id === id);
    if (old){ const o = JSON.parse(old); if (i >= 0) arr[i] = o; else arr.push(o); if (coll === "users" && S.user && o.id === S.user.id) S.user = o; }
    else if (i >= 0) arr.splice(i, 1);
  },

  /* ---------- זמן אמת: שינויים ממכשירים אחרים ---------- */
  subscribe(){
    if (this.channel) return;
    this.channel = this.sb.channel("indix-records")
      .on("postgres_changes", {event:"*", schema:"public", table:"indix_records"}, p => this.onRemote(p))
      .subscribe(st => { if (st === "SUBSCRIBED") this.status("ok","☁ מסונכרן"); });
  },
  onRemote(p){
    const row = p.new && p.new.coll ? p.new : p.old; if (!row || !row.coll) return;
    const k = this.key(row.coll, row.id);
    if (p.eventType === "DELETE"){
      if (!this.snap.has(k)) return;
      this.snap.delete(k);
      if (DB[row.coll]) DB[row.coll] = DB[row.coll].filter(x => x.id !== Number(row.id));
    } else {
      const json = JSON.stringify(row.data);
      if (this.snap.get(k) === json) return; // השינוי שלי
      this.snap.set(k, json);
      if (row.coll === "meta"){ DB.settings = row.data.settings || DB.settings; DB.customMaterials = row.data.customMaterials || {}; Object.assign(MATERIALS, DB.customMaterials); }
      else if (DB[row.coll]){ const arr = DB[row.coll], i = arr.findIndex(x => x.id === Number(row.id)); if (i >= 0) arr[i] = row.data; else arr.push(row.data); }
    }
    this.cache();
    if (!S.user) return;
    if (row.coll === "users"){ const me = U(S.user.id); if (!me || !me.active){ toast("המשתמש שלך הושבת","danger"); setTimeout(logout, 1500); return; } S.user = me; }
    if ($("modal").classList.contains("hidden")) render(); else this.pendingRender = true;
  }
};

/* מערכת ריקה (ללא נתוני דוגמה) */
function emptyDB(company){
  const db = { ver:DB_VER, seq:1000, settings:{ company: company || "החברה שלי" }, customMaterials:{} };
  COLLS.forEach(c => db[c] = []);
  db.users = [{id:1, name:"מנכ״ל", role:"ceo", pin:"1598", phone:"", email:"", active:true, projects:"all"}];
  let i = 400; db.stock = Object.keys(MATERIALS).filter(k => !k.startsWith("m")).map(mat => ({id:++i, mat, qty:0, min:0, location:"מחסן מרכזי"}));
  return db;
}

/* ---------- מסכי התחברות במצב ענן ---------- */
function cloudLoginUI(){
  $("localLogin").classList.add("hidden"); $("cloudLogin").classList.remove("hidden");
  $("loginCompany").textContent = "מחובר לענן ☁";
}
function authMsg(t, err){ const e = $("authMsg"); e.textContent = t; e.className = err ? "danger-text" : "muted"; }
async function cloudLogin(){
  const email = val("emailInput").toLowerCase(), pw = $("pwInput").value;
  if (!email || !pw) return authMsg("יש להזין מייל וסיסמה", true);
  authMsg("מתחבר…");
  try { await CLOUD.signIn(email, pw); await afterAuth(); }
  catch(e){ authMsg(/invalid/i.test(e.message) ? "מייל או סיסמה שגויים" : /confirm/i.test(e.message) ? "יש לאשר את המייל (נשלח אליך קישור)" : "שגיאה: " + e.message, true); }
}
async function cloudSignUp(){
  const email = val("emailInput").toLowerCase(), pw = $("pwInput").value;
  if (!email || pw.length < 6) return authMsg("מייל וסיסמה של 6 תווים לפחות", true);
  try {
    const r = await CLOUD.signUp(email, pw);
    if (r.session){ await afterAuth(); }
    else authMsg("נשלח אליך מייל אישור. אחרי האישור — היכנס, ובקש מהמנכ״ל להוסיף את המייל שלך במערכת.");
  } catch(e){ authMsg("שגיאה בהרשמה: " + e.message, true); }
}
async function cloudReset(){
  const email = val("emailInput").toLowerCase(); if (!email) return authMsg("הזן את המייל שלך ואז לחץ שוב", true);
  try { await CLOUD.sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin + location.pathname}); authMsg("נשלח מייל לאיפוס סיסמה"); }
  catch(e){ authMsg("שגיאה: " + e.message, true); }
}
async function afterAuth(){
  const s = await CLOUD.session(); if (!s) return;
  CLOUD.email = (s.user.email || "").toLowerCase();
  authMsg("טוען נתונים…");
  let r;
  try { r = await CLOUD.loadRemote(); } catch(e){ return authMsg("אין חיבור לשרת ואין עותק שמור במכשיר: " + (e.message||e), true); }
  if (r === "denied"){
    authMsg(`המייל ${CLOUD.email} עדיין לא משויך למשתמש ב-INDIX. בקש מהמנכ״ל להוסיף אותו במסך ניהול והרשאות.`, true);
    $("cloudOut").classList.remove("hidden"); return;
  }
  if (r === "empty"){ $("cloudLogin").classList.add("hidden"); $("bootstrap").classList.remove("hidden"); return; }
  enterAs();
  if (r === "offline"){ CLOUD.status("err","⚠ לא מקוון — עובד מעותק שמור"); toast("אין חיבור — עובד מהעותק השמור במכשיר","warning"); }
}
function enterAs(){
  const u = DB.users.find(x => (x.email||"").toLowerCase() === CLOUD.email && x.active);
  if (!u){ authMsg("המשתמש שלך מושבת או לא נמצא", true); $("cloudOut").classList.remove("hidden"); return; }
  S.user = u; audit("כניסה למערכת"); save(); startApp(); CLOUD.status(CLOUD.online?"ok":"err", CLOUD.online?"☁ מסונכרן":"⚠ לא מקוון");
}
async function doBootstrap(withDemo){
  const name = val("bsName"), company = val("bsCompany");
  if (!req(name && company, "יש להזין שם ושם חברה")) return;
  $("bsMsg").textContent = "מקים את המערכת…";
  try { await CLOUD.bootstrap(withDemo, name, company); $("bootstrap").classList.add("hidden"); enterAs(); toast("המערכת הוקמה בענן 🎉"); }
  catch(e){ $("bsMsg").textContent = "שגיאה: " + e.message + " — ודא שהרצת את קובץ setup.sql"; }
}

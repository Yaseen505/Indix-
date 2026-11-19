"use strict";
/* =========================================================================
   INDIX V3.1 — מפרט 1598 — ליבת המערכת: נתונים, הרשאות, עזרים, AI
   ========================================================================= */
const APP_VERSION = "V3.3 — מפרט 1598";
const DB_KEY = "indix_v3_db", SESSION_KEY = "indix_session", DB_VER = 3;

const MODULES = [
  ["dashboard","INDEX 01","🏠","ראשי"],
  ["projects","INDEX 02","🏗️","פרויקטים"],
  ["plans","INDEX 03","📐","תוכניות"],
  ["tasks","INDEX 04","✅","משימות"],
  ["people","INDEX 05","👷","עובדים וקבלנים"],
  ["fieldAI","INDEX 06","📸","שטח + AI"],
  ["daily","INDEX 07","📋","יומן עבודה"],
  ["progress","INDEX 08","📊","התקדמות"],
  ["warehouse","INDEX 09","📦","מחסן"],
  ["purchasing","INDEX 10","🛒","רכש"],
  ["suppliers","INDEX 11","🏭","ספקים"],
  ["boq","INDEX 12","📑","כתב כמויות"],
  ["billing","INDEX 13","💰","חשבונות"],
  ["finance","INDEX 14","📈","כספים ורווחיות"],
  ["tenders","INDEX 15","🧮","מכרזים"],
  ["ai","INDEX 16","🤖","AI Control"],
  ["alerts","INDEX 17","🔔","התראות"],
  ["docs","INDEX 18","📄","מסמכים"],
  ["meetings","INDEX 19","📅","פגישות"],
  ["admin","INDEX 20","🔐","ניהול והרשאות"]
];

const SUBTITLES = {
  dashboard:"מרכז השליטה של החברה", projects:"ניהול כל הפרויקטים והביצוע",
  plans:"תוכניות, גרסאות וסימון עבודות על התוכנית", tasks:"הקצאת משימות לעובדים ולקבלנים",
  people:"עובדים, קבלנים ושיוך לפרויקטים", fieldAI:"דיווח שטח: תמונה + GPS + ניתוח AI + אישור מהנדס",
  daily:"דוחות עבודה יומיים ואישורים", progress:"מעקב כמותי ואחוזי ביצוע",
  warehouse:"מלאי, קליטות, ניפוקים וחתימות", purchasing:"דרישות רכש, בדיקת חריגה, הזמנות ואספקה",
  suppliers:"מחירונים והשוואת ספקים", boq:"כתב כמויות, ביצוע ויתרות",
  billing:"חשבונות חודשיים לפי כמויות מאושרות בלבד", finance:"הכנסות, עלויות ורווחיות",
  tenders:"תמחור מכרזים והיסטוריית מחירים", ai:"בקרה חכמה, חריגות וסיכונים",
  alerts:"התראות והודעות מערכת", docs:"מסמכי חברה ופרויקט", meetings:"פגישות, החלטות ומשימות המשך",
  admin:"משתמשים, הרשאות, יומן פעולות וגיבוי"
};

const ROLES = { ceo:"מנכ״ל", engineer:"מהנדס", worker:"עובד", contractor:"קבלן משנה", purchasing:"רכש", storekeeper:"מחסנאי" };

const ROLE_ACCESS = {
  ceo: MODULES.map(m => m[0]),
  engineer: ["dashboard","projects","plans","tasks","people","fieldAI","daily","progress","warehouse","purchasing","suppliers","boq","billing","finance","tenders","ai","alerts","docs","meetings"],
  worker: ["dashboard","plans","tasks","fieldAI","daily","alerts","docs","meetings"],
  contractor: ["dashboard","plans","tasks","fieldAI","daily","progress","alerts","docs"],
  purchasing: ["dashboard","projects","warehouse","purchasing","suppliers","boq","alerts","docs"],
  storekeeper: ["dashboard","projects","warehouse","purchasing","alerts","docs"]
};

/* הרשאות לפעולות (לא רק למסכים) */
const CAN = {
  manageProjects:["ceo","engineer"], createTask:["ceo","engineer"], fieldReport:["worker","contractor","engineer","ceo"],
  approveReport:["ceo","engineer"], approveDaily:["ceo","engineer"], managePlans:["ceo","engineer"],
  stockMove:["storekeeper","ceo"], createRequest:["ceo","engineer","purchasing","storekeeper"],
  approveOver:["ceo"], orderRequest:["ceo","purchasing"], receive:["storekeeper","ceo"],
  manageSuppliers:["ceo","purchasing"], editBoq:["ceo","engineer"], billing:["ceo","engineer"],
  markPaid:["ceo"], tenders:["ceo","engineer"], docs:["ceo","engineer","purchasing","storekeeper"],
  meetings:["ceo","engineer"], admin:["ceo"], seeMoney:["ceo","engineer"]
};
function can(action){ return !!S.user && (CAN[action]||[]).includes(S.user.role); }

/* סוגי עבודה (סעיפי כתב כמויות) וחומרים */
const WORK = {
  dig:{name:"חפירה",unit:"מ׳",daily:400,color:"#9a6b3f",mat:null},
  pole:{name:"העמדת עמוד תאורה",unit:"יח׳",daily:20,color:"#2563eb",mat:"pole"},
  fixture:{name:"התקנת גוף תאורה",unit:"יח׳",daily:40,color:"#d4a106",mat:"fixture"},
  cable:{name:"השחלת כבל 5×25 Al",unit:"מ׳",daily:800,color:"#dc2626",mat:"cable"},
  cabinet:{name:"מרכזיית תאורה",unit:"יח׳",daily:2,color:"#7c3aed",mat:"cabinet"},
  signal:{name:"רמזור (ראש + עמוד)",unit:"יח׳",daily:6,color:"#16a34a",mat:"signal"},
  other:{name:"אחר",unit:"יח׳",daily:50,color:"#64748b",mat:null}
};
const MATERIALS = {
  cable:{name:"כבל 5×25 Al",unit:"מ׳"}, fixture:{name:"גוף תאורה LED",unit:"יח׳"},
  pole:{name:"עמוד תאורה 10 מ׳",unit:"יח׳"}, conduit:{name:"צינור 110 מ״מ",unit:"מ׳"},
  cabinet:{name:"מרכזיית תאורה",unit:"יח׳"}, signal:{name:"ראש רמזור LED",unit:"יח׳"}
};
const DOC_CATS = ["חוזה","תוכנית","חשבון","תעודת משלוח","אישור","בטיחות","אחר"];
const REQ = { WAIT_CEO:"ממתין לאישור מנכ״ל", APPROVED:"מאושר — ממתין להזמנה", ORDERED:"הוזמן — ממתין לאספקה", SUPPLIED:"סופק למחסן", REJECTED:"נדחה" };

/* ------------------------------ מצב ונתונים ------------------------------ */
let DB = null;
const S = { user:null, current:"dashboard", after:[], draft:{}, filters:{} };

function isoLocal(d = new Date()){ const z = d.getTimezoneOffset()*60000; return new Date(d - z).toISOString().slice(0,10); }
function today(){ return isoLocal(); }
function addDays(n, base){ const d = base ? new Date(base) : new Date(); d.setDate(d.getDate()+n); return isoLocal(d); }
function monthKey(d){ return (d||today()).slice(0,7); }

/* חברת ההדגמה (js/demo-data.js) — התאריכים מוזזים בשבועות שלמים כך שהנתונים תמיד "עדכניים" */
function demoSeed(){
  const D = window.INDIX_DEMO, db = JSON.parse(JSON.stringify(D.db));
  const diff = Math.round((new Date(today()+"T12:00:00") - new Date(D.ref+"T12:00:00"))/864e5), delta = Math.floor(diff/7)*7;
  const shift = v => {
    if (typeof v === "string"){
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return addDays(delta, v+"T12:00:00");
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return new Date(Date.parse(v) + delta*864e5).toISOString();
      return v;
    }
    if (Array.isArray(v)) return v.map(shift);
    if (v && typeof v === "object"){ for (const k of Object.keys(v)) if (!["photo","img","signature","file","data"].includes(k)) v[k] = shift(v[k]); }
    return v;
  };
  if (delta) shift(db);
  db.bills.forEach(b => { b.period = b.date.slice(0,7); });
  db.ver = DB_VER; db.seq = Math.max(db.seq||0, 5000);
  return db;
}
function seed(){
  if (window.INDIX_DEMO) return demoSeed();
  const db = { ver:DB_VER, seq:1000, settings:{ company:"צ.ב הנדסת מערכות" },
    users:[], projects:[], boq:[], tasks:[], reports:[], daily:[], plans:[], stock:[], movements:[],
    suppliers:[], requests:[], bills:[], tenders:[], meetings:[], docs:[], notes:[], audit:[] };
  let seq = 0; const id = () => ++seq;

  db.users = [
    {id:1,name:"Yasen",role:"ceo",pin:"1598",email:"",phone:"",active:true,projects:"all"},
    {id:2,name:"אורי כהן",role:"engineer",pin:"1598",email:"",phone:"050-0000002",active:true,projects:"all"},
    {id:3,name:"אחמד",role:"worker",pin:"1598",email:"",phone:"050-0000003",active:true,projects:[1,2]},
    {id:4,name:"חמודה",role:"worker",pin:"1598",email:"",phone:"050-0000004",active:true,projects:[1]},
    {id:5,name:"נימר — עבודות חשמל",role:"contractor",pin:"1598",email:"",phone:"050-0000005",active:true,projects:[2,3]},
    {id:6,name:"דנה",role:"purchasing",pin:"1598",email:"",phone:"050-0000006",active:true,projects:"all"},
    {id:7,name:"סאמר",role:"storekeeper",pin:"1598",email:"",phone:"050-0000007",active:true,projects:"all"}
  ];
  seq = 10;
  db.projects = [
    {id:1,name:"מחלף קסם",client:"קבלן ראשי / עירייה",status:"פעיל",managerId:2,lat:32.1145,lng:34.9763,start:addDays(-120),end:addDays(150),budget:0},
    {id:2,name:"נחל עוז",client:"רשות מקומית",status:"פעיל",managerId:2,lat:31.4729,lng:34.4975,start:addDays(-60),end:addDays(200),budget:0},
    {id:3,name:"תאורת כביש 25",client:"נתיבי ישראל",status:"פעיל",managerId:2,lat:31.2520,lng:34.8100,start:addDays(-200),end:addDays(40),budget:0}
  ];
  seq = 100;
  const L = (pid,type,qty,base,sale,cost,desc) => db.boq.push({id:id(),projectId:pid,type,item:desc||WORK[type].name,unit:WORK[type].unit,qty,base,sale,cost});
  L(1,"dig",12000,7700,42,31); L(1,"pole",900,576,850,620); L(1,"fixture",900,560,780,560); L(1,"cable",14000,9000,76,55); L(1,"cabinet",12,7,18000,13500);
  L(2,"dig",6000,2500,42,33); L(2,"pole",350,140,850,640); L(2,"fixture",350,130,780,575); L(2,"cable",8000,2700,76,63); L(2,"cabinet",6,2,18000,14200);
  L(3,"dig",8000,6600,40,30); L(3,"pole",600,500,860,615); L(3,"fixture",600,490,790,560); L(3,"cable",9000,7400,74,54); L(3,"signal",4,3,95000,72000,"רמזור צומת (ראש + עמוד + בקר)");
  // תקציב עלות לפי 76% מהיקף החוזה
  db.projects.forEach(p => { const c = db.boq.filter(b=>b.projectId===p.id).reduce((a,b)=>a+b.qty*b.sale,0); p.budget = Math.round(c*0.76/1000)*1000; });
  const bq = (pid,type) => db.boq.find(b=>b.projectId===pid && b.type===type).id;

  seq = 200;
  db.tasks = [
    {id:id(),projectId:1,boqId:bq(1,"dig"),title:"חפירה 250 מ׳ — קטע צפוני",qty:250,assigneeId:3,location:"קטע צפוני, ק״מ 1.2",due:addDays(2),status:"בביצוע",notes:"עומק 80 ס״מ, סימון לפי תוכנית",createdBy:2},
    {id:id(),projectId:1,boqId:bq(1,"pole"),title:"העמדת 34 עמודים — רמפה מערבית",qty:34,assigneeId:4,location:"רמפה מערבית",due:addDays(5),status:"חדש",notes:"",createdBy:2},
    {id:id(),projectId:2,boqId:bq(2,"cable"),title:"השחלת כבל 5×25 — רחוב ראשי",qty:600,assigneeId:5,location:"רחוב ראשי",due:addDays(-2),status:"הושלם",notes:"",createdBy:2},
    {id:id(),projectId:3,boqId:bq(3,"fixture"),title:"התקנת 40 גופי תאורה — ק״מ 12-14",qty:40,assigneeId:5,location:"ק״מ 12-14",due:addDays(1),status:"ממתין לאישור",notes:"",createdBy:2},
    {id:id(),projectId:2,boqId:bq(2,"dig"),title:"חפירה לתשתית — שכונה חדשה",qty:400,assigneeId:3,location:"שכונה מזרחית",due:addDays(-3),status:"בביצוע",notes:"",createdBy:2}
  ];
  const t = db.tasks;
  seq = 300;
  db.reports = [
    {id:id(),taskId:t[2].id,boqId:t[2].boqId,projectId:2,userId:5,date:addDays(-2),at:new Date(Date.now()-2*864e5).toISOString(),qty:600,qtyReported:600,stage:"סיום",note:"הושלם לכל האורך",photo:null,bright:null,gps:{lat:31.4735,lng:34.4980,acc:12},status:"approved",approvedBy:2,decisionNote:""},
    {id:id(),taskId:t[3].id,boqId:t[3].boqId,projectId:3,userId:5,date:today(),at:new Date().toISOString(),qty:40,qtyReported:40,stage:"סיום",note:"כל הגופים הותקנו ונבדקו",photo:null,bright:null,gps:{lat:31.2531,lng:34.8122,acc:15},status:"pending"},
    {id:id(),taskId:t[0].id,boqId:t[0].boqId,projectId:1,userId:3,date:today(),at:new Date().toISOString(),qty:120,qtyReported:120,stage:"התקדמות",note:"נתקלנו בצנרת מים לא מסומנת ב-ק״מ 1.25",photo:null,bright:null,gps:{lat:32.1150,lng:34.9770,acc:8},status:"pending"}
  ];
  db.daily = [ {id:id(),projectId:1,date:today(),notes:"",issues:"צנרת מים לא מסומנת",weather:"בהיר",status:"ממתין לאישור מהנדס",approvedBy:null} ];

  seq = 400;
  db.stock = [
    {id:id(),mat:"cable",qty:1630,min:1000,location:"מחסן מרכזי"},
    {id:id(),mat:"fixture",qty:210,min:100,location:"מחסן מרכזי"},
    {id:id(),mat:"pole",qty:182,min:50,location:"מחסן מרכזי"},
    {id:id(),mat:"conduit",qty:400,min:500,location:"מחסן מרכזי"},
    {id:id(),mat:"cabinet",qty:1,min:2,location:"מחסן מרכזי"},
    {id:id(),mat:"signal",qty:6,min:4,location:"מחסן מרכזי"}
  ];
  db.movements = [
    {id:id(),at:new Date(Date.now()-3*864e5).toISOString(),type:"in",mat:"fixture",qty:120,projectId:null,toUserId:null,userId:7,note:"קליטה מספק גופים A",signature:null,refReq:null},
    {id:id(),at:new Date(Date.now()-1*864e5).toISOString(),type:"out",mat:"cable",qty:600,projectId:2,toUserId:5,userId:7,note:"ניפוק לנחל עוז",signature:null,refReq:null}
  ];
  seq = 500;
  db.suppliers = [
    {id:id(),name:"ארקה",contact:"משה",phone:"03-0000001",prices:{cable:55,conduit:9}},
    {id:id(),name:"בליסט",contact:"רונית",phone:"03-0000002",prices:{cable:57,fixture:575,conduit:8.5}},
    {id:id(),name:"ספק גופים A",contact:"עלי",phone:"04-0000003",prices:{fixture:560}},
    {id:id(),name:"עמודי הצפון",contact:"יוסי",phone:"04-0000004",prices:{pole:610,cabinet:13200}},
    {id:id(),name:"רמזורי ישראל",contact:"גלית",phone:"08-0000005",prices:{signal:9800}}
  ];
  const sup = n => db.suppliers.find(s=>s.name===n).id;
  db.requests = [
    {id:100,date:addDays(-40),projectId:2,mat:"cable",qty:7600,reason:"הזמנה ראשונית",status:REQ.SUPPLIED,over:false,overMsg:"",requestedBy:2,supplierId:sup("ארקה"),price:55,approvedBy:1},
    {id:101,date:addDays(-1),projectId:2,mat:"cable",qty:600,reason:"השלמה לקטע מזרחי",status:REQ.WAIT_CEO,over:true,overMsg:"חריגה של 200 מ׳ מעבר לכמות בכתב הכמויות (8,000 מ׳)",requestedBy:2,supplierId:null,price:null},
    {id:102,date:addDays(-1),projectId:1,mat:"fixture",qty:70,reason:"רמפה מערבית",status:REQ.APPROVED,over:false,overMsg:"",requestedBy:2,supplierId:null,price:null},
    {id:103,date:addDays(-4),projectId:3,mat:"pole",qty:40,reason:"ק״מ 14-16",status:REQ.ORDERED,over:false,overMsg:"",requestedBy:2,supplierId:sup("עמודי הצפון"),price:610}
  ];
  seq = 600;
  // חשבונות קודמים: הכמות המצטברת שחויבה = כמות הפתיחה
  const prevMonth = monthKey(addDays(-31));
  db.projects.forEach(p => {
    const lines = db.boq.filter(b=>b.projectId===p.id).map(b=>({boqId:b.id,item:b.item,unit:b.unit,prevCum:0,cum:b.base,price:b.sale}));
    db.bills.push({id:id(),projectId:p.id,period:prevMonth,date:addDays(-25),lines,total:lines.reduce((a,l)=>a+l.cum*l.price,0),status:"שולם",createdBy:1});
  });
  seq = 700;
  db.plans = [ {id:id(),projectId:1,name:"תוכנית תאורה — מחלף קסם",version:"3",status:"מאושר",img:demoPlanSVG(),fileName:"plan-kasem-v3.svg",marks:[
    {x:22,y:30,type:"pole",taskId:t[1].id,note:"עמודים 1-12"},{x:55,y:48,type:"dig",taskId:t[0].id,note:"קטע צפוני"},{x:78,y:62,type:"cable",taskId:null,note:""}],uploadedBy:2,at:new Date().toISOString()} ];
  db.tenders = [ {id:id(),name:"תאורת שכונת הדר",client:"עיריית חדרה",due:addDays(12),status:"בהכנה",markup:22,lines:[
    {type:"dig",qty:3000,cost:31,sub:0},{type:"pole",qty:180,cost:620,sub:0},{type:"fixture",qty:180,cost:560,sub:0},{type:"cable",qty:3500,cost:55,sub:52}]} ];
  db.meetings = [ {id:id(),projectId:1,date:addDays(-3),time:"09:00",title:"פגישת תיאום שבועית — מחלף קסם",participants:"Yasen, אורי כהן, נציג העירייה",summary:"סקירת התקדמות, תיאום סגירת נתיב לצורך העמדת עמודים.",decisions:[{text:"להזמין 70 גופי תאורה לרמפה המערבית",taskId:null},{text:"לתאם פקח תנועה לשבוע הבא",taskId:null}]},
    {id:id(),projectId:3,date:addDays(4),time:"11:00",title:"מסירה חלקית לנתיבי ישראל",participants:"Yasen, אורי כהן, נתיבי ישראל",summary:"",decisions:[]} ];
  db.docs = [ {id:id(),projectId:1,name:"חוזה — מחלף קסם.pdf",cat:"חוזה",size:0,data:null,by:1,at:new Date(Date.now()-90*864e5).toISOString()},
    {id:id(),projectId:3,name:"אישור בטיחות — עבודה בגובה.pdf",cat:"בטיחות",size:0,data:null,by:2,at:new Date(Date.now()-20*864e5).toISOString()} ];
  db.notes = [
    {id:id(),at:new Date().toISOString(),text:"דרישת רכש 101 (נחל עוז) חורגת מכתב הכמויות וממתינה לאישורך",roles:["ceo"],userId:null,module:"purchasing",readBy:[]},
    {id:id(),at:new Date().toISOString(),text:"2 דיווחי שטח ממתינים לאישור מהנדס",roles:["engineer","ceo"],userId:null,module:"fieldAI",readBy:[]},
    {id:id(),at:new Date(Date.now()-3*864e5).toISOString(),text:"אספקת גופי תאורה התקבלה במחסן",roles:["purchasing","storekeeper","ceo"],userId:null,module:"warehouse",readBy:[]}
  ];
  db.seq = 5000;
  return db;
}

function demoPlanSVG(){
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600" viewBox="0 0 1000 600"><rect width="1000" height="600" fill="#f8fafc"/>
<g stroke="#cbd5e1" stroke-width="1">${Array.from({length:20},(_,i)=>`<line x1="${i*50}" y1="0" x2="${i*50}" y2="600"/>`).join("")}${Array.from({length:12},(_,i)=>`<line x1="0" y1="${i*50}" x2="1000" y2="${i*50}"/>`).join("")}</g>
<path d="M0 330 C250 300 450 260 1000 240" stroke="#475569" stroke-width="60" fill="none"/><path d="M0 330 C250 300 450 260 1000 240" stroke="#fff" stroke-width="3" stroke-dasharray="25 20" fill="none"/>
<path d="M720 0 C735 200 750 380 765 600" stroke="#64748b" stroke-width="40" fill="none"/>
<path d="M150 600 C200 450 260 380 420 290" stroke="#94a3b8" stroke-width="28" fill="none"/>
<text x="30" y="40" font-family="Arial" font-size="26" font-weight="bold" fill="#0f172a">מחלף קסם — תוכנית תאורה — גרסה 3</text>
<text x="30" y="72" font-family="Arial" font-size="16" fill="#475569">קנ״מ 1:500 · צ.ב הנדסת מערכות</text>
<text x="820" y="225" font-family="Arial" font-size="16" fill="#0f172a">כביש 6</text><text x="780" y="560" font-family="Arial" font-size="16" fill="#0f172a">כביש 444</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function load(){
  try { DB = JSON.parse(localStorage.getItem(DB_KEY)); } catch(e){ DB = null; }
  // גרסת הדגמה חדשה נטענת פעם אחת (מחליפה נתוני הדגמה ישנים במכשיר)
  const demoFlag = window.INDIX_DEMO ? "indix_demo_loaded_" + window.INDIX_DEMO.ref : null;
  if (!DB || DB.ver !== DB_VER || (demoFlag && !localStorage.getItem(demoFlag))){ DB = seed(); save(); if (demoFlag) localStorage.setItem(demoFlag, "1"); }
}
function save(){
  if (typeof CLOUD !== "undefined" && CLOUD.enabled){ CLOUD.cache(); CLOUD.schedule(); return true; }
  try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); return true; }
  catch(e){ toast("האחסון בדפדפן מלא. מחק תמונות או מסמכים ישנים, או גבה את הנתונים ואפס.","danger"); return false; }
}
function nid(){ if (typeof CLOUD !== "undefined" && CLOUD.enabled) return CLOUD.nextId(); DB.seq = (DB.seq||5000) + 1; return DB.seq; }

/* ------------------------------ עזרים ------------------------------ */
const $ = id => document.getElementById(id);
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function money(n){ return new Intl.NumberFormat("he-IL",{style:"currency",currency:"ILS",maximumFractionDigits:0}).format(n||0); }
function num(n){ return new Intl.NumberFormat("he-IL",{maximumFractionDigits:2}).format(n||0); }
function pct(a,b){ return b ? Math.round(a/b*1000)/10 : 0; }
function fmtDate(s){ if(!s) return "-"; const [y,m,d] = String(s).slice(0,10).split("-"); return `${d}/${m}/${y}`; }
function fmtTime(iso){ return iso ? new Date(iso).toLocaleString("he-IL",{dateStyle:"short",timeStyle:"short"}) : "-"; }
function val(id){ const e = $(id); return e ? e.value.trim() : ""; }
function nval(id){ const v = parseFloat(val(id)); return isNaN(v) ? 0 : v; }

const P = id => DB.projects.find(x => x.id === +id);
const U = id => DB.users.find(x => x.id === +id);
const B = id => DB.boq.find(x => x.id === +id);
const T = id => DB.tasks.find(x => x.id === +id);
const uname = id => esc(U(id)?.name || "-");
const pname = id => esc(P(id)?.name || "מחסן מרכזי");
const matName = k => MATERIALS[k]?.name || k;
const stockOf = mat => DB.stock.find(s => s.mat === mat);

function audit(action, detail){
  DB.audit.unshift({id:nid(), at:new Date().toISOString(), user:S.user?.name || "מערכת", role:S.user?.role || "", action, detail:detail||""});
  if (DB.audit.length > 600) DB.audit.length = 600;
}
function notify(text, {roles=[], userId=null, module=null} = {}){
  DB.notes.unshift({id:nid(), at:new Date().toISOString(), text, roles, userId, module, readBy:[]});
  if (DB.notes.length > 300) DB.notes.length = 300;
}
function myNotes(){ return DB.notes.filter(n => n.userId === S.user.id || n.roles.includes(S.user.role)); }

/* ------------------------------ חישובים ------------------------------ */
function boqDone(b){ return b.base + DB.reports.filter(r => r.status==="approved" && r.boqId===b.id).reduce((a,r)=>a+r.qty,0); }
function boqPending(b){ return DB.reports.filter(r => r.status==="pending" && r.boqId===b.id).reduce((a,r)=>a+r.qty,0); }
function projectBoq(pid){ return DB.boq.filter(b => b.projectId === +pid); }
function taskDone(t){ return DB.reports.filter(r => r.taskId===t.id && r.status==="approved").reduce((a,r)=>a+r.qty,0); }
function taskPending(t){ return DB.reports.filter(r => r.taskId===t.id && r.status==="pending").reduce((a,r)=>a+r.qty,0); }

function projStats(pid){
  const lines = projectBoq(pid);
  let contract=0, executed=0, cost=0;
  lines.forEach(b => { const d = boqDone(b); contract += b.qty*b.sale; executed += d*b.sale; cost += d*b.cost; });
  const p = P(pid);
  const purchases = DB.requests.filter(r => r.projectId===+pid && (r.status===REQ.ORDERED || r.status===REQ.SUPPLIED)).reduce((a,r)=>a+(r.price||0)*r.qty,0);
  const bills = DB.bills.filter(x => x.projectId===+pid);
  const billed = bills.filter(x => x.status!=="טיוטה").reduce((a,x)=>a+x.total,0);
  const paid = bills.filter(x => x.status==="שולם").reduce((a,x)=>a+x.total,0);
  return { contract, executed, cost, profit:executed-cost, margin:pct(executed-cost, executed), progress:Math.min(100,pct(executed,contract)),
    budget:p?.budget||0, budgetUse:pct(cost, p?.budget||0), purchases, billed, paid };
}

function visibleProjects(){ const u = S.user; return DB.projects.filter(p => u.projects === "all" || (u.projects||[]).includes(p.id)); }
function canSeeProject(pid){ return visibleProjects().some(p => p.id === +pid); }
function isFieldRole(){ return ["worker","contractor"].includes(S.user.role); }
function myTasks(){ return isFieldRole() ? DB.tasks.filter(t => t.assigneeId === S.user.id) : DB.tasks.filter(t => canSeeProject(t.projectId)); }
function visibleReports(){ return isFieldRole() ? DB.reports.filter(r => r.userId === S.user.id) : DB.reports.filter(r => canSeeProject(r.projectId)); }

/* ------------------------------ GPS, תמונות, מרחק ------------------------------ */
function getGPS(){
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("המכשיר לא תומך ב-GPS"));
    navigator.geolocation.getCurrentPosition(
      p => res({lat:+p.coords.latitude.toFixed(6), lng:+p.coords.longitude.toFixed(6), acc:Math.round(p.coords.accuracy)}),
      e => rej(new Error(e.code===1 ? "לא ניתנה הרשאת מיקום" : "לא ניתן לקבל מיקום")),
      {enableHighAccuracy:true, timeout:12000, maximumAge:60000});
  });
}
function distKm(a,b){
  if (!a || !b || a.lat==null || b.lat==null) return null;
  const R=6371, r=x=>x*Math.PI/180, dLat=r(b.lat-a.lat), dLng=r(b.lng-a.lng);
  const h=Math.sin(dLat/2)**2 + Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
/* דחיסת תמונה + מדידת בהירות (ניתוח תמונה בסיסי אמיתי) */
function readImage(file, maxW = 1000){
  return new Promise((res, rej) => {
    if (!file || !file.type.startsWith("image/")) return rej(new Error("יש לבחור קובץ תמונה"));
    const fr = new FileReader();
    fr.onerror = () => rej(new Error("קריאת הקובץ נכשלה"));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error("התמונה לא נטענה"));
      img.onload = () => {
        const sc = Math.min(1, maxW / img.width), c = document.createElement("canvas");
        c.width = Math.round(img.width*sc); c.height = Math.round(img.height*sc);
        const ctx = c.getContext("2d"); ctx.drawImage(img,0,0,c.width,c.height);
        let bright = null;
        try { const d = ctx.getImageData(0,0,c.width,c.height).data; let s=0,n=0; for(let i=0;i<d.length;i+=40){ s += 0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]; n++; } bright = Math.round(s/n); } catch(e){}
        res({ data:c.toDataURL("image/jpeg",0.65), bright, w:c.width, h:c.height });
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function readFileData(file){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=()=>rej(new Error("קריאת הקובץ נכשלה")); fr.readAsDataURL(file); }); }

/* ------------------------------ מנוע AI (כללים) ------------------------------ */
/* הערה: זהו מנוע בקרה מבוסס כללים שרץ בדפדפן. במעבר ל-Production מחליפים את analyzeReport
   בקריאה לשירות ראייה ממוחשבת — הממשק (score / rec / flags) נשאר זהה. */
function analyzeReport(r){
  const flags = []; let score = 100;
  const t = T(r.taskId), b = B(r.boqId), p = P(r.projectId), w = WORK[b?.type] || WORK.other;
  if (!r.photo){ score -= 30; flags.push(["mid","אין תמונה — לא ניתן לאמת ויזואלית"]); }
  else if (r.bright != null && r.bright < 45){ score -= 15; flags.push(["mid","התמונה חשוכה מדי לזיהוי — מומלץ לצלם שוב באור יום"]); }
  else if (r.bright != null && r.bright > 235){ score -= 10; flags.push(["low","התמונה בהירה/שרופה מדי"]); }
  if (!r.gps){ score -= 25; flags.push(["mid","אין מיקום GPS לדיווח"]); }
  else {
    const d = distKm(r.gps, p);
    if (d != null && d > 2){ score -= 35; flags.push(["high",`המיקום רחוק ${num(Math.round(d*10)/10)} ק״מ מאתר הפרויקט`]); }
    else if (d != null) flags.push(["ok",`המיקום תואם לאתר (${num(Math.round(d*1000))} מ׳ מנקודת הייחוס)`]);
    if (r.gps.acc > 100){ score -= 5; flags.push(["low",`דיוק GPS נמוך (±${r.gps.acc} מ׳)`]); }
  }
  if (t){
    const remain = t.qty - taskDone(t) - DB.reports.filter(x=>x.taskId===t.id && x.status==="pending" && x.id!==r.id).reduce((a,x)=>a+x.qty,0);
    if (r.qty > remain + 0.001){ score -= 25; flags.push(["high",`הכמות המדווחת (${num(r.qty)}) גבוהה מיתרת המשימה (${num(Math.max(0,remain))})`]); }
  }
  if (r.qty > w.daily * 1.5){ score -= 15; flags.push(["mid",`כמות חריגה ליום עבודה (נורמה: עד ~${num(w.daily)} ${w.unit})`]); }
  if (b){ const rem = b.qty - boqDone(b); if (r.qty > rem){ score -= 10; flags.push(["mid","הדיווח חורג מיתרת סעיף כתב הכמויות"]); } }
  if (r.note && /(בעיה|תקלה|עיכוב|צנרת|פגיעה|סכנה|נזק|לא מסומנ)/.test(r.note)) flags.push(["low","בהערות העובד דווחה בעיה — להעביר ליומן העבודה"]);
  score = Math.max(0, Math.min(100, score));
  const rec = score >= 75 ? "מומלץ לאשר" : score >= 45 ? "לבדוק לפני אישור" : "לא מומלץ לאשר ללא בדיקה";
  return { score, rec, flags, detected: b ? `${b.item} (לפי המשימה)` : "-" };
}

function aiFindings(){
  const F = []; const add = (lvl,title,detail,module,roles) => F.push({lvl,title,detail,module,roles});
  const M = ["ceo","engineer"];
  visibleProjects().filter(p=>p.status!=="הסתיים").forEach(p => {
    const s = projStats(p.id);
    if (s.budget && s.budgetUse > s.progress + 8) add("high",`סיכון לחריגת תקציב — ${p.name}`,`נוצל ${s.budgetUse}% מתקציב העלות מול ${s.progress}% ביצוע`,"finance",M);
    if (s.executed && s.margin < 20) add("mid",`רווחיות נמוכה — ${p.name}`,`שיעור רווח גולמי ${s.margin}%`,"finance",M);
    const last = DB.reports.filter(r=>r.projectId===p.id).sort((a,b)=>b.at.localeCompare(a.at))[0];
    if (p.status==="פעיל" && (!p.start || p.start <= addDays(-7)) && (!last || (Date.now()-new Date(last.at))/864e5 > 7)) add("mid",`אין דיווחי שטח 7 ימים — ${p.name}`,"בדוק אם העבודה בפרויקט נעצרה","daily",M);
    if (p.end && p.end < addDays(30) && s.progress < 85) add("high",`צפי איחור — ${p.name}`,`נותרו פחות מ-30 יום לסיום ו-${s.progress}% ביצוע`,"progress",M);
    projectBoq(p.id).forEach(b => { if (boqDone(b) > b.qty) add("high",`ביצוע מעל הכמות החוזית — ${p.name}`,`${b.item}: בוצע ${num(boqDone(b))} מתוך ${num(b.qty)} — נדרשת הגדלת כמויות מול המזמין`,"boq",M); });
  });
  DB.reports.filter(r=>r.status==="pending" && canSeeProject(r.projectId)).forEach(r => {
    const a = analyzeReport(r), age = (Date.now()-new Date(r.at))/864e5;
    if (a.score < 45) add("high",`דיווח שטח חשוד #${r.id} — ${P(r.projectId)?.name}`, a.flags.filter(f=>f[0]!=="ok").map(f=>f[1]).join(" · "),"fieldAI",M);
    if (age > 2) add("mid",`דיווח #${r.id} ממתין לאישור יותר מיומיים`,"עיכוב באישור מעכב את החשבון החודשי","fieldAI",M);
  });
  DB.tasks.filter(t=>t.status!=="הושלם" && t.due && t.due < today() && canSeeProject(t.projectId)).forEach(t =>
    add("mid",`משימה באיחור — ${t.title}`,`יעד: ${fmtDate(t.due)} · אחראי: ${U(t.assigneeId)?.name||"-"}`,"tasks",[...M]));
  DB.stock.filter(s=>s.qty < s.min).forEach(s => add(s.qty===0?"high":"mid",`מלאי נמוך — ${matName(s.mat)}`,`במלאי ${num(s.qty)} ${MATERIALS[s.mat].unit}, מינימום ${num(s.min)}`,"warehouse",["ceo","purchasing","storekeeper","engineer"]));
  DB.requests.filter(r=>r.status===REQ.WAIT_CEO).forEach(r => add("high",`דרישת רכש ${r.id} חורגת וממתינה למנכ״ל`, r.overMsg,"purchasing",["ceo","purchasing"]));
  DB.requests.filter(r=>r.status===REQ.ORDERED && (Date.now()-new Date(r.date))/864e5 > 7).forEach(r => add("mid",`הזמנה ${r.id} טרם סופקה מעל שבוע`, `${matName(r.mat)} · ${P(r.projectId)?.name}`,"purchasing",["ceo","purchasing","storekeeper"]));
  DB.bills.filter(b=>b.status==="נשלח" && (Date.now()-new Date(b.date))/864e5 > 45).forEach(b => add("mid",`חשבון ${b.id} לא נגבה מעל 45 יום`, `${P(b.projectId)?.name} · ${money(b.total)}`,"billing",["ceo"]));
  DB.daily.filter(d=>d.status!=="מאושר" && d.date < today()).forEach(d => add("low",`יומן עבודה ${fmtDate(d.date)} לא אושר — ${P(d.projectId)?.name}`,"","daily",M));
  const order = {high:0,mid:1,low:2};
  return F.filter(f => f.roles.includes(S.user.role)).sort((a,b)=>order[a.lvl]-order[b.lvl]);
}

/* ------------------------------ ממשק כללי ------------------------------ */
function toast(msg, type = "success"){
  const t = document.createElement("div"); t.className = `toast ${type}`; t.textContent = msg;
  $("toasts").appendChild(t); setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(()=>t.remove(), 300); }, 3500);
}
function openModal(html, wide){
  $("modal").classList.remove("hidden"); $("modalCard").classList.toggle("wide", !!wide);
  $("modalContent").innerHTML = html; $("modalCard").scrollTop = 0;
  const f = $("modalContent").querySelector("input:not([type=file]):not([type=checkbox]),select,textarea"); if (f && window.innerWidth > 720) f.focus();
}
function closeModal(){ $("modal").classList.add("hidden"); $("modalContent").innerHTML = ""; S.draft = {}; if (typeof CLOUD !== "undefined" && CLOUD.pendingRender){ CLOUD.pendingRender = false; render(); } }
function guard(action){ if (!can(action)){ toast("אין לך הרשאה לפעולה זו","danger"); return false; } return true; }

/* חתימה דיגיטלית */
function sigPad(id){
  const c = $(id); if (!c) return; const ctx = c.getContext("2d"); let draw = false, dirty = false;
  const fit = () => { const r = c.getBoundingClientRect(); c.width = r.width; c.height = 140; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#0f172a"; };
  fit();
  const pos = e => { const r = c.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return [p.clientX - r.left, p.clientY - r.top]; };
  const start = e => { draw = true; dirty = true; ctx.beginPath(); ctx.moveTo(...pos(e)); e.preventDefault(); };
  const move = e => { if (!draw) return; ctx.lineTo(...pos(e)); ctx.stroke(); e.preventDefault(); };
  const end = () => draw = false;
  c.addEventListener("mousedown",start); c.addEventListener("mousemove",move); window.addEventListener("mouseup",end);
  c.addEventListener("touchstart",start,{passive:false}); c.addEventListener("touchmove",move,{passive:false}); c.addEventListener("touchend",end);
  c._clear = () => { ctx.clearRect(0,0,c.width,c.height); dirty = false; };
  c._get = () => dirty ? c.toDataURL("image/png") : null;
}
function sigBlock(id){ return `<div class="full"><label>חתימה דיגיטלית *</label><canvas id="${id}" class="sig"></canvas><button type="button" class="small" onclick="$('${id}')._clear()">נקה חתימה</button></div>`; }

/* ייצוא טבלה ל-Excel (CSV עם BOM לעברית) */
function exportTable(tableId, name){
  const tb = $(tableId); if (!tb) return;
  const rows = [...tb.querySelectorAll("tr")].map(tr => [...tr.children].filter(c => !c.classList.contains("noexp")).map(c => '"' + c.innerText.replace(/"/g,'""').replace(/\n/g," ") + '"').join(","));
  downloadBlob("﻿" + rows.join("\r\n"), `${name}-${today()}.csv`, "text/csv;charset=utf-8");
  toast("הקובץ ירד — ניתן לפתוח ב-Excel");
}
function downloadBlob(content, filename, type){
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content],{type})); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function printHTML(html){ $("printArea").innerHTML = html; window.print(); }

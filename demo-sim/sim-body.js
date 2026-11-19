/* ===== INDIX company simulation — runs after core.js in the same scope ===== */
// ---------- deterministic RNG ----------
let __s = 1598;
function rnd(){ __s |= 0; __s = __s + 0x6D2B79F5 | 0; let t = Math.imul(__s ^ __s >>> 15, 1 | __s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const R = (a,b) => a + rnd()*(b-a);
const RI = (a,b) => Math.floor(R(a,b+1));
const pick = arr => arr[Math.floor(rnd()*arr.length)];
const chance = p => rnd() < p;

// ---------- clock ----------
function at(date, hh, mm){ __setSim(date, hh, mm||0); }
function as(uid){ S.user = U(uid); }
function dow(date){ return new __RealDate(date + "T12:00:00").getDay(); } // 0=Sun
const isWorkday = d => dow(d) <= 4; // Sun-Thu
function nextDays(from, to){ const out = []; let d = from; while (d <= to){ out.push(d); d = addDays(1, d + "T12:00:00"); } return out; }
function addWorkdays(date, n){ let d = date, k = 0; while (k < n){ d = addDays(1, d + "T12:00:00"); if (isWorkday(d)) k++; } return d; }

// ---------- tiny SVG assets ----------
const svgURI = s => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
const PHOTO_BG = {dig:"#8b6b4a", pole:"#7a8ea8", fixture:"#3b4a63", cable:"#6b5a48", cabinet:"#5e6e7e", signal:"#4a5a4a", other:"#666"};
function sitePhoto(type, label, dark){
  const bg = dark ? "#151515" : PHOTO_BG[type] || "#666";
  const sky = dark ? "#0b0b14" : "#9cc8ec";
  const objs = {
    dig:`<path d="M0 150 L320 140 L320 240 L0 240Z" fill="#6b4b2c"/><path d="M40 175 L290 168 L290 190 L40 198Z" fill="#3a2614"/><rect x="230" y="110" width="60" height="30" fill="#e8b200"/><rect x="250" y="95" width="25" height="18" fill="#e8b200"/>`,
    pole:`<rect x="150" y="30" width="10" height="190" fill="#b8c0c8"/><rect x="155" y="30" width="60" height="6" fill="#b8c0c8"/><rect x="205" y="34" width="22" height="8" fill="#eee"/>`,
    fixture:`<rect x="100" y="40" width="8" height="180" fill="#9aa"/><rect x="104" y="40" width="70" height="5" fill="#9aa"/><ellipse cx="180" cy="48" rx="18" ry="6" fill="#fff6b0"/>`,
    cable:`<path d="M0 190 C80 170 160 210 320 180" stroke="#111" stroke-width="8" fill="none"/><circle cx="60" cy="150" r="28" fill="none" stroke="#222" stroke-width="10"/>`,
    cabinet:`<rect x="120" y="90" width="80" height="120" fill="#c9ced3" stroke="#555"/><rect x="128" y="100" width="64" height="40" fill="#ddd"/><text x="140" y="180" font-size="14" fill="#c00">⚡</text>`,
    signal:`<rect x="150" y="40" width="10" height="180" fill="#444"/><rect x="160" y="40" width="34" height="86" rx="6" fill="#222"/><circle cx="177" cy="58" r="9" fill="#e33"/><circle cx="177" cy="83" r="9" fill="#a80"/><circle cx="177" cy="108" r="9" fill="#2c4"/>`,
    other:`<rect x="110" y="110" width="100" height="90" fill="#999"/>`
  };
  return svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="${sky}"/><rect y="140" width="320" height="100" fill="${bg}"/>${objs[type]||objs.other}<rect y="214" width="320" height="26" fill="#0008"/><text x="8" y="232" font-family="Arial" font-size="13" fill="#fff">${esc(label)}</text></svg>`);
}
function signature(name){
  const k = [...name].reduce((a,c)=>a+c.charCodeAt(0),0);
  const pts = Array.from({length:7},(_,i)=>`${20+i*38} ${60 + ((k*(i+3))%50) - 25}`).join(" L");
  return svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120"><path d="M${pts}" stroke="#0f172a" stroke-width="3" fill="none" stroke-linecap="round"/><text x="20" y="110" font-family="Arial" font-size="12" fill="#475569">${esc(name)}</text></svg>`);
}
function planSVG(title, sub, kind){
  const roads = kind === "junctions"
    ? `<path d="M0 300 H1000" stroke="#475569" stroke-width="50"/><path d="M250 0 V600" stroke="#64748b" stroke-width="40"/><path d="M520 0 V600" stroke="#64748b" stroke-width="40"/><path d="M800 0 V600" stroke="#64748b" stroke-width="40"/>`
    : kind === "grid"
    ? `<path d="M0 150 H1000 M0 320 H1000 M0 480 H1000" stroke="#94a3b8" stroke-width="26"/><path d="M200 100 V600 M480 100 V600 M760 100 V600" stroke="#94a3b8" stroke-width="22"/>`
    : kind === "industrial"
    ? `<rect x="120" y="140" width="220" height="140" fill="#e2e8f0" stroke="#94a3b8"/><rect x="420" y="140" width="260" height="140" fill="#e2e8f0" stroke="#94a3b8"/><rect x="120" y="360" width="560" height="160" fill="#e2e8f0" stroke="#94a3b8"/><path d="M0 320 H1000 M370 100 V600 M730 100 V600" stroke="#64748b" stroke-width="30"/>`
    : `<path d="M0 360 C250 320 520 300 1000 250" stroke="#475569" stroke-width="64" fill="none"/><path d="M0 360 C250 320 520 300 1000 250" stroke="#fff" stroke-width="3" stroke-dasharray="25 20" fill="none"/>`;
  return svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600" viewBox="0 0 1000 600"><rect width="1000" height="600" fill="#f8fafc"/><g stroke="#e2e8f0">${Array.from({length:20},(_,i)=>`<line x1="${i*50}" y1="0" x2="${i*50}" y2="600"/>`).join("")}</g>${roads}<text x="30" y="44" font-family="Arial" font-size="26" font-weight="bold" fill="#0f172a">${esc(title)}</text><text x="30" y="74" font-family="Arial" font-size="16" fill="#475569">${esc(sub)}</text></svg>`);
}

// ---------- company setup ----------
const COMPANY = "אופק תשתיות וחשמל בע״מ (חברת הדגמה)";
const DOMAIN = "indix-demo.com";
DB = { ver:DB_VER, seq:1000, settings:{ company:COMPANY }, customMaterials:{} };
["users","projects","boq","tasks","reports","daily","plans","stock","movements","suppliers","requests","bills","tenders","meetings","docs","notes","audit"].forEach(c => DB[c] = []);
DB.seq = 1000;

const START = "2026-08-30", END = "2026-11-20";
at(START, 7, 30);

const USERS = [
  [1,"Claude — מנכ״ל","ceo","ceo","all",""],
  [2,"סאמי חדאד — מהנדס ראשי","engineer","sami","all","052-4410201"],
  [3,"רנא חורי — מהנדסת ביצוע","engineer","rana",[20,22],"052-4410202"],
  [4,"מוחמד ח׳טיב","worker","mohammad",[20,23],"050-7310104"],
  [5,"יוסף עבאס","worker","yousef",[20,22],"050-7310105"],
  [6,"איתי לוי","worker","itai",[22],"050-7310106"],
  [7,"ח׳אלד נסאר","worker","khaled",[21,22,23],"050-7310107"],
  [8,"עאמר גנאים — ע.ג חשמל (קבלן)","contractor","amer",[20,22,23],"054-6620108"],
  [9,"פאדי זועבי — רמזורי הגליל (קבלן)","contractor","fadi",[21],"054-6620109"],
  [10,"מאיה רוזן — רכש","purchasing","maya","all","053-2290110"],
  [11,"ג׳ורג׳ שחאדה — מחסן","storekeeper","george","all","053-2290111"]
];
DB.users = USERS.map(([id,name,role,mail,projects,phone]) => ({id,name,role,pin:"1598",email:`${mail}@${DOMAIN}`,phone,active:true,projects}));
const CEO=1, ENG1=2, ENG2=3, STORE=11, BUY=10;

as(CEO);
audit("הקמת החברה במערכת", COMPANY);
DB.users.slice(1).forEach(u => audit("משתמש חדש", `${u.name} — ${ROLES[u.role]}`));

// suppliers
const SUP = [
  ["אלקטרה כבלים","אבי מזרחי","04-8550101",{cable:54,conduit:8.8}],
  ["בליסט ציוד חשמל","רונית כץ","03-5120202",{cable:56.5,fixture:572,conduit:8.2,cabinet:13900}],
  ["אור-LED תאורה","עלי סעדי","04-6080303",{fixture:548}],
  ["עמודי הצפון","יוסי פרץ","04-9880404",{pole:598,cabinet:13350}],
  ["רמזורי ישראל","גלית שגיא","08-9170505",{signal:9650}],
  ["ספק כללי — חשמל הגליל","נביל עודה","04-6560606",{cable:57.2,fixture:590,pole:615,conduit:9.1,signal:9900}]
];
SUP.forEach(([name,contact,phone,prices]) => { DB.suppliers.push({id:nid(),name,contact,phone,prices}); audit("ספק חדש", name); });
const supId = n => DB.suppliers.find(s=>s.name===n).id;

// stock
[["cable",2600,1500],["fixture",110,60],["pole",58,30],["conduit",900,400],["cabinet",1,2],["signal",4,6]].forEach(([mat,qty,min]) => DB.stock.push({id:nid(),mat,qty,min,location:"מחסן מרכזי — כפר כנא"}));

// projects
const PROJ = [];
function addProject(p, lines, crew){
  as(CEO); p.id = p.id || nid(); DB.projects.push(p); audit("יצירת פרויקט", p.name);
  lines.forEach(([type,qty,base,sale,cost,item,unit]) => DB.boq.push({id:nid(),projectId:p.id,type,item:item||WORK[type].name,unit:unit||WORK[type].unit,qty,base,sale,cost}));
  const est = lines.reduce((a,l)=>a+l[1]*l[4],0); p.budget = Math.round(est*1.04/1000)*1000;
  audit("כתב כמויות נטען", `${p.name}: ${lines.length} סעיפים`);
  PROJ.push({p, crew});
  return p;
}
addProject({id:20,name:"כביש 70 — שדרוג תאורה (יוקנעם–כבול)",client:"נתיבי ישראל",status:"פעיל",managerId:ENG1,lat:32.7020,lng:35.1080,start:"2026-08-02",end:"2027-01-31",budget:0},
  [["dig",6000,1800,44,31],["pole",260,60,870,625],["fixture",260,40,790,565],["cable",7000,1500,76,55],["cabinet",4,0,18500,13600]],
  {dig:[4,5],pole:[4,5],fixture:[5],cable:[8],cabinet:[8]});
addProject({id:21,name:"רמזורים — 3 צמתים, טמרה",client:"עיריית טמרה",status:"פעיל",managerId:ENG2,lat:32.8536,lng:35.1979,start:"2026-09-06",end:"2026-12-31",budget:0},
  [["dig",900,0,48,34],["cable",1800,0,78,57],["signal",12,0,24000,17500,"רמזור צומת (ראש + עמוד + חיבור)"],["other",3,0,42000,31000,"בקר רמזורים לצומת + תכנות","יח׳"]],
  {dig:[7],cable:[9],signal:[9],other:[9]});
addProject({id:22,name:"תאורת שכונה חדשה — שפרעם מערב",client:"עיריית שפרעם",status:"פעיל",managerId:ENG2,lat:32.8059,lng:35.1700,start:"2026-09-13",end:"2027-02-28",budget:0},
  [["dig",3200,0,45,32],["pole",140,0,880,630],["fixture",140,0,800,570],["cable",3800,0,77,56],["cabinet",2,0,18500,13600]],
  {dig:[6,7],pole:[6],fixture:[6,5],cable:[8],cabinet:[8]});

// tenders (initial)
function addTender(name, client, due, status, markup, lines){ as(ENG1); const t = {id:nid(),name,client,due,status,markup,lines}; DB.tenders.push(t); audit("מכרז חדש", `${name}: ${money(tenderCalc(t).price)}`); return t; }
const tenderCalc = t => { let cost=0, price=0; t.lines.forEach(l => { const uc = l.sub>0?l.sub:l.cost; cost += uc*l.qty; price += Math.round(uc*(1+t.markup/100)*100)/100*l.qty; }); return {cost,price}; };
const TB = addTender("תשתיות חשמל — אזור תעשייה בר-לב","מבני תעשייה בע״מ","2026-09-24","בהכנה",21,
  [{type:"dig",qty:2500,cost:31,sub:0},{type:"cable",qty:3000,cost:55,sub:53},{type:"pole",qty:80,cost:620,sub:0},{type:"fixture",qty:80,cost:560,sub:0},{type:"cabinet",qty:2,cost:13500,sub:0}]);
const TM = addTender("תאורת שכונת אל-מטל, נצרת","עיריית נצרת","2026-10-08","בהכנה",24,
  [{type:"dig",qty:4200,cost:32,sub:0},{type:"pole",qty:190,cost:625,sub:0},{type:"fixture",qty:190,cost:565,sub:0},{type:"cable",qty:5000,cost:56,sub:0}]);

// docs & plans
function addDoc(projectId, name, cat, by){ DB.docs.push({id:nid(),projectId,name,cat,size:RI(80,900)*1024,data:null,by,at:new Date().toISOString()}); as(by); audit("העלאת מסמך", name); }
addDoc(20,"חוזה — כביש 70 תאורה.pdf","חוזה",CEO);
addDoc(21,"חוזה — רמזורים טמרה.pdf","חוזה",CEO);
addDoc(22,"חוזה — תאורת שפרעם מערב.pdf","חוזה",CEO);
addDoc(null,"נוהל עבודה בגובה — חברה.pdf","בטיחות",CEO);
addDoc(null,"ביטוח קבלנים 2026.pdf","אישור",CEO);
function addPlan(pid, name, kind, by){
  const pl = {id:nid(),projectId:pid,name,version:"1",status:"מאושר",img:planSVG(name,"קנ״מ 1:500 · "+COMPANY,kind),fileName:name.replace(/\s+/g,"-")+".svg",marks:[],uploadedBy:by,at:new Date().toISOString()};
  DB.plans.push(pl); as(by); audit("העלאת תוכנית", `${name} גרסה 1`); return pl;
}
const PLANS = { 20:addPlan(20,"כביש 70 — תוכנית תאורה","road",ENG1), 21:addPlan(21,"טמרה — 3 צמתים מרומזרים","junctions",ENG2), 22:addPlan(22,"שפרעם מערב — רשת תאורה","grid",ENG2) };

// ---------- state helpers ----------
const projOf = id => PROJ.find(x => x.p.id === id);
const engOf = pid => P(pid).managerId;
const matIssued = new Set(); // taskIds that got their material
const ISSUES = ["נתקלנו בצנרת מים לא מסומנת — עצרנו לבירור","עיכוב של שעתיים — המתנה לפקח תנועה","גשם בצהריים, עבודה הופסקה מוקדם","קרקע סלעית — התקדמות איטית","פגיעה בכבל תקשורת קיים — דווח לבזק","תושב חסם גישה לשטח, טופל מול העירייה"];
const NOTES_OK = ["העבודה התקדמה לפי התוכנית","בוצע לפי סימון","נבדק ותקין","סיימנו קטע, ממשיכים מחר","כולל ניקוי שטח בסוף היום",""];
const STAGES = ["התחלה","התקדמות","התקדמות","התקדמות","סיום"];
const LOC = {dig:["קטע צפוני","קטע דרומי","ציר ראשי","רחוב 3","רחוב 7","צומת מערבי"],pole:["צד מזרחי","צד מערבי","מעגל תנועה","רחוב 5"],fixture:["צד מזרחי","צד מערבי","רחוב 2"],cable:["קטע א׳","קטע ב׳","קטע ג׳"],cabinet:["מרכזייה 1","מרכזייה 2","מרכזייה 3","מרכזייה 4"],signal:["צומת הכניסה","צומת המסגד","צומת בית הספר"],other:["צומת הכניסה","צומת המסגד","צומת בית הספר"]};
const CHUNK = {dig:600,cable:1200,pole:16,fixture:24,cabinet:1,signal:4,other:1};
const PROD = {dig:[0.45,0.85],cable:[0.5,0.9],pole:[0.45,0.85],fixture:[0.5,0.9],cabinet:[0.4,0.6],signal:[0.5,0.7],other:[0.5,0.5]};

function allowedQty(pid, type){
  // dependencies between work types (field logic)
  const L = projectBoq(pid), line = L.find(b=>b.type===type); if (!line) return 0;
  const frac = t => { const b = L.find(x=>x.type===t); return b ? boqDone(b)/b.qty : 1; };
  let f = 1;
  if (type==="cable") f = Math.min(1, frac("dig") + 0.05);
  if (type==="pole") f = Math.min(1, frac("dig") + 0.1);
  if (type==="fixture") f = Math.min(1, frac("pole"));
  if (type==="cabinet") f = frac("cable") > 0.55 ? (frac("cable") > 0.9 ? 1 : 0.5) : 0;
  if (type==="signal") f = frac("dig") > 0.4 ? Math.min(1, frac("dig")) : 0;
  if (type==="other") f = frac("signal") >= 0.3 ? Math.min(1, frac("signal")+0.1) : 0;
  const assigned = DB.tasks.filter(t=>t.boqId===line.id).reduce((a,t)=>a+t.qty,0) + line.base;
  return Math.max(0, Math.floor(line.qty*f - assigned));
}
function openTaskOf(uid, pid){ return DB.tasks.find(t => t.assigneeId===uid && t.projectId===pid && t.status!=="הושלם"); }
function anyOpenTask(uid){ return DB.tasks.filter(t => t.assigneeId===uid && t.status!=="הושלם"); }

function createTask(pid, type, uid, day){
  const line = projectBoq(pid).find(b=>b.type===type);
  const q = Math.min(CHUNK[type], allowedQty(pid, type)); if (q <= 0) return null;
  const eng = engOf(pid); as(eng);
  const days = Math.max(1, Math.ceil(q / (WORK[type].daily*0.65)));
  const loc = pick(LOC[type]);
  const title = `${line.item} — ${num(q)} ${line.unit} · ${loc}`;
  const t = {id:nid(),projectId:pid,boqId:line.id,title,qty:q,assigneeId:uid,location:loc,due:addWorkdays(day,days+1),status:"חדש",notes:pick(["","לעבוד לפי סימון בתוכנית","לתאם סגירת נתיב מראש","עומק חפירה 80 ס״מ","לצלם כל עמוד אחרי העמדה"]),createdBy:eng};
  DB.tasks.push(t); audit("יצירת משימה", `${title} → ${U(uid).name}`);
  notify(`משימה חדשה: ${title}`, {userId:uid, module:"tasks"});
  // mark on plan
  const pl = PLANS[pid]; if (pl && pl.marks.length < 14) pl.marks.push({x:RI(8,92),y:RI(18,88),type,taskId:t.id,note:loc});
  if (!WORK[type].mat) matIssued.add(t.id);
  return t;
}

// ---------- purchasing ----------
function purchasedFor(pid, mat){ return DB.requests.filter(r=>r.projectId===pid && r.mat===mat && r.status!==REQ.REJECTED).reduce((a,r)=>a+r.qty,0); }
function openReqFor(mat, pid){ return DB.requests.some(r => r.mat===mat && r.projectId===pid && [REQ.WAIT_CEO,REQ.APPROVED,REQ.ORDERED].includes(r.status)); }
function makeRequest(uid, pid, mat, qty, reason, day){
  as(uid);
  const c = checkRequest(pid, mat, qty);
  const r = {id:nid(),date:day,needBy:addWorkdays(day,5),projectId:pid,mat,qty,reason,status:c.over?REQ.WAIT_CEO:REQ.APPROVED,over:c.over,overMsg:c.overMsg,requestedBy:uid,supplierId:null,price:null};
  DB.requests.push(r); audit("דרישת רכש", `${r.id}: ${matName(mat)} ${qty}${c.over?" (חריגה)":""}`);
  if (c.over) notify(`דרישת רכש ${r.id} (${P(pid)?.name}) חורגת: ${c.overMsg}`, {roles:["ceo"], module:"purchasing"});
  else notify(`דרישת רכש ${r.id} מאושרת וממתינה להזמנה: ${matName(mat)} ${num(qty)}`, {roles:["purchasing"], module:"purchasing"});
  return r;
}
function ceoDecideSim(r, ok, why){
  as(CEO); r.status = ok ? REQ.APPROVED : REQ.REJECTED; r.approvedBy = CEO; if (!ok) r.rejectReason = why;
  audit(ok?"אישור חריגת רכש":"דחיית דרישת רכש", `${r.id}`);
  notify(ok ? `דרישה ${r.id} אושרה ע״י המנכ״ל — ניתן להזמין` : `דרישה ${r.id} נדחתה: ${why}`, {roles: ok?["purchasing"]:[], userId:r.requestedBy, module:"purchasing"});
}
function orderSim(r, day){
  as(BUY);
  const offers = DB.suppliers.filter(s => s.prices?.[r.mat]).sort((a,b)=>a.prices[r.mat]-b.prices[r.mat]);
  const s = offers[0]; const eta = addWorkdays(day, RI(2,5));
  Object.assign(r, {supplierId:s.id, price:s.prices[r.mat], eta, status:REQ.ORDERED, orderedBy:BUY, orderedAt:day});
  audit("הזמנת רכש", `${r.id} מ${s.name} — ${money(r.price*r.qty)}`);
  notify(`הזמנה ${r.id} בדרך למחסן: ${matName(r.mat)} ${num(r.qty)} (צפי ${fmtDate(eta)})`, {roles:["storekeeper"], module:"warehouse"});
}
function receiveSim(r, day){
  as(STORE);
  const q = chance(0.12) ? Math.round(r.qty*R(0.85,0.95)) : r.qty;
  const s = stockOf(r.mat); s.qty += q;
  const dn = "ת״מ " + RI(30000,89999);
  DB.movements.push({id:nid(),at:new Date().toISOString(),type:"in",mat:r.mat,qty:q,projectId:null,toUserId:null,userId:STORE,note:`קליטת הזמנה ${r.id} · ${dn}`,signature:signature(U(STORE).name),img:null,refReq:r.id});
  Object.assign(r, {status:REQ.SUPPLIED, suppliedAt:day, receivedQty:q, receivedBy:STORE});
  if (q !== r.qty) notify(`הזמנה ${r.id}: התקבלו ${num(q)} מתוך ${num(r.qty)} — יש לבדוק מול הספק`, {roles:["purchasing","ceo"], module:"purchasing"});
  else notify(`הזמנה ${r.id} נקלטה במחסן (${matName(r.mat)} ${num(q)})`, {roles:["purchasing"], userId:r.requestedBy, module:"warehouse"});
  audit("קליטת משלוח", `${r.id}: ${q}`);
  DB.docs.push({id:nid(),projectId:r.projectId,name:`תעודת משלוח ${dn.replace("ת״מ ","")} — ${matName(r.mat)}.jpg`,cat:"תעודת משלוח",size:RI(150,600)*1024,data:null,by:STORE,at:new Date().toISOString()});
}
function issueSim(t){
  const mat = WORK[B(t.boqId).type].mat, s = stockOf(mat);
  if (!s || s.qty < t.qty) return false;
  as(STORE); s.qty -= t.qty;
  DB.movements.push({id:nid(),at:new Date().toISOString(),type:"out",mat,qty:t.qty,projectId:t.projectId,toUserId:t.assigneeId,userId:STORE,note:`ניפוק למשימה: ${t.title}`,signature:signature(U(t.assigneeId).name),img:null,refReq:null});
  audit("ניפוק מלאי", `${matName(mat)} ${t.qty} → ${P(t.projectId).name}`);
  if (s.qty < s.min) notify(`מלאי נמוך: ${matName(mat)} (${num(s.qty)})`, {roles:["purchasing","ceo"], module:"warehouse"});
  matIssued.add(t.id); return true;
}

// ---------- field reports ----------
function jitter(p, m){ const d = m/111000; return {lat:+(p.lat + R(-d,d)).toFixed(6), lng:+(p.lng + R(-d,d)).toFixed(6)}; }
function fieldReport(t, day){
  const uid = t.assigneeId, type = B(t.boqId).type, p = P(t.projectId);
  const remain = t.qty - taskDone(t) - taskPending(t); if (remain <= 0) return null;
  let qty = Math.max(1, Math.round(WORK[type].daily * R(...PROD[type])));
  if (type==="cabinet" || type==="other") qty = 1;
  qty = Math.min(qty, remain);
  let gps = {...jitter(p, 350), acc:RI(5,25)}, bright = RI(110,190), dark = false, note = pick(NOTES_OK), inflated = false;
  const roll = rnd();
  if (roll < 0.035){ gps = null; }
  else if (roll < 0.055){ gps = {...jitter({lat:p.lat+0.14,lng:p.lng+0.05}, 200), acc:RI(8,20)}; }  // reported from far away
  else if (roll < 0.085){ bright = RI(22,40); dark = true; }
  if (chance(0.04) && remain > qty*1.3){ qty = Math.min(remain, Math.round(qty*1.6)); inflated = true; }
  if (chance(0.09)) note = pick(ISSUES);
  if (t.status === "חדש"){ as(uid); t.status = "בביצוע"; t.startedAt = new Date().toISOString(); audit("התחלת משימה", t.title); }
  at(day, RI(14,16), RI(0,59)); as(uid);
  const r = {id:nid(),taskId:t.id,boqId:t.boqId,projectId:t.projectId,userId:uid,date:day,at:new Date().toISOString(),qty,qtyReported:qty,
    stage: taskDone(t)+qty >= t.qty ? "סיום" : (taskDone(t)===0 ? "התחלה" : "התקדמות"), note, photo:sitePhoto(type, `${p.name.split(" — ")[0]} · ${fmtDate(day)}`, dark), bright, gps, status:"pending"};
  r._inflated = inflated;
  const a = analyzeReport(r);
  DB.reports.push(r); t.status = "ממתין לאישור";
  if (!DB.daily.some(d => d.projectId===t.projectId && d.date===day)) DB.daily.push({id:nid(),projectId:t.projectId,date:day,notes:"",issues:"",weather:"",status:"ממתין לאישור מהנדס",approvedBy:null});
  audit("דיווח שטח", `${t.title}: ${qty}`);
  notify(`דיווח שטח חדש מ${U(uid).name}: ${t.title} — ${num(qty)} (AI ${a.score})`, {roles:["engineer","ceo"], module:"fieldAI"});
  return r;
}
function engineerDecide(r){
  const t = T(r.taskId); as(engOf(r.projectId));
  const a = analyzeReport(r);
  const far = a.flags.some(f => f[0]==="high" && f[1].includes("רחוק"));
  if (far){
    r.status = "rejected"; r.approvedBy = S.user.id; r.decidedAt = new Date().toISOString(); r.decisionNote = "המיקום לא תואם לאתר — לדווח מחדש מהשטח עם GPS פעיל";
    if (t.status==="ממתין לאישור" && !taskPending(t)) t.status = "בביצוע";
    audit("דחיית דיווח שטח", `#${r.id}: ${r.decisionNote}`); notify(`הדיווח שלך נדחה: ${t.title} — ${r.decisionNote}`, {userId:r.userId, module:"fieldAI"});
    return;
  }
  let q = r.qtyReported, note = "";
  if (r._inflated){ q = Math.round(r.qtyReported/1.6); note = `הכמות תוקנה מ-${r.qtyReported} ל-${q} לפי מדידה בשטח`; }
  else if (!r.photo || r.bright < 45) note = "אושר לאחר בדיקה טלפונית — בפעם הבאה לצלם באור יום";
  else if (!r.gps) note = "אושר — המהנדס היה באתר. נא להפעיל GPS";
  r.qty = q; r.status = "approved"; r.approvedBy = S.user.id; r.decidedAt = new Date().toISOString(); r.decisionNote = note;
  t.status = taskDone(t) >= t.qty ? "הושלם" : (taskPending(t) ? "ממתין לאישור" : "בביצוע");
  if (t.status === "הושלם") t.completedAt = new Date().toISOString();
  audit("אישור דיווח שטח", `#${r.id} ${t.title}: ${q}`);
  notify(`הדיווח שלך אושר: ${t.title} — ${num(q)}`, {userId:r.userId, module:"fieldAI"});
}
const WEATHER_SEPT = ["בהיר וחם","בהיר","חם, 33°","בהיר, רוח קלה"], WEATHER_NOV = ["מעונן חלקית","בהיר","גשם קל בבוקר","מעונן","בהיר וקריר"];
function approveDaily(pid, day){
  const m = DB.daily.find(d => d.projectId===pid && d.date===day); if (!m || m.status==="מאושר") return;
  if (DB.reports.some(r => r.projectId===pid && r.date===day && r.status==="pending")) return;
  as(engOf(pid));
  const reps = DB.reports.filter(r => r.projectId===pid && r.date===day && r.status==="approved");
  const issues = DB.reports.filter(r => r.projectId===pid && r.date===day && ISSUES.includes(r.note)).map(r=>r.note);
  m.weather = pick(day < "2026-10-15" ? WEATHER_SEPT : WEATHER_NOV);
  m.issues = issues.join(" · ");
  m.notes = reps.length ? `עבדו ${new Set(reps.map(r=>r.userId)).size} צוותים. ` + reps.map(r=>`${B(r.boqId).item}: ${num(r.qty)} ${B(r.boqId).unit}`).join(", ") + "." : "אין ביצוע מאושר ליום זה.";
  m.status = "מאושר"; m.approvedBy = S.user.id;
  audit("אישור יומן עבודה", `${P(pid)?.name} ${day}`);
}

// ---------- billing ----------
function billLinesFor(pid){
  const prev = DB.bills.filter(b => b.projectId===+pid && b.status!=="טיוטה").sort((a,b)=>b.id-a.id)[0];
  return projectBoq(pid).map(b => { const pc = prev?.lines.find(l=>l.boqId===b.id)?.cum || b.base*0; const cum = boqDone(b); return {boqId:b.id,item:b.item,unit:b.unit,prevCum:pc,cum,price:b.sale}; });
}
function createBillSim(pid, day, by){
  as(by);
  const lines = billLinesFor(pid), total = lines.reduce((a,l)=>a+(l.cum-l.prevCum)*l.price,0); if (total <= 0) return null;
  const b = {id:nid(),projectId:pid,period:day.slice(0,7),date:day,lines,total,status:"טיוטה",createdBy:by};
  DB.bills.push(b); audit("הפקת טיוטת חשבון", `${P(pid)?.name}: ${money(total)}`); return b;
}
function setBill(b, s, day){ as(s==="שולם"?CEO:engOf(b.projectId)); b.status = s; b[s==="שולם"?"paidAt":"sentAt"] = day; audit(`חשבון ${s}`, `${b.id} · ${money(b.total)}`);
  if (s==="נשלח") DB.docs.push({id:nid(),projectId:b.projectId,name:`חשבון חלקי ${b.id} — ${b.period}.pdf`,cat:"חשבון",size:RI(90,200)*1024,data:null,by:CEO,at:new Date().toISOString()}); }
// Project 20 started before the system: opening bill for the base quantities (paid in August)
(function(){ const pid = 20; at("2026-08-30",9,0); as(CEO);
  const lines = projectBoq(pid).map(b=>({boqId:b.id,item:b.item,unit:b.unit,prevCum:0,cum:b.base,price:b.sale}));
  DB.bills.push({id:nid(),projectId:pid,period:"2026-08",date:"2026-08-30",lines,total:lines.reduce((a,l)=>a+l.cum*l.price,0),status:"שולם",createdBy:CEO,sentAt:"2026-08-30",paidAt:"2026-08-30"});
  audit("חשבון פתיחה (עבודה שבוצעה לפני INDIX)", P(pid).name); })();

// ---------- meetings ----------
function meeting(pid, day, time, title, participants, summary, decisions, by){
  as(by||CEO); DB.meetings.push({id:nid(),projectId:pid,date:day,time,title,participants,summary,decisions:decisions.map(text=>({text,taskId:null}))});
  audit("פגישה חדשה", title);
}

// =================== main loop ===================
const days = nextDays("2026-08-31", END);
let p4created = false;
for (const day of days){
  const wd = isWorkday(day), d = dow(day);
  const isToday = day >= "2026-11-19";

  // --- scripted company events ---
  if (day === "2026-09-01"){ at(day,10,0); meeting(null,day,"10:00","ישיבת פתיחה — מעבר החברה ל-INDIX","Claude, סאמי חדאד, רנא חורי, מאיה רוזן, ג׳ורג׳ שחאדה","כל הדיווחים מהשטח עוברים לאפליקציה עם תמונה ו-GPS. חשבונות יוגשו רק לפי כמויות מאושרות.",["כל עובד מדווח בסוף כל יום עבודה","המהנדסים מאשרים דיווחים עד 10:00 למחרת","רכש רק דרך דרישה במערכת"]); }
  if (day === "2026-09-06"){ at(day,8,0); addDoc(21,"היתר עבודה — משטרת התנועה טמרה.pdf","אישור",ENG2); }
  if (day === "2026-09-13"){ at(day,8,0); addDoc(22,"תיאום תשתיות — חברת חשמל.pdf","אישור",ENG2); }
  if (day === "2026-09-22"){ at(day,12,0); as(ENG1); TB.status = "הוגש"; audit("סטטוס מכרז", `${TB.name}: הוגש`); }
  if (day === "2026-10-06"){ at(day,12,0); as(ENG1); TM.status = "הוגש"; audit("סטטוס מכרז", `${TM.name}: הוגש`); }
  if (day === "2026-10-15"){ at(day,11,0); as(CEO); TB.status = "זכינו"; audit("סטטוס מכרז", `${TB.name}: זכינו`); notify(`זכינו במכרז: ${TB.name} 🎉`, {roles:["ceo","engineer"], module:"tenders"}); }
  if (day === "2026-10-20"){ at(day,11,0); as(CEO); TM.status = "הפסדנו"; TM.lostNote = "הצעה זולה ב-6% מהזוכה"; audit("סטטוס מכרז", `${TM.name}: הפסדנו`); }
  if (day === "2026-10-21" && !p4created){
    at(day,9,0); as(CEO);
    const c = tenderCalc(TB);
    const p = {id:23,name:TB.name,client:TB.client,status:"פעיל",managerId:ENG1,lat:32.9310,lng:35.2260,start:"2026-10-25",end:"2027-03-31",budget:Math.round(c.cost)};
    DB.projects.push(p); TB.projectId = p.id;
    TB.lines.forEach(l => { const uc = l.sub>0?l.sub:l.cost; DB.boq.push({id:nid(),projectId:p.id,type:l.type,item:WORK[l.type].name,unit:WORK[l.type].unit,qty:l.qty,base:0,sale:Math.round(uc*(1+TB.markup/100)*100)/100,cost:uc}); });
    audit("פרויקט נוצר ממכרז", TB.name);
    PROJ.push({p, crew:{dig:[4,7],cable:[8],pole:[4],fixture:[4],cabinet:[8]}});
    addDoc(23,"חוזה — אזור תעשייה בר-לב.pdf","חוזה",CEO);
    PLANS[23] = addPlan(23,"בר-לב — תשתית חשמל ותאורה","industrial",ENG1);
    meeting(23,day,"09:00","פגישת התנעה — בר-לב","Claude, סאמי חדאד, נציג מבני תעשייה","הוצג לוח זמנים: חפירה מ-25/10, חשמל מנובמבר.",["לפתוח הזמנת עמודים מראש","סאמי מנהל פרויקט"]);
    p4created = true;
  }
  if (day === "2026-11-10"){ at(day,10,0); addTender("רמזורים — צומת המוביל","מועצה אזורית עמק יזרעאל","2026-11-12","בהכנה",23,[{type:"dig",qty:350,cost:34,sub:0},{type:"cable",qty:700,cost:57,sub:0},{type:"signal",qty:4,cost:17500,sub:16800}]); }
  if (day === "2026-11-12"){ at(day,12,0); as(ENG2); const t = DB.tenders.find(x=>x.name.includes("המוביל")); t.status = "הוגש"; audit("סטטוס מכרז", `${t.name}: הוגש`); }
  if (day === "2026-11-17"){ at(day,10,0); addTender("תאורה — שדרות הנשיא, קריית אתא","עיריית קריית אתא","2026-12-03","בהכנה",22,[{type:"dig",qty:1800,cost:32,sub:0},{type:"pole",qty:95,cost:620,sub:0},{type:"fixture",qty:95,cost:550,sub:0},{type:"cable",qty:2100,cost:55,sub:0},{type:"cabinet",qty:1,cost:13400,sub:0}]); }
  if (day === "2026-11-03"){ at(day,9,30); as(ENG1); const pl = PLANS[20]; pl.version = "2"; pl.img = planSVG("כביש 70 — תוכנית תאורה — גרסה 2","עדכון: הזזת 6 עמודים בקטע הצפוני",'road'); pl.at = new Date().toISOString(); audit("עדכון גרסת תוכנית", `${pl.name} → 2`); }

  // weekly coordination meetings (Sunday)
  if (d === 0 && day > "2026-09-01" && day < END){
    PROJ.filter(x => x.p.start <= day && x.p.status==="פעיל").forEach(({p}) => {
      at(day, 8, 0); const s = projStats(p.id);
      const decs = [];
      DB.stock.filter(x=>x.qty<x.min).forEach(x=>decs.push(`להשלים מלאי ${matName(x.mat)}`));
      if (DB.tasks.some(t=>t.projectId===p.id && t.status!=="הושלם" && t.due < day)) decs.push("לתגבר צוות למשימות שבאיחור");
      decs.push(pick(["לתאם פקח תנועה לשבוע הבא","לעדכן את המזמין על ההתקדמות","להקפיד על צילום כל עמוד","בדיקת בטיחות באתר ביום ג׳"]));
      meeting(p.id, day, "08:00", `תיאום שבועי — ${p.name}`, `Claude, ${U(p.managerId).name}, ראשי צוותים`, `ביצוע מצטבר ${s.progress}%. רווח גולמי ${s.margin}%.`, decs.slice(0,3), p.managerId);
    });
  }

  if (!wd){ continue; }

  // --- 07:00 morning: engineers approve yesterday's reports, close daily logs ---
  at(day, 7, RI(0,45));
  DB.reports.filter(r => r.status==="pending" && r.date < day).forEach(engineerDecide);
  [...new Set(DB.daily.filter(m=>m.status!=="מאושר" && m.date < day).map(m=>m.projectId+"|"+m.date))].forEach(k => { const [pid,dt] = k.split("|"); approveDaily(+pid, dt); });

  // --- CEO handles over-budget requests ---
  at(day, 8, 10);
  DB.requests.filter(r => r.status===REQ.WAIT_CEO && r.date < day && !(isToday)).forEach(r => {
    const boqQty = projectBoq(r.projectId).filter(b=>WORK[b.type]?.mat===r.mat).reduce((a,b)=>a+b.qty,0);
    const over = purchasedFor(r.projectId, r.mat) - boqQty;
    if (over <= boqQty*0.15 || r.qty <= 60) ceoDecideSim(r, true); else ceoDecideSim(r, false, "חריגה גבוהה — להשתמש קודם במלאי הקיים ולבדוק פחת");
  });

  // --- purchasing orders approved requests ---
  at(day, 9, RI(0,40));
  DB.requests.filter(r => r.status===REQ.APPROVED && r.date <= day && !(isToday && r.date===day)).forEach(r => orderSim(r, day));

  // --- storekeeper receives deliveries ---
  at(day, 10, RI(0,50));
  DB.requests.filter(r => r.status===REQ.ORDERED && r.eta <= day).forEach(r => receiveSim(r, day));

  // --- engineers assign tasks ---
  at(day, 7, 50);
  PROJ.filter(x => x.p.start <= day && x.p.status==="פעיל").forEach(({p, crew}) => {
    Object.entries(crew).forEach(([type, uids]) => uids.forEach(uid => {
      if (openTaskOf(uid, p.id)) return;
      if (anyOpenTask(uid).length >= 2) return;
      at(day, 7, RI(30,59));
      createTask(p.id, type, uid, day);
    }));
  });

  // --- storekeeper issues materials / requests purchase ---
  at(day, 8, RI(30,55));
  DB.tasks.filter(t => t.status!=="הושלם" && !matIssued.has(t.id)).forEach(t => {
    if (issueSim(t)) return;
    const mat = WORK[B(t.boqId).type].mat;
    if (!openReqFor(mat, t.projectId)){
      const s = stockOf(mat);
      const shortfall = Math.max(1, t.qty - s.qty);
      const lot = {cable:500,fixture:20,pole:10,cabinet:1,signal:2}[mat] || 1;
      const boqQty = projectBoq(t.projectId).filter(b=>WORK[b.type]?.mat===mat).reduce((a,b)=>a+b.qty,0);
      const bought = purchasedFor(t.projectId, mat);
      let q = Math.ceil((shortfall + s.min*0.5)/lot)*lot;          // buffer for the warehouse
      if (bought + q > boqQty) q = Math.ceil(shortfall/lot)*lot;  // stay inside the contract quantities
      if (bought + q > boqQty && bought + shortfall <= boqQty) q = shortfall;
      const rejectedToday = DB.requests.some(r => r.projectId===t.projectId && r.mat===mat && r.status===REQ.REJECTED && r.date===day);
      if (!rejectedToday) makeRequest(chance(0.6)?STORE:engOf(t.projectId), t.projectId, mat, q, `השלמה למשימה: ${t.title}`, day);
    }
  });

  // --- field work: one task per worker per day ---
  const workers = DB.users.filter(u => ["worker","contractor"].includes(u.role));
  workers.forEach(u => {
    if (chance(0.07)) return; // sick day / other site
    const ts = anyOpenTask(u.id).filter(t => matIssued.has(t.id) && P(t.projectId).start <= day && t.qty - taskDone(t) - taskPending(t) > 0);
    if (!ts.length) return;
    const t = ts.sort((a,b)=>a.due.localeCompare(b.due))[0];
    fieldReport(t, day);
  });

  // --- engineers approve same-day reports in the evening (most days), today's stay pending ---
  if (!isToday){
    at(day, 18, RI(0,50));
    DB.reports.filter(r => r.status==="pending" && r.date===day && chance(0.75)).forEach(engineerDecide);
    at(day, 19, RI(0,30));
    [...new Set(DB.daily.filter(m=>m.status!=="מאושר" && m.date===day).map(m=>m.projectId))].forEach(pid => { if (chance(0.7)) approveDaily(pid, day); });
  }

  // --- project completion ---
  PROJ.forEach(({p}) => { if (p.status==="פעיל" && projStats(p.id).progress >= 100){ at(day,19,45); as(CEO); p.status = "הסתיים"; p.finishedAt = day; audit("פרויקט הסתיים", p.name); notify(`הביצוע בפרויקט ${p.name} הושלם — לתאם מסירה ללקוח`, {roles:["ceo","engineer"], module:"projects"}); } });

  // --- month-end billing (last workday of month) ---
  const nextWd = addWorkdays(day,1);
  if (nextWd.slice(0,7) !== day.slice(0,7)){
    at(day, 20, 0);
    PROJ.filter(x=>x.p.start <= day).forEach(({p}) => { const b = createBillSim(p.id, day, engOf(p.id)); if (b){ at(day,20,30); setBill(b, "נשלח", day); } });
  }
  // payments: client pays bills ~40 days after sending (CEO marks paid)
  at(day, 11, 0);
  DB.bills.filter(b => b.status==="נשלח" && (new __RealDate(day) - new __RealDate(b.sentAt))/864e5 >= (b.projectId===21?28:40)).forEach(b => setBill(b, "שולם", day));
}

// ---------- final state on "today" (20/11) ----------
at(END, 8, 30);
// a November draft bill for review by CEO
createBillSim(20, END, ENG1);
// one over-budget request waiting for the CEO decision today (realistic open item)
(function(){ const pid = 22, mat = "cable"; const boqQty = 3800; const bought = purchasedFor(pid, mat); const q = Math.max(300, Math.ceil((boqQty - bought + 350)/50)*50);
  at(END, 7, 40); makeRequest(ENG2, pid, mat, q, "פחת בהשחלה בקטע ג׳ + תוספת לפי בקשת העירייה", END); })();
// upcoming meetings
at(END, 8, 45);
meeting(21, addDays(4, END+"T12:00:00"), "10:00", "מסירה חלקית — צומת הכניסה, טמרה", "Claude, רנא חורי, מהנדס העיר טמרה", "", [], ENG2);
meeting(null, addDays(2, END+"T12:00:00"), "09:00", "ישיבת הנהלה חודשית — רווחיות ותזרים", "Claude, סאמי חדאד, רנא חורי, מאיה רוזן", "", [], CEO);

// mark old notifications as read
const cutoff = addDays(-3, END+"T12:00:00");
DB.notes.forEach(n => {
  if (n.at.slice(0,10) >= cutoff) return;
  const readers = DB.users.filter(u => n.userId===u.id || n.roles.includes(u.role)).map(u=>u.id);
  n.readBy = readers;
});
// strip sim-only fields
DB.reports.forEach(r => delete r._inflated);

// summary
S.user = U(CEO);
const sum = {
  company:COMPANY, projects:DB.projects.map(p => ({id:p.id, name:p.name, ...projStats(p.id)})),
  counts:Object.fromEntries(["users","projects","boq","tasks","reports","daily","plans","stock","movements","suppliers","requests","bills","tenders","meetings","docs","notes","audit"].map(c=>[c,DB[c].length])),
  pendingReports:DB.reports.filter(r=>r.status==="pending").length, rejected:DB.reports.filter(r=>r.status==="rejected").length,
  reqStatus:DB.requests.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),
  bills:DB.bills.map(b=>[b.projectId,b.period,b.status,Math.round(b.total)]),
  ai:aiFindings().map(f=>f.lvl+" "+f.title),
  stock:DB.stock.map(s=>[s.mat,s.qty,s.min]), maxId:DB.seq
};
__out.db = DB; __out.sum = sum;

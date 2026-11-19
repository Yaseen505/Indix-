"use strict";
/* =========================================================================
   INDIX — מעטפת, ניווט ומסכים
   ========================================================================= */

/* ------------------------------ כניסה ------------------------------ */
function renderLogin(){
  $("loginCompany").textContent = DB.settings.company;
  $("userInput").innerHTML = DB.users.filter(u => u.active).map(u => `<option value="${u.id}">${esc(u.name)} — ${ROLES[u.role]}</option>`).join("");
}
function login(){
  const u = U(val("userInput")), pin = val("pinInput");
  if (!u || !u.active){ $("loginErr").textContent = "המשתמש אינו פעיל"; return; }
  if (pin !== String(u.pin)){ $("loginErr").textContent = "קוד כניסה שגוי"; $("pinInput").select(); return; }
  S.user = u; localStorage.setItem(SESSION_KEY, u.id);
  audit("כניסה למערכת"); save(); $("pinInput").value = ""; $("loginErr").textContent = "";
  startApp();
}
async function logout(){
  audit("יציאה מהמערכת"); save();
  if (CLOUD.enabled){ try { clearTimeout(CLOUD.timer); await CLOUD.sync(); } catch(e){} await CLOUD.signOut(); }
  localStorage.removeItem(SESSION_KEY); S.user = null; location.hash = ""; location.reload();
}
function startApp(){
  $("loginView").classList.add("hidden"); $("appView").classList.remove("hidden");
  $("userBadge").innerHTML = `<b>${esc(S.user.name)}</b><br>${ROLES[S.user.role]}<br><span class="muted">${esc(DB.settings.company)}</span>${CLOUD.enabled?"":`<br><button class="small link" onclick="openMyPin()">🔑 שינוי קוד כניסה</button>`}`;
  $("dateNow").textContent = new Date().toLocaleDateString("he-IL");
  navigate(location.hash.slice(1) || "dashboard");
}

/* ------------------------------ ניווט ------------------------------ */
function navBadges(){
  const b = {}, role = S.user.role;
  if (can("approveReport")) b.fieldAI = DB.reports.filter(r => r.status==="pending" && canSeeProject(r.projectId)).length;
  if (isFieldRole()) b.tasks = myTasks().filter(t => t.status !== "הושלם").length;
  const want = role==="ceo" ? [REQ.WAIT_CEO] : role==="purchasing" ? [REQ.APPROVED] : role==="storekeeper" ? [REQ.ORDERED] : [];
  b.purchasing = DB.requests.filter(r => want.includes(r.status)).length;
  b.alerts = myNotes().filter(n => !n.readBy.includes(S.user.id)).length;
  if (can("approveDaily")) b.daily = DB.daily.filter(d => d.status !== "מאושר" && canSeeProject(d.projectId)).length;
  return b;
}
function renderNav(){
  const allowed = ROLE_ACCESS[S.user.role], bd = navBadges();
  $("nav").innerHTML = MODULES.filter(m => allowed.includes(m[0])).map(m =>
    `<button id="nav_${m[0]}" class="${S.current===m[0]?"active":""}" onclick="go('${m[0]}')"><span>${m[2]} ${m[3]}</span><small>${m[1]}</small>${bd[m[0]]?`<b class="badge">${bd[m[0]]}</b>`:""}</button>`).join("");
}
function go(k){ if (location.hash === "#"+k) navigate(k); else location.hash = k; }
function navigate(key){
  if (!S.user) return;
  if (!MODULES.some(m => m[0]===key)) key = "dashboard";
  if (!ROLE_ACCESS[S.user.role].includes(key)){ toast("אין לך הרשאה למסך זה","danger"); key = "dashboard"; history.replaceState(null,"","#dashboard"); }
  S.current = key;
  const m = MODULES.find(x => x[0]===key);
  $("pageTitle").textContent = `${m[2]} ${m[3]}`; $("pageIndex").textContent = m[1];
  $("pageSubtitle").textContent = SUBTITLES[key] || "";
  render(); closeDrawer(); window.scrollTo(0,0);
}
function render(){ S.after = []; $("content").innerHTML = VIEWS[S.current](); renderNav(); S.after.forEach(f => f()); }
function refresh(){ save(); render(); }
function toggleDrawer(){ document.body.classList.toggle("drawer-open"); }
function closeDrawer(){ document.body.classList.remove("drawer-open"); }
function setFilter(k, v){ S.filters[k] = v; render(); }
function fv(k, d){ return S.filters[k] ?? d; }

/* ------------------------------ רכיבים ------------------------------ */
function kpi(t, n, sub = "", cls = ""){ return `<div class="card kpi ${cls}"><span class="muted">${t}</span><div class="num">${n}</div>${sub?`<small class="muted">${sub}</small>`:""}</div>`; }
function bar(p, p2 = 0){ return `<div class="progress"><span style="width:${Math.min(100,Math.max(0,p))}%"></span>${p2?`<i style="width:${Math.min(100-p,Math.max(0,p2))}%"></i>`:""}</div>`; }
function tag(x, cls = ""){ return `<span class="tag ${cls}">${esc(x)}</span>`; }
const STATUS_CLS = {"הושלם":"success","מאושר":"success","שולם":"success",[REQ.SUPPLIED]:"success","פעיל":"success","זכינו":"success",
  "בביצוע":"warning","ממתין לאישור":"warning","ממתין לאישור מהנדס":"warning",[REQ.APPROVED]:"warning","מושהה":"warning",
  [REQ.ORDERED]:"info","נשלח":"info","הוגש":"info","חדש":"info","תכנון":"info","בהכנה":"info",
  [SUB.ENG]:"warning",[SUB.OK]:"info",[REQ.WAIT_CEO]:"danger",[REQ.REJECTED]:"danger","נדחה":"danger","הפסדנו":"danger","טיוטה":"","הסתיים":""};
function st(x){ return tag(x, STATUS_CLS[x] || ""); }
const RSTAT = {pending:["ממתין לאישור","warning"], approved:["מאושר","success"], rejected:["נדחה","danger"]};
function rst(r){ return tag(RSTAT[r.status][0], RSTAT[r.status][1]); }
function scoreTag(s){ return `<span class="score ${s>=75?"good":s>=45?"mid":"bad"}">AI ${s}</span>`; }

function table(id, headers, rows, opts = {}){
  if (!rows.length) return `<div class="card empty">${opts.empty || "אין נתונים להצגה"}</div>`;
  const a = opts.actions, last = headers.length - 1;
  return `<div class="table-wrap"><table id="${id}" class="rt"><thead><tr>${headers.map((h,i)=>`<th class="${a&&i===last?"noexp":""}">${h}</th>`).join("")}</tr></thead>
  <tbody>${rows.map(r=>`<tr class="${r._cls||""}">${r.map((c,i)=>`<td data-l="${String(headers[i]||"").replace(/<[^>]+>/g," ").replace(/"/g,"")}" class="${a&&i===last?"noexp":""}">${c}</td>`).join("")}</tr>`).join("")}</tbody>
  ${opts.foot?`<tfoot><tr>${opts.foot.map((c,i)=>`<td class="${a&&i===last?"noexp":""}">${c}</td>`).join("")}</tr></tfoot>`:""}</table></div>`;
}
function head(title, actions = "", exportId = "", exportName = ""){
  return `<div class="module-header"><h3>${title}</h3><div class="actions">${actions}${exportId?`<button class="small ghost" onclick="exportTable('${exportId}','${exportName||exportId}')">⬇ Excel</button>`:""}</div></div>`;
}
function projectSelect(key, includeAll = true, extra = ""){
  const ps = visibleProjects(); let v = fv(key, includeAll ? "all" : String(ps[0]?.id || ""));
  if (!includeAll && !ps.some(p => String(p.id)===String(v))) v = String(ps[0]?.id || "");
  return `<select class="filter" onchange="setFilter('${key}',this.value)" ${extra}>${includeAll?`<option value="all">כל הפרויקטים</option>`:""}${ps.map(p=>`<option value="${p.id}" ${String(p.id)===String(v)?"selected":""}>${esc(p.name)}</option>`).join("")}</select>`;
}
function curProject(includeAll = true){ const ps = visibleProjects(); let v = fv("project", includeAll ? "all" : ""); if (!includeAll && !ps.some(p=>String(p.id)===String(v))) v = String(ps[0]?.id||""); return v; }
function matchP(pid){ const v = curProject(); return v === "all" || String(pid) === String(v); }
function findingItem(f){ return `<div class="timeline-item lvl-${f.lvl}"><b>${esc(f.title)}</b>${f.detail?`<br><span class="muted">${esc(f.detail)}</span>`:""} <button class="small link" onclick="go('${f.module}')">עבור ←</button></div>`; }
function optionList(arr, sel){ return arr.map(([v,t]) => `<option value="${esc(v)}" ${String(v)===String(sel)?"selected":""}>${esc(t)}</option>`).join(""); }

/* ============================== INDEX 01 · ראשי ============================== */
function dashboard(){
  const r = S.user.role;
  if (isFieldRole()) return dashField();
  if (r === "purchasing") return dashPurchasing();
  if (r === "storekeeper") return dashStore();
  return dashManager();
}
function dashManager(){
  const ps = visibleProjects().filter(p => p.status !== "הסתיים"); let ex=0, co=0;
  ps.forEach(p => { const s = projStats(p.id); ex += s.executed; co += s.cost; });
  const pendR = DB.reports.filter(r => r.status==="pending" && canSeeProject(r.projectId));
  const waitCeo = S.user.role==="ceo" ? DB.requests.filter(r => r.status===REQ.WAIT_CEO) : [];
  const pendD = DB.daily.filter(d => d.status!=="מאושר" && canSeeProject(d.projectId));
  const f = aiFindings();
  const waiting = [
    ...pendR.map(r => `<div class="timeline-item lvl-mid">📸 דיווח שטח #${r.id} · ${pname(r.projectId)} · ${uname(r.userId)} · ${num(r.qty)} ${esc(B(r.boqId)?.unit||"")} ${scoreTag(analyzeReport(r).score)} <button class="small" onclick="openApprove(${r.id})">בדוק ואשר</button></div>`),
    ...waitCeo.map(r => `<div class="timeline-item lvl-high">🛒 דרישת רכש ${r.id} · ${pname(r.projectId)} · ${esc(matName(r.mat))} ${num(r.qty)} — ${esc(r.overMsg)} <button class="small" onclick="ceoDecide(${r.id},true)">אשר</button> <button class="small danger" onclick="ceoDecide(${r.id},false)">דחה</button></div>`),
    ...(S.user.role==="ceo" ? DB.boq.filter(b => isExtraPending(b) && canSeeProject(b.projectId)).map(b => `<div class="timeline-item lvl-high">⚠ עבודה חריגה · ${pname(b.projectId)} · ${esc(b.item)} · ${num(b.qty)} ${esc(b.unit)}${boqDone(b)?` (בוצע ${num(boqDone(b))})`:""} <button class="small" onclick="openBoqLine(${b.id})">תמחר ואשר</button></div>`) : []),
    ...subsWaiting().map(x => `<div class="timeline-item lvl-mid">💰 חשבון ${esc(U(x.uid)?.name)} · ${x.per} · ${money(x.total)} — ${S.user.role==="ceo"?"אושר ע״י מהנדס, ממתין לאישור תשלום":"מוכן לאישור מהנדס"} <button class="small" onclick="viewSub(${x.uid},'${x.per}')">בדוק ואשר</button></div>`),
    ...pendD.map(d => `<div class="timeline-item lvl-low">📋 יומן עבודה ${fmtDate(d.date)} · ${pname(d.projectId)} <button class="small" onclick="openDaily(${d.projectId},'${d.date}')">פתח</button></div>`)
  ];
  return `<div class="grid kpis">
    ${kpi("פרויקטים פעילים", ps.length)}
    ${kpi("משימות פתוחות", myTasks().filter(t=>t.status!=="הושלם").length)}
    ${kpi("ממתינים לאישורך", waiting.length, "", waiting.length?"attn":"")}
    ${kpi("התראות קריטיות", f.filter(x=>x.lvl==="high").length, "", f.some(x=>x.lvl==="high")?"attn":"")}
    ${kpi("שווי ביצוע מאושר", money(ex))}
    ${kpi("רווח גולמי", money(ex-co), `שיעור רווח ${pct(ex-co,ex)}%`)}
  </div>
  ${waiting.length?`<div class="section-title"><h3>ממתין לאישורך</h3></div><div class="card timeline">${waiting.join("")}</div>`:""}
  <div class="section-title"><h3>פרויקטים</h3><button onclick="go('projects')">לכל הפרויקטים</button></div>
  <div class="grid projects">${ps.map(projectCard).join("") || `<div class="card empty">אין פרויקטים פעילים</div>`}</div>
  <div class="section-title"><h3>דורש תשומת לב (AI Control)</h3><button onclick="go('ai')">לכל הממצאים</button></div>
  <div class="card timeline">${f.slice(0,6).map(findingItem).join("") || `<div class="muted">אין ממצאים פתוחים 👍</div>`}</div>`;
}
function dashField(){
  const ts = myTasks().filter(t => t.status !== "הושלם").sort((a,b)=>(a.due||"").localeCompare(b.due||""));
  const rs = visibleReports().sort((a,b)=>b.at.localeCompare(a.at)).slice(0,6);
  return `<div class="hello card"><h3>שלום ${esc(S.user.name)} 👋</h3><p class="muted">יש לך ${ts.length} משימות פתוחות. לדיווח: בחר משימה ← צלם ← שלח.</p>
    <button class="primary" style="width:auto" onclick="go('fieldAI')">📸 דיווח שטח חדש</button></div>
  <div class="section-title"><h3>המשימות שלי</h3></div>
  <div class="grid projects">${ts.map(t => { const done = taskDone(t), pend = taskPending(t), late = t.due && t.due < today();
    return `<div class="card"><div class="tags">${st(t.status)}${late?tag("באיחור","danger"):""}</div><h3>${esc(t.title)}</h3>
    <span class="muted">${pname(t.projectId)} · ${esc(t.location||"")}</span>${bar(pct(done,t.qty),pct(pend,t.qty))}
    <p>בוצע ${num(done)} / ${num(t.qty)} ${esc(B(t.boqId)?.unit||"")}${pend?` · ממתין ${num(pend)}`:""}<br>יעד: ${fmtDate(t.due)}</p>
    ${t.notes?`<p class="notice">${esc(t.notes)}</p>`:""}
    <div class="actions">${t.status==="חדש"?`<button onclick="startTask(${t.id})">▶ התחל עבודה</button>`:""}<button class="dark" onclick="reportTask(${t.id})">📸 דווח ביצוע</button></div></div>`; }).join("") || `<div class="card empty">אין משימות פתוחות 🎉</div>`}</div>
  ${(() => { const m = monthKey(), es = earnSummary(S.user.id, m), prev = monthsBack(2)[1], ep = earnSummary(S.user.id, prev), sbp = (DB.subbills||[]).filter(s=>s.userId===S.user.id && s.period===prev).pop();
     return `<div class="section-title"><h3>💰 החשבון החודשי שלי</h3></div><div class="card"><div class="earn">
      ${kpi("היום", money(es.today), "לפי הדיווחים של היום")}${kpi("החודש — מאושר", money(es.approved), `${es.days} ימי עבודה`)}${kpi("ממתין לאישור מהנדס", money(es.pending))}${kpi(`חודש קודם (${prev})`, money(ep.approved), sbp ? sbp.status : ep.approved ? "ממתין לאישור מהנדס ומנכ״ל" : "")}</div>
      ${es.noRate.length ? `<p class="muted small-text">לחלק מהסעיפים עוד לא הוגדר מחיר — המהנדס יעדכן.</p>` : ""}
      <div class="actions"><button class="small dark" onclick="viewSub(${S.user.id},'${m}')">הצג חשבון החודש</button>${ep.approved?`<button class="small" onclick="viewSub(${S.user.id},'${prev}')">חשבון ${prev}</button>`:""}</div></div>`; })()}
  <div class="section-title"><h3>הדיווחים האחרונים שלי</h3></div>
  ${table("myReps",["תאריך","משימה","כמות","סטטוס","הערת מהנדס"], rs.map(r => [fmtDate(r.date), esc(T(r.taskId)?.title||"-"), num(r.qty), rst(r), esc(r.decisionNote||"")]), {empty:"עוד לא שלחת דיווחים"})}`;
}
function dashPurchasing(){
  const by = s => DB.requests.filter(r => r.status === s);
  const low = DB.stock.filter(s => s.qty < s.min);
  return `<div class="grid kpis">${kpi("ממתינות להזמנה", by(REQ.APPROVED).length,"", by(REQ.APPROVED).length?"attn":"")}${kpi("ממתינות למנכ״ל", by(REQ.WAIT_CEO).length)}${kpi("הוזמנו — בדרך", by(REQ.ORDERED).length)}${kpi("פריטים במלאי נמוך", low.length,"",low.length?"attn":"")}</div>
  <div class="section-title"><h3>דרישות שממתינות להזמנה</h3><button onclick="go('purchasing')">לכל הרכש</button></div>
  ${table("dpReq",["מס׳","פרויקט","פריט","כמות",""], by(REQ.APPROVED).map(r=>[r.id,pname(r.projectId),esc(matName(r.mat)),num(r.qty),`<button class="small dark" onclick="openOrder(${r.id})">בחר ספק והזמן</button>`]),{empty:"אין דרישות ממתינות",actions:true})}
  <div class="section-title"><h3>מלאי נמוך</h3></div>
  ${table("dpLow",["פריט","במלאי","מינימום",""], low.map(s=>[esc(matName(s.mat)),num(s.qty),num(s.min),`<button class="small" onclick="openRequest('${s.mat}')">+ דרישת רכש</button>`]),{empty:"כל המלאי תקין",actions:true})}`;
}
function dashStore(){
  const toRecv = DB.requests.filter(r => r.status === REQ.ORDERED), low = DB.stock.filter(s => s.qty < s.min);
  const todayMov = DB.movements.filter(m => m.at.slice(0,10) === today()).length;
  return `<div class="grid kpis">${kpi("משלוחים לקליטה", toRecv.length,"",toRecv.length?"attn":"")}${kpi("פריטים במלאי נמוך", low.length,"",low.length?"attn":"")}${kpi("תנועות היום", todayMov)}${kpi("סוגי פריטים", DB.stock.length)}</div>
  <div class="hello card actions"><button class="dark" onclick="openMove('in')">⬇ קליטת חומר</button><button class="dark" onclick="openMove('out')">⬆ ניפוק לפרויקט</button></div>
  <div class="section-title"><h3>משלוחים שממתינים לקליטה</h3></div>
  ${table("dsRecv",["הזמנה","פריט","כמות","ספק","פרויקט",""], toRecv.map(r=>[r.id,esc(matName(r.mat)),num(r.qty),esc(DB.suppliers.find(s=>s.id===r.supplierId)?.name||"-"),pname(r.projectId),`<button class="small dark" onclick="openReceive(${r.id})">קלוט + חתימה</button>`]),{empty:"אין משלוחים בדרך",actions:true})}
  <div class="section-title"><h3>מלאי נמוך</h3></div>
  ${table("dsLow",["פריט","במלאי","מינימום",""], low.map(s=>[esc(matName(s.mat)),num(s.qty),num(s.min),`<button class="small" onclick="openRequest('${s.mat}')">+ דרישת רכש</button>`]),{empty:"כל המלאי תקין",actions:true})}`;
}

/* ============================== INDEX 02 · פרויקטים ============================== */
function projectCard(p){
  const s = projStats(p.id), money_ = can("seeMoney");
  return `<div class="card project-card"><div class="tags">${st(p.status)}${s.budgetUse > s.progress + 8 && money_ ? tag("סיכון תקציבי","danger"):""}</div>
  <h3>${esc(p.name)}</h3><span class="muted">${esc(p.client)}</span>${bar(s.progress)}<b>${s.progress}% ביצוע</b>
  ${money_?`<p>היקף חוזה: ${money(s.contract)}<br>בוצע: ${money(s.executed)}<br>עלות בפועל: ${money(s.cost)} מתוך תקציב ${money(s.budget)}</p>`:`<p class="muted">יעד סיום: ${fmtDate(p.end)}</p>`}
  <button onclick="openProject(${p.id})">פתח פרויקט</button></div>`;
}
function projects(){
  const sf = fv("pstatus","all"), ps = visibleProjects().filter(p => sf==="all" || p.status===sf);
  return head(`כל הפרויקטים (${ps.length})`, `<select class="filter" onchange="setFilter('pstatus',this.value)">${optionList([["all","כל הסטטוסים"],["פעיל","פעיל"],["תכנון","תכנון"],["מושהה","מושהה"],["הסתיים","הסתיים"]],sf)}</select>${can("manageProjects")?`<button class="dark" onclick="openProjectForm()">+ פרויקט חדש</button>`:""}`)
   + `<div class="grid projects">${ps.map(projectCard).join("") || `<div class="card empty">אין פרויקטים</div>`}</div>`;
}

/* ============================== INDEX 03 · תוכניות ============================== */
function plans(){
  const list = DB.plans.filter(p => canSeeProject(p.projectId) && matchP(p.projectId));
  return head("מרכז תוכניות", projectSelect("project") + (can("managePlans")?`<button class="dark" onclick="openPlanUpload()">+ העלאת תוכנית</button>`:""))
   + `<div class="grid projects">${list.map(pl => `<div class="card plan-card">
      <div class="thumb" onclick="openPlan(${pl.id})">${pl.img?`<img src="${pl.img}" alt="">`:`<div class="file-icon">📄<br>${esc(pl.fileName||"")}</div>`}</div>
      <div class="tags">${st(pl.status==="מאושר"?"מאושר":"ממתין לאישור")}${tag("גרסה "+pl.version)}</div>
      <h3>${esc(pl.name)}</h3><span class="muted">${pname(pl.projectId)} · ${pl.marks.length} סימונים</span>
      <div class="actions"><button onclick="openPlan(${pl.id})">פתח</button>${can("managePlans")&&pl.status!=="מאושר"?`<button class="small dark" onclick="approvePlan(${pl.id})">אשר גרסה</button>`:""}</div></div>`).join("") || `<div class="card empty">אין תוכניות לפרויקט זה</div>`}</div>`;
}

/* ============================== INDEX 04 · משימות ============================== */
function tasks(){
  const sf = fv("tstatus","open");
  const list = myTasks().filter(t => matchP(t.projectId) && (sf==="all" || (sf==="open" ? t.status!=="הושלם" : t.status===sf)))
    .sort((a,b)=>(a.due||"9").localeCompare(b.due||"9"));
  const rows = list.map(t => { const b = B(t.boqId), done = taskDone(t), pend = taskPending(t), late = t.status!=="הושלם" && t.due && t.due < today();
    const r = [pname(t.projectId), `<b>${esc(t.title)}</b><br><small class="muted">${esc(t.location||"")}</small>`, esc(b?.item||"-"),
      `${num(done)} / ${num(t.qty)} ${esc(b?.unit||"")}${pend?`<br><small class="muted">ממתין ${num(pend)}</small>`:""}`, uname(t.assigneeId),
      fmtDate(t.due) + (late?" "+tag("באיחור","danger"):""), st(t.status),
      `<div class="actions">${isFieldRole()||t.assigneeId===S.user.id?`${t.status==="חדש"?`<button class="small" onclick="startTask(${t.id})">התחל</button>`:""}${t.status!=="הושלם"?`<button class="small dark" onclick="reportTask(${t.id})">דווח</button>`:""}`:""}
       ${can("createTask")?`<button class="small" onclick="openTaskForm(${t.id})">ערוך</button><button class="small danger" onclick="delTask(${t.id})">מחק</button>`:""}</div>`];
    if (late) r._cls = "row-late"; return r; });
  return head(`משימות (${list.length})`, projectSelect("project") + `<select class="filter" onchange="setFilter('tstatus',this.value)">${optionList([["open","פתוחות"],["all","הכל"],["חדש","חדש"],["בביצוע","בביצוע"],["ממתין לאישור","ממתין לאישור"],["הושלם","הושלם"]],sf)}</select>`
    + (can("createTask")?`<button class="dark" onclick="openTaskForm()">+ משימה</button>`:""), "tasksT", "משימות")
   + table("tasksT", ["פרויקט","משימה","סעיף","ביצוע","אחראי","יעד","סטטוס","פעולות"], rows, {actions:true, empty:"אין משימות בסינון הנוכחי"});
}

/* ============================== INDEX 05 · עובדים וקבלנים ============================== */
function people(){
  const since = addDays(-30);
  const rows = DB.users.map(u => [ `<b>${esc(u.name)}</b>`, ROLES[u.role], esc(u.phone||"-"),
    u.projects==="all" ? "כל הפרויקטים" : u.projects.map(pname).join(", ") || "-",
    DB.tasks.filter(t=>t.assigneeId===u.id && t.status!=="הושלם").length,
    DB.reports.filter(r=>r.userId===u.id && r.status==="approved" && r.date>=since).length,
    u.active ? tag("פעיל","success") : tag("מושבת","danger"),
    can("admin") ? `<button class="small" onclick="openUser(${u.id})">ערוך</button>` : "" ]);
  return head(`עובדים וקבלנים (${DB.users.length})`, can("admin")?`<button class="dark" onclick="openUser()">+ משתמש</button>`:"", "peopleT", "עובדים")
   + table("peopleT", ["שם","תפקיד","טלפון","פרויקטים","משימות פתוחות","דיווחים מאושרים (30 יום)","סטטוס",""], rows, {actions:true})
   + `<p class="muted">שיוך לפרויקטים, חסימה והשבתה מתבצעים ע״י המנכ״ל במסך ניהול והרשאות. עובד/קבלן רואה רק את הפרויקטים והמשימות שלו.</p>`;
}

/* ============================== INDEX 06 · שטח + AI ============================== */
function fieldAI(){
  let html = "";
  if (can("fieldReport")){
    const open = myTasks().filter(t => t.status !== "הושלם");
    const pre = fv("reportTask", open[0]?.id || "");
    const d = S.draft;
    html += `<div class="card report-form"><h3>📸 דיווח שטח חדש</h3>
     ${open.length ? `<div class="form-grid">
      <div class="full"><label>משימה *</label><select id="rf_task" onchange="S.filters.reportTask=this.value;taskHint()">${open.map(t=>`<option value="${t.id}" ${String(t.id)===String(pre)?"selected":""}>${esc(t.title)} · ${pname(t.projectId)}</option>`).join("")}</select><div id="rf_hint" class="muted small-text"></div></div>
      <div><label>כמות שבוצעה *</label><input id="rf_qty" type="number" inputmode="decimal" min="0" step="any" value="${esc(d.qty||"")}" oninput="S.draft.qty=this.value"></div>
      <div><label>שלב</label><select id="rf_stage">${optionList([["התחלה","התחלה"],["התקדמות","התקדמות"],["סיום","סיום"]],d.stage||"התקדמות")}</select></div>
      <div class="full"><label>הערות / בעיות בשטח</label><textarea id="rf_note" rows="2" oninput="S.draft.note=this.value" placeholder="לדוגמה: נתקלנו בצנרת לא מסומנת">${esc(d.note||"")}</textarea></div>
      <div><label>תמונה מהשטח</label><label class="file-btn">📷 צלם / בחר תמונה<input type="file" accept="image/*" capture="environment" onchange="onPhoto(this)" hidden></label><div id="rf_prev">${d.photo?`<img class="prev" src="${d.photo}">`:""}</div></div>
      <div><label>מיקום GPS</label><div id="rf_gps" class="gps-box">${d.gps?`📍 ${d.gps.lat}, ${d.gps.lng} (±${d.gps.acc} מ׳)`:"טרם התקבל מיקום"}</div><button type="button" class="small" onclick="grabGPS()">📍 קבל מיקום</button></div>
      <button class="primary full" onclick="submitReport()">שלח דיווח לאישור מהנדס</button></div>` : `<p class="muted">אין משימות פתוחות לדיווח.</p>`}</div>`;
    S.after.push(() => { taskHint(); if (!S.draft.gps && !S.gpsTried){ S.gpsTried = true; grabGPS(true); } });
  }
  const sf = fv("rstatus", can("approveReport") ? "pending" : "all");
  const list = visibleReports().filter(r => matchP(r.projectId) && (sf==="all" || r.status===sf)).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,60);
  html += `<div class="section-title"><h3>${isFieldRole()?"הדיווחים שלי":"דיווחי שטח"}</h3><div class="actions">${projectSelect("project")}<select class="filter" onchange="setFilter('rstatus',this.value)">${optionList([["pending","ממתינים לאישור"],["approved","מאושרים"],["rejected","נדחו"],["all","הכל"]],sf)}</select></div></div>
  <div class="grid reports">${list.map(reportCard).join("") || `<div class="card empty">אין דיווחים בסינון הנוכחי</div>`}</div>`;
  return html;
}
function reportCard(r){
  const a = analyzeReport(r), b = B(r.boqId);
  return `<div class="card report-card">
    <div class="rc-photo">${r.photo?`<img src="${r.photo}" onclick="openApprove(${r.id})">`:`<div class="no-photo">אין תמונה</div>`}</div>
    <div class="rc-body"><div class="tags">${rst(r)}${r.status==="pending"?scoreTag(a.score):""}${tag(r.stage||"")}</div>
    <b>#${r.id} · ${esc(T(r.taskId)?.title||"-")}</b><br><span class="muted">${pname(r.projectId)} · ${uname(r.userId)} · ${fmtTime(r.at)}</span>
    <p>כמות: <b>${num(r.qty)} ${esc(b?.unit||"")}</b>${r.qtyReported!==r.qty?` <small class="muted">(דווח ${num(r.qtyReported)})</small>`:""}
    ${r.gps?`<br>📍 <a href="https://maps.google.com/?q=${r.gps.lat},${r.gps.lng}" target="_blank" rel="noopener">מיקום במפה</a>`:"<br>📍 ללא GPS"}</p>
    ${r.note?`<p class="notice">${esc(r.note)}</p>`:""}${r.decisionNote?`<p class="muted">הערת מהנדס: ${esc(r.decisionNote)}</p>`:""}
    ${r.status==="pending"?`<div class="ai-box">🤖 ${esc(a.rec)}</div>`:""}
    <div class="actions">${r.status==="pending"&&can("approveReport")?`<button class="small dark" onclick="openApprove(${r.id})">בדוק ואשר</button>`:`<button class="small" onclick="openApprove(${r.id})">פרטים</button>`}</div></div></div>`;
}

/* ============================== INDEX 07 · יומן עבודה ============================== */
function dailyLogs(){
  const reps = visibleReports().filter(r => r.status !== "rejected" && r.date >= addDays(-30) && matchP(r.projectId));
  const map = {};
  reps.forEach(r => { const k = r.projectId+"|"+r.date; (map[k] = map[k] || {projectId:r.projectId,date:r.date,reports:[]}).reports.push(r); });
  if (!isFieldRole()) DB.daily.filter(d => canSeeProject(d.projectId) && matchP(d.projectId) && d.date >= addDays(-30)).forEach(d => { const k = d.projectId+"|"+d.date; map[k] = map[k] || {projectId:d.projectId,date:d.date,reports:[]}; });
  return Object.values(map).map(l => ({...l, meta: DB.daily.find(d => d.projectId===l.projectId && d.date===l.date)})).sort((a,b)=>b.date.localeCompare(a.date) || a.projectId-b.projectId);
}
function dailyBody(l){
  const byItem = {};
  l.reports.forEach(r => { const b = B(r.boqId); const k = r.boqId; byItem[k] = byItem[k] || {item:b?.item||"-",unit:b?.unit||"",ok:0,pend:0}; byItem[k][r.status==="approved"?"ok":"pend"] += r.qty; });
  const workers = [...new Set(l.reports.map(r => U(r.userId)?.name).filter(Boolean))];
  const notes = l.reports.filter(r => r.note).map(r => `${U(r.userId)?.name}: ${r.note}`);
  return `<table class="mini"><thead><tr><th>סעיף</th><th>מאושר</th><th>ממתין</th></tr></thead><tbody>${Object.values(byItem).map(i=>`<tr><td>${esc(i.item)}</td><td>${num(i.ok)} ${esc(i.unit)}</td><td>${i.pend?num(i.pend):"-"}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">אין דיווחי כמויות</td></tr>`}</tbody></table>
   <p><b>עובדים בשטח:</b> ${esc(workers.join(", ") || "-")}</p>
   ${notes.length?`<p><b>הערות מהשטח:</b><br>${notes.map(esc).join("<br>")}</p>`:""}
   ${l.meta?.issues?`<p><b>בעיות ועיכובים:</b> ${esc(l.meta.issues)}</p>`:""}${l.meta?.weather?`<p><b>מזג אוויר:</b> ${esc(l.meta.weather)}</p>`:""}${l.meta?.notes?`<p><b>סיכום מהנדס:</b> ${esc(l.meta.notes)}</p>`:""}`;
}
function daily(){
  const logs = dailyLogs();
  return head("יומני עבודה — 30 ימים אחרונים", projectSelect("project"))
   + `<div class="grid reports">${logs.map(l => { const status = l.meta?.status || (l.reports.some(r=>r.status==="pending") ? "ממתין לאישור מהנדס" : "טיוטה");
     return `<div class="card"><div class="tags">${st(status)}</div><h3>${pname(l.projectId)} · ${fmtDate(l.date)}</h3>${dailyBody(l)}
     <div class="actions">${can("approveDaily")&&status!=="מאושר"?`<button class="small dark" onclick="openDaily(${l.projectId},'${l.date}')">ערוך ואשר</button>`:""}<button class="small" onclick="printDaily(${l.projectId},'${l.date}')">🖨 הדפס / PDF ללקוח</button></div></div>`; }).join("") || `<div class="card empty">אין יומנים</div>`}</div>`;
}

/* ============================== INDEX 08 · התקדמות ============================== */
function progress(){
  const ps = visibleProjects().filter(p => matchP(p.id));
  return head("התקדמות לפי פרויקט", projectSelect("project")) + `<div class="grid split2">${ps.map(p => { const s = projStats(p.id);
    const recent = DB.reports.filter(r => r.projectId===p.id && r.status==="approved").sort((a,b)=>b.at.localeCompare(a.at)).slice(0,4);
    return `<div class="card"><h3>${esc(p.name)}</h3>${bar(s.progress)}<div class="num">${s.progress}%</div>
    <p class="muted">יעד סיום ${fmtDate(p.end)} · מחושב משווי הכמויות המאושרות מול היקף החוזה</p>
    <table class="mini"><thead><tr><th>סעיף</th><th>ביצוע</th><th style="width:40%">התקדמות</th></tr></thead><tbody>${projectBoq(p.id).map(b => { const d = boqDone(b), pe = boqPending(b);
      return `<tr><td>${esc(b.item)}</td><td>${num(d)} / ${num(b.qty)} ${esc(b.unit)}</td><td>${bar(pct(d,b.qty),pct(pe,b.qty))}<small>${pct(d,b.qty)}%${pe?` (+${pct(pe,b.qty)}% ממתין)`:""}</small></td></tr>`; }).join("")}</tbody></table>
    <h4>אישורים אחרונים</h4><div class="timeline">${recent.map(r=>`<div class="timeline-item">${fmtDate(r.date)} · ${esc(B(r.boqId)?.item)} · ${num(r.qty)} ${esc(B(r.boqId)?.unit)} · ${uname(r.userId)}</div>`).join("") || `<span class="muted">אין</span>`}</div></div>`; }).join("")}</div>`;
}

/* ============================== INDEX 09 · מחסן ============================== */
function warehouse(){
  const low = DB.stock.filter(s => s.qty < s.min), toRecv = DB.requests.filter(r => r.status===REQ.ORDERED);
  const acts = (can("stockMove")?`<button class="dark" onclick="openMove('in')">⬇ קליטה</button><button class="dark" onclick="openMove('out')">⬆ ניפוק לפרויקט</button>`:"") + (can("admin")?`<button onclick="openStockItem()">+ פריט</button>`:"");
  const rows = DB.stock.map(s => [esc(matName(s.mat)), `<b>${num(s.qty)}</b>`, num(s.min), MATERIALS[s.mat].unit, esc(s.location),
    s.qty < s.min ? tag("מתחת למינימום","danger") : tag("תקין","success"),
    `<div class="actions">${can("createRequest")&&s.qty<s.min?`<button class="small" onclick="openRequest('${s.mat}')">+ דרישת רכש</button>`:""}${can("stockMove")?`<button class="small" onclick="openStockEdit('${s.mat}')">ערוך / ספירה</button>`:""}</div>`]);
  const mv = DB.movements.slice().sort((a,b)=>b.at.localeCompare(a.at)).slice(0,40).map(m => [fmtTime(m.at), m.adjust?tag("ספירה","info"):m.type==="in"?tag("קליטה","success"):tag("ניפוק","warning"), esc(matName(m.mat)), num(m.qty),
    m.type==="out" ? pname(m.projectId) + (m.toUserId?` ← ${uname(m.toUserId)}`:"") : "מחסן מרכזי", uname(m.userId), esc(m.note||""),
    m.signature ? `<button class="small" onclick="showSig(${m.id})">✍ צפה</button>` : "-"]);
  return `<div class="grid kpis">${kpi("סוגי פריטים", DB.stock.length)}${kpi("מתחת למינימום", low.length,"",low.length?"attn":"")}${kpi("משלוחים בדרך", toRecv.length)}${kpi("תנועות היום", DB.movements.filter(m=>m.at.slice(0,10)===today()).length)}</div>`
   + head("מלאי נוכחי", acts, "stockT", "מלאי") + table("stockT", ["פריט","כמות","מינימום","יחידה","מיקום","מצב",""], rows, {actions:true})
   + (toRecv.length ? `<div class="section-title"><h3>משלוחים שממתינים לקליטה</h3></div>` + table("recvT",["הזמנה","פריט","כמות","ספק","פרויקט",""], toRecv.map(r=>[r.id,esc(matName(r.mat)),num(r.qty),esc(DB.suppliers.find(s=>s.id===r.supplierId)?.name||"-"),pname(r.projectId), can("receive")?`<button class="small dark" onclick="openReceive(${r.id})">קלוט + חתימה</button>`:""]),{actions:true}) : "")
   + head("תנועות מלאי אחרונות", "", "movT", "תנועות-מלאי") + table("movT", ["זמן","סוג","פריט","כמות","יעד","בוצע ע״י","הערה","חתימה"], mv, {empty:"אין תנועות"});
}

/* ============================== INDEX 10 · רכש ============================== */
function purchasing(){
  const sf = fv("qstatus","open");
  const list = DB.requests.filter(r => canSeeProject(r.projectId) && matchP(r.projectId) && (sf==="all" || (sf==="open" ? ![REQ.SUPPLIED,REQ.REJECTED].includes(r.status) : r.status===sf))).sort((a,b)=>b.id-a.id);
  const cnt = s => DB.requests.filter(r => r.status===s).length;
  const rows = list.map(r => { const sup = DB.suppliers.find(s=>s.id===r.supplierId);
    const act = [];
    if (r.status===REQ.WAIT_CEO && can("approveOver")) act.push(`<button class="small dark" onclick="ceoDecide(${r.id},true)">אשר חריגה</button><button class="small danger" onclick="ceoDecide(${r.id},false)">דחה</button>`);
    if (r.status===REQ.APPROVED && can("orderRequest")) act.push(`<button class="small dark" onclick="openOrder(${r.id})">בחר ספק והזמן</button>`);
    if (r.status===REQ.ORDERED && can("receive")) act.push(`<button class="small dark" onclick="openReceive(${r.id})">קלוט במחסן</button>`);
    if (r.status===REQ.ORDERED || r.status===REQ.SUPPLIED) act.push(`<button class="small" onclick="printPO(${r.id})">🖨 הזמנה</button>`);
    act.push(`<button class="small" onclick="viewRequest(${r.id})">פרטים</button>`);
    const row = [r.id, fmtDate(r.date), pname(r.projectId), esc(matName(r.mat)), `${num(r.qty)} ${MATERIALS[r.mat]?.unit||""}`,
      sup ? `${esc(sup.name)}<br><small>${money(r.price)} ליח׳ · סה״כ ${money(r.price*r.qty)}</small>` : "-", uname(r.requestedBy),
      st(r.status) + (r.over?`<br><small class="danger-text">⚠ ${esc(r.overMsg)}</small>`:""), `<div class="actions">${act.join("")}</div>`];
    if (r.status===REQ.WAIT_CEO) row._cls = "row-late"; return row; });
  return `<div class="grid kpis">${kpi("ממתין למנכ״ל",cnt(REQ.WAIT_CEO),"",cnt(REQ.WAIT_CEO)?"attn":"")}${kpi("ממתין להזמנה",cnt(REQ.APPROVED))}${kpi("הוזמן — בדרך",cnt(REQ.ORDERED))}${kpi("סופק החודש",DB.requests.filter(r=>r.status===REQ.SUPPLIED&&r.suppliedAt&&r.suppliedAt.slice(0,7)===monthKey()).length)}</div>
  <div class="notice flow">זרימה: דרישה ← בדיקת חריגה מול כתב כמויות ומלאי ← (חריגה: אישור מנכ״ל) ← השוואת ספקים והזמנה ← אספקה ← קליטה וחתימת מחסנאי ← מלאי ← עלות פרויקט</div>`
   + head(`דרישות רכש (${list.length})`, projectSelect("project") + `<select class="filter" onchange="setFilter('qstatus',this.value)">${optionList([["open","פתוחות"],["all","הכל"],...Object.values(REQ).map(s=>[s,s])],sf)}</select>` + (can("createRequest")?`<button class="dark" onclick="openRequest()">+ דרישת רכש</button>`:""), "reqT", "רכש")
   + table("reqT", ["מס׳","תאריך","פרויקט","פריט","כמות","ספק / מחיר","מבקש","סטטוס","פעולות"], rows, {actions:true, empty:"אין דרישות בסינון"});
}

/* ============================== INDEX 11 · ספקים ============================== */
function suppliers(){
  const mats = Object.keys(MATERIALS);
  const rows = DB.suppliers.map(s => [`<b>${esc(s.name)}</b>`, esc(s.contact||"-"), esc(s.phone||"-"), Object.keys(s.prices||{}).length,
    DB.requests.filter(r=>r.supplierId===s.id).length, can("manageSuppliers")?`<button class="small" onclick="openSupplier(${s.id})">ערוך מחירון</button>`:""]);
  const cmp = mats.map(m => { const offers = DB.suppliers.filter(s => s.prices?.[m]).map(s => [s.name, s.prices[m]]).sort((a,b)=>a[1]-b[1]);
    if (!offers.length) return null; const best = offers[0][1], worst = offers[offers.length-1][1];
    return [esc(matName(m)), offers.map((o,i)=>`${i===0?"🏆 ":""}${esc(o[0])}: ${money(o[1])}`).join("<br>"), money(best), offers.length>1?`${pct(worst-best,worst)}%`:"-"]; }).filter(Boolean);
  return head(`ספקים (${DB.suppliers.length})`, can("manageSuppliers")?`<button class="dark" onclick="openSupplier()">+ ספק</button>`:"", "supT", "ספקים")
   + table("supT", ["ספק","איש קשר","טלפון","פריטים במחירון","הזמנות",""], rows, {actions:true})
   + head("השוואת מחירים לפי פריט", "", "cmpT", "השוואת-ספקים") + table("cmpT", ["פריט","הצעות (מהזול ליקר)","המחיר הזול","חיסכון מול היקר"], cmp);
}

/* ============================== INDEX 12 · כתב כמויות ============================== */
function boq(){
  const pid = curProject(false); if (!pid) return `<div class="card empty">אין פרויקטים</div>`;
  const lines = projectBoq(pid), m = can("seeMoney");
  let tq = 0, tv = 0, tc = 0;
  const rows = lines.map(b => { const d = boqDone(b), pe = boqPending(b), rem = b.qty - d; tq += b.qty*b.sale; tv += d*b.sale; tc += d*b.cost;
    const r = [`<b>${esc(b.item)}</b>${b.extra?" "+(isExtraPending(b)?tag("חריג — ממתין לאישור מזמין","danger"):tag("חריג מאושר","info")):""}`, esc(b.unit), num(b.qty), num(d), pe?num(pe):"-", rem<0?`<span class="danger-text">${num(rem)}</span>`:num(rem), `${pct(d,b.qty)}%`,
      ...(m?[money(b.sale), money(b.cost), money(d*b.sale)]:[]), can("editBoq")?`<button class="small" onclick="openBoqLine(${b.id})">ערוך</button>`:""];
    if (rem < 0) r._cls = "row-late"; return r; });
  const boqDocs = DB.docs.filter(d => d.projectId===+pid && d.cat==="כתב כמויות");
  const xp = lines.filter(isExtraPending);
  return head("כתב כמויות", projectSelect("project", false) + (can("editBoq")?`<button class="dark" onclick="openAiBoq(${pid})">🤖 קרא כתב כמויות (צילום / אקסל)</button><button onclick="openBoqImport(${pid})">📋 הדבקה מאקסל</button><button onclick="openBoqLine(null,${pid})">+ סעיף</button>`:""), "boqT", "כתב-כמויות-"+(P(pid)?.name||""))
   + (boqDocs.length ? `<div class="notice">📑 כתב הכמויות המקורי: ${boqDocs.map(d => d.data ? `<button class="small" onclick="openDoc(${d.id})">${esc(d.name)}</button>${can("editBoq")?`<button class="small" onclick="aiReadBoqDoc(${d.id})">🤖 קרא סעיפים</button>`:""}` : esc(d.name)).join(" ")}</div>` : `<div class="notice warn">לא צורף קובץ/צילום של כתב הכמויות לפרויקט זה. <button class="small" onclick="go('docs')">העלה במסמכים</button></div>`)
   + (xp.length ? `<div class="notice warn">⚠ ${xp.length} עבודות חריגות ממתינות לתמחור ואישור המזמין — הביצוע שלהן לא נכלל בחשבון ללקוח עד לאישור.${S.user.role==="ceo"?" לחץ \"ערוך\" בשורה כדי לאשר.":""}</div>` : "")
   + table("boqT", ["סעיף","יחידה","כמות חוזית","בוצע (מאושר)","ממתין לאישור","יתרה","%",...(m?["מחיר מכירה","עלות ליח׳","שווי ביצוע"]:[]),""], rows,
     {actions:true, foot: m ? ["<b>סה״כ</b>","","","","","","",`היקף ${money(tq)}`,`עלות ${money(tc)}`,`<b>${money(tv)}</b>`,""] : null, empty:"אין סעיפים — הוסף סעיף ראשון"})
   + `<p class="muted">"בוצע" כולל רק כמויות שאושרו ע״י מהנדס (כמות פתיחה + דיווחי שטח מאושרים).</p>`;
}

/* ============================== INDEX 13 · חשבונות ============================== */
function billLinesFor(pid){
  const prev = DB.bills.filter(b => b.projectId===+pid && b.status!=="טיוטה").sort((a,b)=>b.id-a.id)[0];
  return projectBoq(pid).filter(b => !isExtraPending(b)).map(b => { const pc = prev?.lines.find(l=>l.boqId===b.id)?.cum || 0; const cum = boqDone(b);
    return {boqId:b.id,item:b.extra ? b.item + " (עבודה חריגה)" : b.item,unit:b.unit,prevCum:pc,cum,price:b.sale}; });
}
function billing(){
  const pid = curProject(false); if (!pid) return `<div class="card empty">אין פרויקטים</div>`;
  const lines = billLinesFor(pid), total = lines.reduce((a,l)=>a+(l.cum-l.prevCum)*l.price,0);
  const pend = DB.reports.filter(r=>r.projectId===+pid && r.status==="pending").length;
  const draft = DB.bills.find(b => b.projectId===+pid && b.status==="טיוטה");
  const bills = DB.bills.filter(b => canSeeProject(b.projectId)).sort((a,b)=>b.id-a.id);
  return head("טיוטת חשבון לתקופה הנוכחית", projectSelect("project", false))
   + (pend?`<div class="notice warn">⚠ יש ${pend} דיווחי שטח ממתינים לאישור בפרויקט זה — הם <b>לא</b> נכללים בחשבון עד שיאושרו.</div>`:"")
   + (() => { const xs = projectBoq(pid).filter(b => isExtraPending(b) && boqDone(b) > 0); return xs.length ? `<div class="notice warn">⚠ עבודות חריגות שבוצעו וממתינות לאישור המזמין (לא נכללות בחשבון): ${xs.map(b => `<b>${esc(b.item)}</b> ${num(boqDone(b))} ${esc(b.unit)}`).join(" · ")} <button class="small" onclick="go('boq')">לתמחור ואישור</button></div>` : ""; })()
   + table("billPrev", ["סעיף","יחידה","מצטבר קודם","מצטבר נוכחי","כמות לתקופה","מחיר","סכום לתקופה"],
     lines.map(l => [esc(l.item), esc(l.unit), num(l.prevCum), num(l.cum), `<b>${num(l.cum-l.prevCum)}</b>`, money(l.price), money((l.cum-l.prevCum)*l.price)]),
     {foot:["<b>סה״כ לתקופה (לפני מע״מ)</b>","","","","","",`<b>${money(total)}</b>`]})
   + `<div class="actions" style="margin:12px 0">${can("billing") ? (draft ? `<span class="muted">קיימת טיוטה (#${draft.id}) לפרויקט זה</span> <button onclick="viewBill(${draft.id})">פתח טיוטה</button>` : `<button class="dark" ${total<=0?"disabled":""} onclick="createBill(${pid})">הפק חשבון מהכמויות המאושרות</button>`) : ""}<button class="ghost" onclick="exportTable('billPrev','חשבון-טיוטה')">⬇ Excel</button></div>`
   + head("חשבונות שהופקו", "", "billsT", "חשבונות")
   + table("billsT", ["מס׳","פרויקט","תקופה","תאריך","סכום","סטטוס","פעולות"], bills.map(b => [b.id, pname(b.projectId), b.period, fmtDate(b.date), money(b.total), st(b.status),
      `<div class="actions"><button class="small" onclick="viewBill(${b.id})">הצג / הדפס</button>${can("billing")&&b.status==="טיוטה"?`<button class="small dark" onclick="setBillStatus(${b.id},'נשלח')">אשר ושלח</button><button class="small danger" onclick="delBill(${b.id})">מחק</button>`:""}${can("markPaid")&&b.status==="נשלח"?`<button class="small dark" onclick="setBillStatus(${b.id},'שולם')">סמן כשולם</button>`:""}</div>`]), {actions:true})
   + subBillsSection();
}
/* ---------- חשבונות קבלני משנה (חודשי) ---------- */
/* חשבונות שממתינים לאישור שלי: מהנדס — חודש קודם שעוד לא אושר; מנכ״ל — אושר ע״י מהנדס */
function subsWaiting(){
  if (!can("billing")) return [];
  const out = [], pers = S.user.role==="ceo" ? monthsBack(3) : monthsBack(2).slice(1);
  DB.users.filter(u => ["worker","contractor"].includes(u.role)).forEach(u => pers.forEach(per => {
    const total = subStatementLines(u.id, per).reduce((a,l)=>a+l.total,0); if (!total) return;
    const sb = (DB.subbills||[]).filter(s => s.userId===u.id && s.period===per).pop();
    if (S.user.role==="ceo" ? sb?.status===SUB.ENG : (!sb || sb.status===SUB.DRAFT)) out.push({uid:u.id, per, total});
  }));
  return out;
}
function monthsBack(n){ const out = []; const d = new Date(today()+"T12:00:00"); d.setDate(1); for (let i=0;i<n;i++){ out.push(isoLocal(d).slice(0,7)); d.setMonth(d.getMonth()-1); } return out; }
function subBillsSection(){
  const per = fv("subPeriod", monthKey());
  const people = DB.users.filter(u => ["worker","contractor"].includes(u.role) && (u.active || subStatementLines(u.id, per).length));
  const rows = people.map(u => { const lines = subStatementLines(u.id, per), total = lines.reduce((a,l)=>a+l.total,0), x = lines.filter(l=>l.extra).reduce((a,l)=>a+l.total,0);
    const sb = (DB.subbills||[]).filter(s => s.userId===u.id && s.period===per).pop(), es = earnSummary(u.id, per), au = statementAudit(u.id, per);
    const diff = sb && Math.abs(sb.total-total) > 1;
    const status = sb ? st(sb.status) + (diff ? `<br><small class="danger-text">${sb.status===SUB.PAID?"עבודה נוספת אחרי התשלום":"השתנה מאז האישור"}: ${money(total-sb.total)}</small>` : "") : total ? tag("ממתין לאישור מהנדס","warning") : "-";
    const mine = (S.user.role!=="ceo" && total>0 && (!sb || sb.status===SUB.DRAFT || diff)) || (S.user.role==="ceo" && sb?.status===SUB.ENG && !diff);
    return [`<b>${esc(u.name)}</b><br><small class="muted">${ROLES[u.role]}</small>`, es.days, money(total), x?`${money(x)}`:"-", es.pending?`${money(es.pending)}`:"-",
      au.issues.length ? au.issues.map(i => `<small class="fl-${i[0]}">• ${esc(i[1])}</small>`).join("<br>") : `<small class="success-text">✓ תקין</small>`, status,
      `<div class="actions"><button class="small ${mine?"dark":""}" onclick="viewSub(${u.id},'${per}')">${mine?"בדוק ואשר":"הצג / הדפס"}</button>${can("markPaid") && sb?.status===SUB.OK ? `<button class="small dark" onclick="paySub(${sb.id})">סמן כשולם</button>`:""}</div>`]; });
  return head("חשבונות עובדים וקבלנים — לפי חודש", `<select class="filter" onchange="setFilter('subPeriod',this.value)">${optionList(monthsBack(6).map(m=>[m,m]), per)}</select>`, "subT", "חשבונות-עובדים-וקבלנים-"+per)
   + `<div class="notice flow">תהליך: כל דיווח שהמהנדס מאשר נכנס אוטומטית לחשבון של העובד/הקבלן ← בסוף החודש ה-AI בודק את החשבון ← <b>מהנדס מאשר</b> ← <b>מנכ״ל מאשר לתשלום</b> ← שולם</div>`
   + table("subT", ["שם","ימי עבודה","מגיע (מאושר, לפני מע״מ)","מתוכו חריגים","ממתין לאישור דיווחים","בדיקת AI","סטטוס",""], rows, {actions:true, empty:"אין עובדים או קבלנים"})
   + `<p class="muted">הסכום מחושב מכל דיווח שאושר ע״י מהנדס × "מחיר לביצוע" של הסעיף בכתב הכמויות.</p>`;
}

/* ============================== INDEX 14 · כספים ורווחיות ============================== */
function finance(){
  const ps = visibleProjects(); let T_ = {contract:0,executed:0,cost:0,billed:0,paid:0,budget:0,purchases:0};
  const rows = ps.map(p => { const s = projStats(p.id); Object.keys(T_).forEach(k => T_[k] += s[k]);
    const r = [`<b>${esc(p.name)}</b>`, money(s.contract), money(s.executed), money(s.cost), money(s.profit), `${s.margin}%`, money(s.budget), `${bar(s.budgetUse)}<small>${s.budgetUse}% (ביצוע ${s.progress}%)</small>`, money(s.billed), money(s.paid),
      s.budgetUse > s.progress + 8 ? tag("סיכון חריגה","danger") : s.margin < 20 && s.executed ? tag("רווח נמוך","warning") : tag("תקין","success")];
    return r; });
  const byType = {}; DB.boq.filter(b => canSeeProject(b.projectId)).forEach(b => { const d = boqDone(b); const k = b.type; byType[k] = byType[k] || {rev:0,cost:0}; byType[k].rev += d*b.sale; byType[k].cost += d*b.cost; });
  const profit = T_.executed - T_.cost;
  return `<div class="grid kpis">${kpi("היקף חוזים", money(T_.contract))}${kpi("הכנסה מביצוע", money(T_.executed))}${kpi("עלות ביצוע", money(T_.cost))}${kpi("רווח גולמי", money(profit), `שיעור רווח ${pct(profit,T_.executed)}%`)}${kpi("חויב ללקוחות", money(T_.billed))}${kpi("טרם נגבה", money(T_.billed-T_.paid),"",T_.billed-T_.paid>0?"attn":"")}</div>`
   + head("רווחיות לפי פרויקט", "", "finT", "רווחיות")
   + table("finT", ["פרויקט","היקף חוזה","הכנסה מביצוע","עלות","רווח","%","תקציב עלות","ניצול תקציב","חויב","נגבה","מצב"], rows)
   + head("רווח לפי סוג עבודה", "", "finTypeT", "רווח-לפי-סעיף")
   + table("finTypeT", ["סוג עבודה","הכנסה","עלות","רווח","שיעור רווח"], Object.entries(byType).map(([k,v]) => [esc(WORK[k]?.name||k), money(v.rev), money(v.cost), money(v.rev-v.cost), `${pct(v.rev-v.cost,v.rev)}%`]))
   + `<p class="muted">רכש שהוזמן/סופק עד כה: ${money(T_.purchases)}. עלות הביצוע מחושבת לפי עלות ליחידה בכתב הכמויות (חומר + עבודה + קבלן משנה).</p>`;
}

/* ============================== INDEX 15 · מכרזים ============================== */
function tenderCalc(t){
  let cost = 0, price = 0;
  t.lines.forEach(l => { const uc = l.sub > 0 ? l.sub : l.cost; cost += uc*l.qty; price += Math.round(uc*(1+t.markup/100)*100)/100*l.qty; });
  return {cost, price, profit:price-cost};
}
function tenders(){
  const rows = DB.tenders.slice().sort((a,b)=>b.id-a.id).map(t => { const c = tenderCalc(t);
    return [`<b>${esc(t.name)}</b>`, esc(t.client), fmtDate(t.due), t.lines.length, money(c.cost), money(c.price), `${money(c.profit)} (${pct(c.profit,c.price)}%)`, st(t.status),
     `<div class="actions"><button class="small" onclick="openTender(${t.id})">פתח</button>${t.status==="זכינו"&&!t.projectId?`<button class="small dark" onclick="tenderToProject(${t.id})">צור פרויקט</button>`:""}</div>`]; });
  const hist = Object.keys(WORK).filter(k=>k!=="other").map(k => { const h = priceHistory(k); return h.length ? [esc(WORK[k].name), h.slice(0,4).map(x=>`${esc(x.src)}: ${money(x.price)}`).join("<br>"), money(Math.min(...h.map(x=>x.price))), money(Math.max(...h.map(x=>x.price)))] : null; }).filter(Boolean);
  return head(`מכרזים (${DB.tenders.length})`, can("tenders")?`<button class="dark" onclick="openTender()">+ מכרז חדש</button>`:"", "tenT", "מכרזים")
   + table("tenT", ["מכרז","מזמין","הגשה","סעיפים","עלות פנימית","מחיר הצעה","רווח צפוי","סטטוס",""], rows, {actions:true, empty:"אין מכרזים"})
   + head("היסטוריית מחירי מכירה (למכרז הבא)", "", "histT", "היסטוריית-מחירים")
   + table("histT", ["סוג עבודה","מחירים אחרונים","מינימום","מקסימום"], hist);
}
function priceHistory(type){
  const h = [];
  DB.boq.filter(b => b.type===type).forEach(b => h.push({src:P(b.projectId)?.name||"פרויקט", price:b.sale}));
  DB.tenders.forEach(t => t.lines.filter(l=>l.type===type).forEach(l => { const uc = l.sub>0?l.sub:l.cost; h.push({src:"מכרז "+t.name, price:Math.round(uc*(1+t.markup/100))}); }));
  return h;
}

/* ============================== INDEX 16 · AI Control ============================== */
function ai(){
  const f = aiFindings(), c = l => f.filter(x=>x.lvl===l).length;
  const pend = DB.reports.filter(r => r.status==="pending" && canSeeProject(r.projectId));
  return `<div class="notice">🤖 <b>AI Control</b> סורק כל הזמן את הנתונים: דיווחי שטח (תמונה, GPS, כמויות), תקציב מול ביצוע, לוחות זמנים, מלאי, רכש וגבייה. ההמלצות הן <b>תמיד</b> לאישור אנושי — המערכת לא מאשרת לבד.<br><small class="muted">בגרסה זו המנוע מבוסס כללים ורץ בדפדפן (כולל ניתוח בהירות תמונה ומרחק GPS). חיבור לשירות ראייה ממוחשבת אמיתי מתבצע בשלב ה-Backend.</small></div>
  <div class="grid kpis">${kpi("קריטי",c("high"),"",c("high")?"attn":"")}${kpi("בינוני",c("mid"))}${kpi("נמוך",c("low"))}${kpi("דיווחים לבדיקה",pend.length)}</div>
  <div class="section-title"><h3>ממצאים</h3></div><div class="card timeline">${f.map(findingItem).join("") || `<div class="muted">אין ממצאים 👍</div>`}</div>
  <div class="section-title"><h3>ניתוח דיווחי שטח ממתינים</h3></div>
  ${table("aiRepT", ["#","פרויקט","משימה","עובד","כמות","ציון","המלצה","ממצאים",""], pend.map(r => { const a = analyzeReport(r);
    return [r.id, pname(r.projectId), esc(T(r.taskId)?.title||"-"), uname(r.userId), num(r.qty), scoreTag(a.score), esc(a.rec), a.flags.filter(x=>x[0]!=="ok").map(x=>"• "+esc(x[1])).join("<br>") || "-",
      can("approveReport")?`<button class="small dark" onclick="openApprove(${r.id})">בדוק</button>`:""]; }), {actions:true, empty:"אין דיווחים ממתינים"})}`;
}

/* ============================== INDEX 17 · התראות ============================== */
function alerts(){
  const ns = myNotes(), f = aiFindings();
  return head(`הודעות (${ns.filter(n=>!n.readBy.includes(S.user.id)).length} חדשות)`, ns.length?`<button class="small" onclick="markAllRead()">סמן הכל כנקרא</button>`:"")
   + `<div class="card timeline">${ns.slice(0,50).map(n => `<div class="timeline-item ${n.readBy.includes(S.user.id)?"read":"unread"}"><small class="muted">${fmtTime(n.at)}</small><br>${esc(n.text)} ${n.module&&ROLE_ACCESS[S.user.role].includes(n.module)?`<button class="small link" onclick="readNote(${n.id})">עבור ←</button>`:""}</div>`).join("") || `<div class="muted">אין הודעות</div>`}</div>
   <div class="section-title"><h3>התראות מערכת פעילות</h3></div><div class="card timeline">${f.map(findingItem).join("") || `<div class="muted">אין התראות פעילות 👍</div>`}</div>`;
}

/* ============================== INDEX 18 · מסמכים ============================== */
function docs(){
  const cf = fv("dcat","all");
  const list = DB.docs.filter(d => (d.projectId ? canSeeProject(d.projectId) : true) && (curProject()==="all" || String(d.projectId)===String(curProject())) && (cf==="all" || d.cat===cf)).sort((a,b)=>b.at.localeCompare(a.at));
  return head(`מסמכים (${list.length})`, projectSelect("project") + `<select class="filter" onchange="setFilter('dcat',this.value)">${optionList([["all","כל הסוגים"],...DOC_CATS.map(c=>[c,c])],cf)}</select>` + (can("docs")?`<button class="dark" onclick="openDocUpload()">+ העלאת מסמך</button>`:""), "docT", "מסמכים")
   + table("docT", ["שם","סוג","פרויקט","הועלה ע״י","תאריך","גודל",""], list.map(d => [`📄 ${esc(d.name)}`, tag(d.cat), d.projectId?pname(d.projectId):"כללי", uname(d.by), fmtDate(d.at), d.size?`${num(Math.round(d.size/1024))} KB`:"-",
     `<div class="actions">${d.data?`<button class="small" onclick="openDoc(${d.id})">פתח</button>`:`<small class="muted">רשומה בלבד</small>`}${can("docs")?`<button class="small danger" onclick="delDoc(${d.id})">מחק</button>`:""}</div>`]), {actions:true, empty:"אין מסמכים"});
}

/* ============================== INDEX 19 · פגישות ============================== */
function meetings(){
  const list = DB.meetings.filter(m => (!m.projectId || canSeeProject(m.projectId)) && matchP(m.projectId)).sort((a,b)=>b.date.localeCompare(a.date));
  const up = list.filter(m => m.date >= today()).reverse(), past = list.filter(m => m.date < today());
  const card = m => `<div class="card"><div class="tags">${m.date>=today()?tag("קרובה","info"):tag("התקיימה")}</div><h3>${esc(m.title)}</h3>
    <span class="muted">${fmtDate(m.date)} ${esc(m.time||"")} · ${m.projectId?pname(m.projectId):"כללי"}</span><p><b>משתתפים:</b> ${esc(m.participants||"-")}</p>
    ${m.summary?`<p><b>סיכום:</b> ${esc(m.summary)}</p>`:""}
    ${m.decisions.length?`<b>החלטות:</b><div class="timeline">${m.decisions.map((d,i)=>`<div class="timeline-item">${esc(d.text)} ${d.taskId?tag("נוצרה משימה","success"):can("createTask")?`<button class="small link" onclick="decisionToTask(${m.id},${i})">→ צור משימה</button>`:""}</div>`).join("")}</div>`:""}
    ${can("meetings")?`<div class="actions"><button class="small" onclick="openMeeting(${m.id})">ערוך / סכם</button><button class="small" onclick="meetingICS(${m.id})">📅 ליומן</button></div>`:""}</div>`;
  return head("פגישות והחלטות", projectSelect("project") + (can("meetings")?`<button class="dark" onclick="openMeeting()">+ פגישה</button>`:""))
   + `<div class="section-title"><h3>פגישות קרובות</h3></div><div class="grid split2">${up.map(card).join("") || `<div class="card empty">אין פגישות קרובות</div>`}</div>
   <div class="section-title"><h3>פגישות שהתקיימו</h3></div><div class="grid split2">${past.map(card).join("") || `<div class="card empty">אין</div>`}</div>`;
}

/* ============================== INDEX 20 · ניהול והרשאות ============================== */
function admin(){
  const mods = MODULES.map(m => m[0]);
  const matrix = Object.keys(ROLES).map(r => [`<b>${ROLES[r]}</b>`, ...mods.map(m => ROLE_ACCESS[r].includes(m) ? "✓" : "")]);
  return `<div class="card"><h3>הגדרות חברה</h3><div class="form-grid"><div><label>שם החברה</label><input id="set_company" value="${esc(DB.settings.company)}"></div><div style="align-self:end"><button class="dark" onclick="saveSettings()">שמור</button></div></div></div>`
   + head(`משתמשים (${DB.users.length})`, `<button class="dark" onclick="openUser()">+ משתמש</button>`, "usersT", "משתמשים")
   + table("usersT", ["שם","תפקיד",CLOUD.enabled?"מייל כניסה":"קוד כניסה","פרויקטים מותרים","סטטוס",""], DB.users.map(u => [esc(u.name), ROLES[u.role], CLOUD.enabled ? (u.email?esc(u.email):tag("חסר מייל — לא יכול להיכנס","danger")) : "••••", u.projects==="all"?"הכל":u.projects.map(pname).join(", ")||"-", u.active?tag("פעיל","success"):tag("מושבת","danger"),
     `<div class="actions"><button class="small" onclick="openUser(${u.id})">ערוך / איפוס קוד</button>${u.id!==S.user.id?`<button class="small ${u.active?"danger":""}" onclick="toggleUser(${u.id})">${u.active?"השבת":"הפעל"}</button>`:""}</div>`]), {actions:true})
   + head("מטריצת הרשאות — מסכים לפי תפקיד") + `<div class="table-wrap"><table class="matrix"><thead><tr><th>תפקיד</th>${MODULES.map(m=>`<th title="${m[3]}">${m[2]}<br><small>${m[1].replace("INDEX ","")}</small></th>`).join("")}</tr></thead><tbody>${matrix.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
   + head("Audit Log — פעולות קריטיות", "", "auditT", "audit-log") + table("auditT", ["זמן","משתמש","תפקיד","פעולה","פרטים"], DB.audit.slice(0,150).map(a => [fmtTime(a.at), esc(a.user), ROLES[a.role]||"", esc(a.action), esc(a.detail)]))
   + `<div class="card"><h3>גיבוי ושחזור</h3><p class="muted">${CLOUD.enabled?"הנתונים נשמרים בענן (Supabase) ומסונכרנים בין כל המכשירים. גיבוי JSON הוא שכבת הגנה נוספת.":"כל הנתונים נשמרים כרגע בדפדפן של המכשיר הזה. מומלץ לגבות באופן קבוע."}</p><div class="actions">
     <button class="dark" onclick="exportBackup()">⬇ גיבוי מלא (JSON)</button><label class="file-btn">⬆ שחזור מגיבוי<input type="file" accept=".json,application/json" hidden onchange="importBackup(this)"></label>
     ${CLOUD.enabled?"":`<button class="danger" onclick="resetDemo()">איפוס לנתוני ההדגמה</button><button class="danger" onclick="startEmpty()">🆕 התחל מערכת ריקה (לעבודה אמיתית)</button>`}</div></div>`;
}

const VIEWS = {dashboard,projects,plans,tasks,people,fieldAI,daily,progress,warehouse,purchasing,suppliers,boq,billing,finance,tenders,ai,alerts,docs,meetings,admin};

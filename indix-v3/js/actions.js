"use strict";
/* =========================================================================
   INDIX — פעולות, טפסים וזרימות עבודה
   ========================================================================= */

function req(cond, msg){ if (!cond){ toast(msg, "danger"); return false; } return true; }

/* ------------------------------ פעולה חדשה (מהירה) ------------------------------ */
function openQuickAdd(){
  const items = [
    ["manageProjects","🏗️ פרויקט חדש","openProjectForm()"], ["createTask","✅ משימה","openTaskForm()"],
    ["fieldReport","📸 דיווח שטח","closeModal();go('fieldAI')"], ["createRequest","🛒 דרישת רכש","openRequest()"],
    ["stockMove","📦 תנועת מלאי","openMove('in')"], ["meetings","📅 פגישה","openMeeting()"],
    ["docs","📄 מסמך","openDocUpload()"], ["tenders","🧮 מכרז","openTender()"], ["managePlans","📐 תוכנית","openPlanUpload()"]
  ].filter(i => can(i[0]));
  openModal(`<h2>פעולה חדשה</h2><div class="quick-grid">${items.map(i => `<button onclick="${i[2]}">${i[1]}</button>`).join("")}</div>`);
}

/* ------------------------------ פרויקטים ------------------------------ */
function openProject(id){
  const p = P(id); if (!p || !canSeeProject(id)) return;
  const s = projStats(id), m = can("seeMoney");
  const team = DB.users.filter(u => u.active && (u.projects==="all" ? ["engineer","ceo"].includes(u.role) : u.projects.includes(p.id)));
  const openT = DB.tasks.filter(t => t.projectId===p.id && t.status!=="הושלם").length;
  const openR = DB.requests.filter(r => r.projectId===p.id && ![REQ.SUPPLIED,REQ.REJECTED].includes(r.status)).length;
  const next = DB.meetings.filter(x => x.projectId===p.id && x.date>=today()).sort((a,b)=>a.date.localeCompare(b.date))[0];
  const link = (mod, txt) => ROLE_ACCESS[S.user.role].includes(mod) ? `<button class="small" onclick="S.filters.project='${p.id}';closeModal();go('${mod}')">${txt}</button>` : "";
  openModal(`<h2>${esc(p.name)}</h2><p class="muted">${esc(p.client)} · ${st(p.status)} · מנהל: ${uname(p.managerId)} · ${fmtDate(p.start)} – ${fmtDate(p.end)}</p>
   ${bar(s.progress)}<b>${s.progress}% ביצוע</b>
   ${m?`<div class="grid kpis mini-kpis">${kpi("היקף חוזה",money(s.contract))}${kpi("בוצע",money(s.executed))}${kpi("עלות",money(s.cost),`${s.budgetUse}% מהתקציב`)}${kpi("רווח",money(s.profit),`${s.margin}%`)}</div>`:""}
   <p>משימות פתוחות: <b>${openT}</b> · דרישות רכש פתוחות: <b>${openR}</b>${next?` · פגישה הבאה: <b>${fmtDate(next.date)}</b>`:""}</p>
   <p><b>צוות:</b> ${team.map(u=>`${esc(u.name)} (${ROLES[u.role]})`).join(", ")||"-"}</p>
   ${p.lat?`<p>📍 <a href="https://maps.google.com/?q=${p.lat},${p.lng}" target="_blank" rel="noopener">מיקום האתר במפה</a> <small class="muted">(משמש לבדיקת GPS של דיווחים)</small></p>`:`<p class="notice warn">לא הוגדר מיקום לאתר — בדיקת ה-GPS של AI לא תפעל לפרויקט זה.</p>`}
   <div class="actions">${link("tasks","✅ משימות")}${link("plans","📐 תוכניות")}${link("fieldAI","📸 שטח")}${link("daily","📋 יומן")}${link("boq","📑 כתב כמויות")}${link("billing","💰 חשבונות")}${link("purchasing","🛒 רכש")}${link("docs","📄 מסמכים")}${link("meetings","📅 פגישות")}</div>
   ${can("manageProjects")?`<hr><button class="dark" onclick="openProjectForm(${p.id})">ערוך פרויקט</button>`:""}`, true);
}
function openProjectForm(id){
  if (!guard("manageProjects")) return;
  const p = id ? P(id) : {name:"",client:"",budget:"",status:"פעיל",managerId:S.user.role==="engineer"?S.user.id:2,lat:"",lng:"",start:today(),end:addDays(180)};
  const engs = DB.users.filter(u => ["engineer","ceo"].includes(u.role) && u.active).map(u => [u.id,u.name]);
  openModal(`<h2>${id?"עריכת פרויקט":"פרויקט חדש"}</h2><div class="form-grid">
   <div><label>שם פרויקט *</label><input id="np_name" value="${esc(p.name)}"></div><div><label>לקוח / מזמין *</label><input id="np_client" value="${esc(p.client)}"></div>
   <div><label>תקציב עלות (₪)</label><input id="np_budget" type="number" value="${esc(p.budget)}"></div>
   <div><label>סטטוס</label><select id="np_status">${optionList(["פעיל","תכנון","מושהה","הסתיים"].map(x=>[x,x]),p.status)}</select></div>
   <div><label>מהנדס אחראי</label><select id="np_mgr">${optionList(engs,p.managerId)}</select></div><div></div>
   <div><label>תאריך התחלה</label><input id="np_start" type="date" value="${esc(p.start)}"></div><div><label>יעד סיום</label><input id="np_end" type="date" value="${esc(p.end)}"></div>
   <div><label>קו רוחב (Latitude)</label><input id="np_lat" type="number" step="any" value="${esc(p.lat??"")}"></div><div><label>קו אורך (Longitude)</label><input id="np_lng" type="number" step="any" value="${esc(p.lng??"")}"></div>
   <div class="full"><button type="button" class="small" onclick="getGPS().then(g=>{$('np_lat').value=g.lat;$('np_lng').value=g.lng;toast('המיקום הנוכחי הוזן')}).catch(e=>toast(e.message,'danger'))">📍 השתמש במיקום הנוכחי שלי (כשאני באתר)</button></div>
   <button class="primary full" onclick="saveProject(${id||""})">שמור פרויקט</button></div>`);
}
function saveProject(id){
  if (!guard("manageProjects")) return;
  const d = {name:val("np_name"), client:val("np_client"), budget:nval("np_budget"), status:val("np_status"), managerId:+val("np_mgr"),
    start:val("np_start"), end:val("np_end"), lat:val("np_lat")?nval("np_lat"):null, lng:val("np_lng")?nval("np_lng"):null};
  if (!req(d.name, "יש להזין שם פרויקט") || !req(d.client, "יש להזין לקוח")) return;
  if (!req(!d.end || !d.start || d.end >= d.start, "תאריך הסיום לפני תאריך ההתחלה")) return;
  if (!id && !req(!DB.projects.some(p => p.name === d.name), "כבר קיים פרויקט בשם הזה")) return;
  if (id){ Object.assign(P(id), d); audit("עריכת פרויקט", d.name); }
  else { const p = {id:nid(), ...d}; DB.projects.push(p); audit("יצירת פרויקט", d.name); S.filters.project = String(p.id); }
  closeModal(); refresh(); toast(id ? "הפרויקט עודכן" : "הפרויקט נוצר — כעת הוסף סעיפי כתב כמויות");
}

/* ------------------------------ תוכניות ------------------------------ */
function openPlanUpload(){
  if (!guard("managePlans")) return;
  const ps = visibleProjects().map(p => [p.id,p.name]);
  openModal(`<h2>העלאת תוכנית</h2><div class="form-grid">
   <div><label>פרויקט *</label><select id="pl_p">${optionList(ps, curProject()==="all"?ps[0]?.[0]:curProject())}</select></div>
   <div><label>גרסה</label><input id="pl_v" value="1"></div><div class="full"><label>שם התוכנית *</label><input id="pl_n" placeholder="לדוגמה: תוכנית תאורה — גיליון 2"></div>
   <div class="full"><label>קובץ (תמונה / PDF / DWG) *</label><input id="pl_f" type="file" accept="image/*,.pdf,.dwg"></div>
   <p class="full muted">תמונה (JPG/PNG) מאפשרת סימון עבודות על גבי התוכנית. PDF/DWG נשמרים כקובץ להורדה (עד 1.5MB באב-טיפוס).</p>
   <button class="primary full" onclick="savePlan()">העלה</button></div>`);
}
async function savePlan(){
  if (!guard("managePlans")) return;
  const f = $("pl_f").files[0], name = val("pl_n");
  if (!req(name, "יש להזין שם תוכנית") || !req(f, "יש לבחור קובץ")) return;
  const pl = {id:nid(), projectId:+val("pl_p"), name, version:val("pl_v")||"1", status:"ממתין לאישור", img:null, file:null, fileName:f.name, marks:[], uploadedBy:S.user.id, at:new Date().toISOString()};
  try {
    if (f.type.startsWith("image/")) pl.img = (await readImage(f, 1600)).data;
    else { if (!req(f.size <= 1.5*1024*1024, "הקובץ גדול מ-1.5MB — באב-טיפוס ניתן לשמור קבצים קטנים בלבד")) return; pl.file = await readFileData(f); }
  } catch(e){ return toast(e.message, "danger"); }
  // גרסה קודמת של אותה תוכנית מסומנת כ"הוחלפה"
  DB.plans.push(pl); audit("העלאת תוכנית", `${name} גרסה ${pl.version}`);
  notify(`תוכנית חדשה הועלתה: ${name} (${P(pl.projectId)?.name})`, {roles:["engineer","ceo"], module:"plans"});
  if (!save()){ DB.plans.pop(); return; }
  closeModal(); render(); toast("התוכנית הועלתה וממתינה לאישור גרסה");
}
function approvePlan(id){ if (!guard("managePlans")) return; const pl = DB.plans.find(x=>x.id===id); pl.status = "מאושר"; pl.approvedBy = S.user.id; audit("אישור גרסת תוכנית", `${pl.name} v${pl.version}`); refresh(); toast("גרסת התוכנית אושרה"); }
function openPlan(id){
  const pl = DB.plans.find(x => x.id===id); if (!pl) return;
  const ts = DB.tasks.filter(t => t.projectId===pl.projectId);
  const marks = pl.marks.map((m,i) => { const t = T(m.taskId), done = t?.status==="הושלם";
    return `<span class="mark ${done?"done":""}" style="left:${m.x}%;top:${m.y}%;background:${WORK[m.type]?.color||"#333"}" title="${esc(WORK[m.type]?.name)} ${esc(m.note)}">${done?"✓":i+1}</span>`; }).join("");
  openModal(`<h2>${esc(pl.name)} <small class="muted">גרסה ${esc(pl.version)} · ${pl.status}</small></h2>
   <div class="legend">${Object.entries(WORK).map(([k,w])=>`<span><i style="background:${w.color}"></i>${w.name}</span>`).join("")}<span><i class="done-dot">✓</i>בוצע (משימה הושלמה)</span></div>
   ${pl.img ? `${can("managePlans")?`<div class="mark-tools"><select id="mk_type">${optionList(Object.entries(WORK).map(([k,w])=>[k,w.name]),"pole")}</select>
     <select id="mk_task"><option value="">ללא שיוך למשימה</option>${optionList(ts.map(t=>[t.id,t.title]),"")}</select><input id="mk_note" placeholder="הערה לסימון"><span class="muted">← לחץ על התוכנית כדי לסמן</span></div>`:""}
     <div class="plan-wrap" ${can("managePlans")?`onclick="planClick(event,${pl.id})"`:""}><img id="planImg" src="${pl.img}" alt="">${marks}</div>`
   : `<div class="card empty">📄 ${esc(pl.fileName)}<br>${pl.file?`<button onclick="openDataUrl(DB.plans.find(x=>x.id===${pl.id}).file,'${esc(pl.fileName)}')">פתח / הורד קובץ</button>`:""}<p class="muted">סימון על התוכנית זמין לקבצי תמונה. ייצא את הגיליון כ-PNG כדי לסמן עליו.</p></div>`}
   ${pl.marks.length?`<h3>סימונים (${pl.marks.length})</h3>`+table("marksT",["#","סוג עבודה","משימה","מצב ביצוע","הערה",""], pl.marks.map((m,i)=>{ const t = T(m.taskId);
     return [i+1, `<i class="dot" style="background:${WORK[m.type]?.color}"></i> ${esc(WORK[m.type]?.name)}`, esc(t?.title||"-"), t?`${st(t.status)} ${num(taskDone(t))}/${num(t.qty)}`:"-", esc(m.note||""), can("managePlans")?`<button class="small danger" onclick="delMark(${pl.id},${i})">הסר</button>`:""]; }),{actions:true}):""}`, true);
}
function planClick(e, id){
  if (!can("managePlans")) return;
  const img = $("planImg"), r = img.getBoundingClientRect();
  const x = Math.round((e.clientX - r.left)/r.width*1000)/10, y = Math.round((e.clientY - r.top)/r.height*1000)/10;
  if (x<0||y<0||x>100||y>100) return;
  const pl = DB.plans.find(p => p.id===id);
  pl.marks.push({x, y, type:val("mk_type"), taskId:val("mk_task")?+val("mk_task"):null, note:val("mk_note")});
  audit("סימון על תוכנית", pl.name); save();
  const keep = {type:val("mk_type"), task:val("mk_task")}; openPlan(id); $("mk_type").value = keep.type; $("mk_task").value = keep.task;
}
function delMark(id, i){ const pl = DB.plans.find(p => p.id===id); pl.marks.splice(i,1); save(); openPlan(id); }
function openDataUrl(data, name){
  const a = document.createElement("a"); a.href = data; a.download = name; a.target = "_blank"; document.body.appendChild(a); a.click(); a.remove();
}

/* ------------------------------ משימות ------------------------------ */
function openTaskForm(id, preset = {}){
  if (!guard("createTask")) return;
  const t = id ? T(id) : {projectId: preset.projectId || (curProject()==="all" ? visibleProjects()[0]?.id : +curProject()), boqId:"", title:preset.title||"", qty:"", assigneeId:"", location:"", due:addDays(3), notes:preset.notes||"", status:"חדש"};
  openModal(`<h2>${id?"עריכת משימה":"משימה חדשה"}</h2><div class="form-grid">
   <div><label>פרויקט *</label><select id="tk_p" onchange="taskFormDeps()">${optionList(visibleProjects().map(p=>[p.id,p.name]),t.projectId)}</select></div>
   <div><label>סעיף בכתב הכמויות *</label><select id="tk_b"></select></div>
   <div class="full"><label>תיאור המשימה *</label><input id="tk_title" value="${esc(t.title)}" placeholder="לדוגמה: העמדת 34 עמודים — רמפה מערבית"></div>
   <div><label>כמות *</label><input id="tk_qty" type="number" min="0" step="any" value="${esc(t.qty)}"><small id="tk_rem" class="muted"></small></div>
   <div><label>אחראי (עובד / קבלן) *</label><select id="tk_a"></select></div>
   <div><label>מיקום / קטע</label><input id="tk_loc" value="${esc(t.location)}"></div><div><label>תאריך יעד</label><input id="tk_due" type="date" value="${esc(t.due)}"></div>
   ${id?`<div><label>סטטוס</label><select id="tk_st">${optionList(["חדש","בביצוע","ממתין לאישור","הושלם"].map(x=>[x,x]),t.status)}</select></div><div></div>`:""}
   <div class="full"><label>הוראות לעובד</label><textarea id="tk_notes" rows="2">${esc(t.notes)}</textarea></div>
   <button class="primary full" onclick="saveTask(${id||""})">${id?"שמור":"צור משימה ושלח לעובד"}</button></div>`);
  taskFormDeps(t.boqId, t.assigneeId);
  S.draft.fromMeeting = preset.fromMeeting || null;
}
function taskFormDeps(boqSel, aSel){
  const pid = +val("tk_p");
  $("tk_b").innerHTML = projectBoq(pid).map(b => `<option value="${b.id}" ${b.id===+boqSel?"selected":""}>${esc(b.item)} (${esc(b.unit)})</option>`).join("") || `<option value="">אין סעיפים — הוסף בכתב הכמויות</option>`;
  const people = DB.users.filter(u => u.active && (["worker","contractor","engineer"].includes(u.role)) && (u.projects==="all" || u.projects.includes(pid)));
  $("tk_a").innerHTML = people.map(u => `<option value="${u.id}" ${u.id===+aSel?"selected":""}>${esc(u.name)} — ${ROLES[u.role]}</option>`).join("");
  const upd = () => { const b = B(val("tk_b")); $("tk_rem").textContent = b ? `יתרה בסעיף: ${num(b.qty - boqDone(b))} ${b.unit}` : ""; };
  $("tk_b").onchange = upd; upd();
}
function saveTask(id){
  if (!guard("createTask")) return;
  const d = {projectId:+val("tk_p"), boqId:+val("tk_b"), title:val("tk_title"), qty:nval("tk_qty"), assigneeId:+val("tk_a"), location:val("tk_loc"), due:val("tk_due"), notes:val("tk_notes")};
  if (!req(d.boqId, "יש לבחור סעיף מכתב הכמויות") || !req(d.title, "יש להזין תיאור") || !req(d.qty > 0, "כמות חייבת להיות גדולה מ-0") || !req(d.assigneeId, "יש לבחור אחראי")) return;
  if (id){ const t = T(id); const prevA = t.assigneeId; Object.assign(t, d, {status:val("tk_st")||t.status}); audit("עריכת משימה", d.title);
    if (prevA !== d.assigneeId) notify(`שויכה אליך משימה: ${d.title}`, {userId:d.assigneeId, module:"tasks"}); }
  else { const t = {id:nid(), ...d, status:"חדש", createdBy:S.user.id}; DB.tasks.push(t); audit("יצירת משימה", `${d.title} → ${U(d.assigneeId)?.name}`);
    notify(`משימה חדשה: ${d.title} (${P(d.projectId)?.name})`, {userId:d.assigneeId, module:"tasks"});
    if (S.draft.fromMeeting){ const [mid,i] = S.draft.fromMeeting; const m = DB.meetings.find(x=>x.id===mid); if (m) m.decisions[i].taskId = t.id; } }
  closeModal(); refresh(); toast(id ? "המשימה עודכנה" : "המשימה נוצרה ונשלחה לעובד");
}
function delTask(id){
  if (!guard("createTask")) return; const t = T(id);
  if (DB.reports.some(r => r.taskId===id && r.status==="approved")) return toast("לא ניתן למחוק משימה עם דיווחים מאושרים — סמן אותה כהושלמה","danger");
  if (!confirm(`למחוק את המשימה "${t.title}"?`)) return;
  DB.tasks = DB.tasks.filter(x => x.id!==id); DB.reports = DB.reports.filter(r => r.taskId!==id); audit("מחיקת משימה", t.title); refresh(); toast("המשימה נמחקה");
}
function startTask(id){ const t = T(id); if (t.assigneeId!==S.user.id && !can("createTask")) return; t.status = "בביצוע"; t.startedAt = new Date().toISOString(); audit("התחלת משימה", t.title); refresh(); toast("בהצלחה! כשתסיים חלק — דווח עם תמונה"); }
function reportTask(id){ S.filters.reportTask = id; go("fieldAI"); }

/* ------------------------------ שטח + AI ------------------------------ */
function taskHint(){
  const t = T(val("rf_task")), h = $("rf_hint"); if (!t || !h) return;
  const done = taskDone(t), pend = taskPending(t), b = B(t.boqId);
  h.innerHTML = `${esc(b?.item||"")} · בוצע ${num(done)} / ${num(t.qty)} ${esc(b?.unit||"")}${pend?` · ממתין לאישור ${num(pend)}`:""} · <b>יתרה ${num(Math.max(0,t.qty-done-pend))}</b>${t.location?` · ${esc(t.location)}`:""}`;
}
async function onPhoto(input){
  const f = input.files[0]; if (!f) return;
  try { const r = await readImage(f, 1000); S.draft.photo = r.data; S.draft.bright = r.bright;
    $("rf_prev").innerHTML = `<img class="prev" src="${r.data}">` + (r.bright < 45 ? `<div class="danger-text">התמונה חשוכה — מומלץ לצלם שוב</div>` : "");
  } catch(e){ toast(e.message, "danger"); }
}
function grabGPS(silent){
  const box = $("rf_gps"); if (box && !silent) box.textContent = "מאתר מיקום…";
  getGPS().then(g => { S.draft.gps = g; const b = $("rf_gps"); if (b) b.textContent = `📍 ${g.lat}, ${g.lng} (±${g.acc} מ׳)`; if (!silent) toast("המיקום התקבל"); })
    .catch(e => { const b = $("rf_gps"); if (b) b.textContent = "⚠ " + e.message + " — אפשר לשלוח גם בלי, המהנדס יראה זאת"; });
}
function submitReport(){
  if (!guard("fieldReport")) return;
  const t = T(val("rf_task")), qty = nval("rf_qty");
  if (!req(t, "יש לבחור משימה") || !req(qty > 0, "יש להזין כמות שבוצעה")) return;
  const r = {id:nid(), taskId:t.id, boqId:t.boqId, projectId:t.projectId, userId:S.user.id, date:today(), at:new Date().toISOString(), qty, qtyReported:qty,
    stage:val("rf_stage"), note:val("rf_note"), photo:S.draft.photo||null, bright:S.draft.bright??null, gps:S.draft.gps||null, status:"pending"};
  const a = analyzeReport(r);
  if ((a.score < 45 || a.flags.some(f=>f[0]==="high")) && !confirm(`בדיקת AI: ${a.rec}\n\n${a.flags.filter(f=>f[0]!=="ok").map(f=>"• "+f[1]).join("\n")}\n\nלשלוח בכל זאת?`)) return;
  DB.reports.push(r); t.status = "ממתין לאישור";
  if (!DB.daily.some(d => d.projectId===t.projectId && d.date===today())) DB.daily.push({id:nid(), projectId:t.projectId, date:today(), notes:"", issues:"", weather:"", status:"ממתין לאישור מהנדס", approvedBy:null});
  audit("דיווח שטח", `${t.title}: ${qty}`);
  notify(`דיווח שטח חדש מ${S.user.name}: ${t.title} — ${num(qty)} (AI ${a.score})`, {roles:["engineer","ceo"], module:"fieldAI"});
  if (!save()){ DB.reports.pop(); return; }
  const gps = S.draft.gps; S.draft = {gps}; S.filters.rstatus = isFieldRole() ? "all" : S.filters.rstatus;
  render(); toast(`הדיווח נשלח לאישור מהנדס · AI: ${a.rec}`);
}
function openApprove(id){
  const r = DB.reports.find(x => x.id===id); if (!r) return;
  const a = analyzeReport(r), t = T(r.taskId), b = B(r.boqId), p = P(r.projectId), canA = r.status==="pending" && can("approveReport");
  openModal(`<h2>דיווח שטח #${r.id} ${rst(r)}</h2>
   <div class="split">${r.photo?`<img class="big-photo" src="${r.photo}">`:`<div class="no-photo big">אין תמונה</div>`}
   <div><p><b>${esc(t?.title||"-")}</b><br>${esc(p?.name)} · ${esc(b?.item)}<br>עובד: ${uname(r.userId)} · ${fmtTime(r.at)} · שלב: ${esc(r.stage)}</p>
   <p>כמות מדווחת: <b>${num(r.qtyReported)} ${esc(b?.unit)}</b>${t?`<br>משימה: ${num(taskDone(t))} / ${num(t.qty)} מאושר`:""}</p>
   ${r.gps?`<p>📍 ${r.gps.lat}, ${r.gps.lng} (±${r.gps.acc} מ׳) <a href="https://maps.google.com/?q=${r.gps.lat},${r.gps.lng}" target="_blank" rel="noopener">מפה</a></p>`:"<p>📍 ללא GPS</p>"}
   ${r.note?`<p class="notice">${esc(r.note)}</p>`:""}</div></div>
   <div class="ai-panel"><h3>🤖 ניתוח AI ${scoreTag(a.score)}</h3><p><b>${esc(a.rec)}</b> · סוג עבודה: ${esc(a.detected)}</p>
   <ul>${a.flags.map(f=>`<li class="fl-${f[0]}">${esc(f[1])}</li>`).join("") || "<li>לא נמצאו חריגות</li>"}</ul><small class="muted">ההחלטה הסופית היא של המהנדס.</small></div>
   ${canA?`<div class="form-grid"><div><label>כמות לאישור</label><input id="ap_qty" type="number" step="any" value="${r.qtyReported}"></div><div><label>הערה לעובד</label><input id="ap_note" placeholder="חובה בדחייה"></div>
   <button class="primary" onclick="decideReport(${r.id},true)">✓ אשר — עדכן יומן, התקדמות וכתב כמויות</button><button class="danger" onclick="decideReport(${r.id},false)">✗ דחה</button></div>`
   : r.decisionNote?`<p class="muted">הערת מהנדס: ${esc(r.decisionNote)}</p>`:""}`, true);
}
function decideReport(id, ok){
  if (!guard("approveReport")) return;
  const r = DB.reports.find(x => x.id===id), t = T(r.taskId), note = val("ap_note");
  if (ok){
    const q = nval("ap_qty"); if (!req(q > 0, "כמות לאישור חייבת להיות גדולה מ-0")) return;
    r.qty = q; r.status = "approved"; r.approvedBy = S.user.id; r.decidedAt = new Date().toISOString(); r.decisionNote = note || (q!==r.qtyReported ? `הכמות תוקנה מ-${r.qtyReported} ל-${q}` : "");
    if (t) t.status = taskDone(t) >= t.qty ? "הושלם" : (taskPending(t) ? "ממתין לאישור" : "בביצוע");
    audit("אישור דיווח שטח", `#${id} ${t?.title}: ${q}`);
    notify(`הדיווח שלך אושר: ${t?.title} — ${num(q)}`, {userId:r.userId, module:"fieldAI"});
  } else {
    if (!req(note, "יש לכתוב סיבת דחייה לעובד")) return;
    r.status = "rejected"; r.approvedBy = S.user.id; r.decidedAt = new Date().toISOString(); r.decisionNote = note;
    if (t && t.status==="ממתין לאישור" && !taskPending(t)) t.status = "בביצוע";
    audit("דחיית דיווח שטח", `#${id}: ${note}`);
    notify(`הדיווח שלך נדחה: ${t?.title} — ${note}`, {userId:r.userId, module:"fieldAI"});
  }
  closeModal(); refresh(); toast(ok ? "אושר — היומן, ההתקדמות וכתב הכמויות עודכנו" : "הדיווח נדחה והעובד קיבל הודעה");
}

/* ------------------------------ יומן עבודה ------------------------------ */
function openDaily(pid, date){
  if (!guard("approveDaily")) return;
  let m = DB.daily.find(d => d.projectId===pid && d.date===date);
  const l = dailyLogs().find(x => x.projectId===pid && x.date===date) || {projectId:pid,date,reports:[],meta:m};
  const pend = DB.reports.filter(r => r.projectId===pid && r.date===date && r.status==="pending").length;
  openModal(`<h2>יומן עבודה — ${pname(pid)} · ${fmtDate(date)}</h2>${dailyBody(l)}
   ${pend?`<div class="notice warn">⚠ יש ${pend} דיווחים ממתינים ליום זה. יש לאשר/לדחות אותם לפני אישור היומן.</div>`:""}
   <div class="form-grid"><div><label>מזג אוויר</label><input id="dl_w" value="${esc(m?.weather||"")}"></div><div></div>
   <div class="full"><label>בעיות ועיכובים</label><textarea id="dl_i" rows="2">${esc(m?.issues||"")}</textarea></div>
   <div class="full"><label>סיכום מהנדס</label><textarea id="dl_n" rows="3">${esc(m?.notes||"")}</textarea></div>
   <button onclick="saveDaily(${pid},'${date}',false)">שמור טיוטה</button><button class="primary" ${pend?"disabled":""} onclick="saveDaily(${pid},'${date}',true)">✓ אשר יומן</button></div>`, true);
}
function saveDaily(pid, date, approve){
  if (!guard("approveDaily")) return;
  let m = DB.daily.find(d => d.projectId===pid && d.date===date);
  if (!m){ m = {id:nid(), projectId:pid, date}; DB.daily.push(m); }
  Object.assign(m, {weather:val("dl_w"), issues:val("dl_i"), notes:val("dl_n")});
  if (approve){ m.status = "מאושר"; m.approvedBy = S.user.id; audit("אישור יומן עבודה", `${P(pid)?.name} ${date}`); }
  else m.status = m.status === "מאושר" ? "מאושר" : "ממתין לאישור מהנדס";
  closeModal(); refresh(); toast(approve ? "היומן אושר — ניתן להדפיס ולשלוח ללקוח" : "נשמר");
}
function printHeader(title){ return `<div class="ph"><div><b class="brand-p">INDIX</b><br>${esc(DB.settings.company)}</div><div><h1>${title}</h1></div><div>הופק: ${new Date().toLocaleDateString("he-IL")}<br>ע״י ${esc(S.user.name)}</div></div>`; }
function printDaily(pid, date){
  const l = dailyLogs().find(x => x.projectId===pid && x.date===date) || {projectId:pid,date,reports:[],meta:DB.daily.find(d=>d.projectId===pid&&d.date===date)};
  const m = l.meta;
  printHTML(printHeader(`יומן עבודה — ${pname(pid)} — ${fmtDate(date)}`) + `<p>לקוח: ${esc(P(pid)?.client)} · סטטוס: ${esc(m?.status||"טיוטה")}${m?.approvedBy?` · אושר ע״י ${uname(m.approvedBy)}`:""}</p>` + dailyBody(l)
    + `<div class="sign-line">חתימת מהנדס: ____________ &nbsp;&nbsp; חתימת מפקח/לקוח: ____________</div>`);
}

/* ------------------------------ מחסן ------------------------------ */
function openMove(type, mat){
  if (!guard("stockMove")) return;
  const fieldUsers = DB.users.filter(u => u.active && ["worker","contractor","engineer"].includes(u.role)).map(u=>[u.id,u.name]);
  openModal(`<h2>${type==="in"?"⬇ קליטת חומר למחסן":"⬆ ניפוק חומר לפרויקט"}</h2><div class="form-grid">
   <div><label>פריט *</label><select id="mv_mat" onchange="mvHint()">${optionList(DB.stock.map(s=>[s.mat,matName(s.mat)]),mat)}</select><small id="mv_hint" class="muted"></small></div>
   <div><label>כמות *</label><input id="mv_qty" type="number" min="0" step="any"></div>
   ${type==="out"?`<div><label>פרויקט *</label><select id="mv_p">${optionList(DB.projects.filter(p=>p.status!=="הסתיים").map(p=>[p.id,p.name]))}</select></div>
   <div><label>מקבל החומר *</label><select id="mv_to">${optionList(fieldUsers)}</select></div>`:`<div class="full"><label>מקור / ספק / תעודת משלוח</label><input id="mv_src"></div>`}
   <div class="full"><label>הערה</label><input id="mv_note"></div>
   <div class="full"><label>תמונה (תעודת משלוח / חומר)</label><input id="mv_img" type="file" accept="image/*" capture="environment"></div>
   ${sigBlock("mv_sig")}<button class="primary full" onclick="saveMove('${type}')">שמור תנועה</button></div>`);
  sigPad("mv_sig"); mvHint();
}
function mvHint(){ const s = stockOf(val("mv_mat")); if ($("mv_hint") && s) $("mv_hint").textContent = `במלאי: ${num(s.qty)} ${MATERIALS[s.mat].unit}`; }
async function saveMove(type){
  if (!guard("stockMove")) return;
  const s = stockOf(val("mv_mat")), qty = nval("mv_qty"), sig = $("mv_sig")._get();
  if (!req(qty > 0, "יש להזין כמות") || !req(sig, "נדרשת חתימה דיגיטלית")) return;
  if (type==="out" && !req(qty <= s.qty, `אין מספיק מלאי (במלאי ${num(s.qty)})`)) return;
  let img = null; const f = $("mv_img")?.files[0]; if (f){ try { img = (await readImage(f, 800)).data; } catch(e){} }
  const m = {id:nid(), at:new Date().toISOString(), type, mat:s.mat, qty, projectId:type==="out"?+val("mv_p"):null, toUserId:type==="out"?+val("mv_to"):null,
    userId:S.user.id, note:[val("mv_src"), val("mv_note")].filter(Boolean).join(" · "), signature:sig, img, refReq:null};
  s.qty += type==="in" ? qty : -qty; DB.movements.push(m);
  audit(type==="in"?"קליטת מלאי":"ניפוק מלאי", `${matName(s.mat)} ${qty}${m.projectId?" → "+P(m.projectId)?.name:""}`);
  if (s.qty < s.min) notify(`מלאי נמוך: ${matName(s.mat)} (${num(s.qty)})`, {roles:["purchasing","ceo"], module:"warehouse"});
  if (!save()){ DB.movements.pop(); s.qty -= type==="in" ? qty : -qty; return; }
  closeModal(); render(); toast("התנועה נשמרה עם חתימה");
}
function showSig(id){ const m = DB.movements.find(x => x.id===id); openModal(`<h2>חתימה — תנועה ${id}</h2><p>${esc(matName(m.mat))} · ${num(m.qty)} · ${fmtTime(m.at)}</p><img class="sig-img" src="${m.signature}">${m.img?`<img class="big-photo" src="${m.img}">`:""}`); }
function openStockItem(){
  if (!guard("admin")) return;
  openModal(`<h2>פריט מלאי חדש</h2><div class="form-grid"><div><label>שם הפריט *</label><input id="si_n"></div><div><label>יחידה</label><input id="si_u" value="יח׳"></div>
   <div><label>כמות התחלתית</label><input id="si_q" type="number" value="0"></div><div><label>מלאי מינימום</label><input id="si_m" type="number" value="0"></div>
   <button class="primary full" onclick="saveStockItem()">הוסף</button></div>`);
}
function saveStockItem(){
  const n = val("si_n"); if (!req(n, "יש להזין שם")) return;
  const key = "m" + nid(); MATERIALS[key] = {name:n, unit:val("si_u")||"יח׳"};
  DB.customMaterials = DB.customMaterials || {}; DB.customMaterials[key] = MATERIALS[key];
  DB.stock.push({id:nid(), mat:key, qty:nval("si_q"), min:nval("si_m"), location:"מחסן מרכזי"}); audit("פריט מלאי חדש", n);
  closeModal(); refresh(); toast("הפריט נוסף");
}

/* ------------------------------ רכש ------------------------------ */
function checkRequest(pid, mat, qty, excludeId){
  const lines = projectBoq(pid).filter(b => WORK[b.type]?.mat === mat);
  const boqQty = lines.reduce((a,b)=>a+b.qty,0);
  const purchased = DB.requests.filter(r => r.projectId===+pid && r.mat===mat && r.status!==REQ.REJECTED && r.id!==excludeId).reduce((a,r)=>a+r.qty,0);
  const issued = DB.movements.filter(m => m.type==="out" && m.projectId===+pid && m.mat===mat && !m.refReq).reduce((a,m)=>a+m.qty,0);
  const stock = stockOf(mat)?.qty || 0, unit = MATERIALS[mat]?.unit || "";
  const msgs = []; let over = false, overMsg = "";
  if (!lines.length){ over = true; overMsg = "הפריט לא מופיע בכתב הכמויות של הפרויקט"; msgs.push(["high", overMsg + " — דורש אישור מנכ״ל"]); }
  else {
    const total = purchased + qty;
    msgs.push(["ok", `כתב כמויות: ${num(boqQty)} ${unit} · הוזמן עד כה: ${num(purchased)} · כולל דרישה זו: ${num(total)}`]);
    if (total > boqQty){ over = true; overMsg = `חריגה של ${num(total-boqQty)} ${unit} מעבר לכמות בכתב הכמויות (${num(boqQty)} ${unit})`; msgs.push(["high", overMsg + " — דורש אישור מנכ״ל"]); }
  }
  if (issued) msgs.push(["low", `כבר נופקו לפרויקט מהמחסן ${num(issued)} ${unit}`]);
  if (stock >= qty && qty > 0) msgs.push(["mid", `במחסן יש ${num(stock)} ${unit} — שקול ניפוק מהמלאי במקום רכישה`]);
  return {over, overMsg, msgs};
}
function openRequest(mat, pid){
  if (!guard("createRequest")) return;
  const ps = visibleProjects().filter(p => p.status!=="הסתיים").map(p => [p.id,p.name]);
  openModal(`<h2>דרישת רכש חדשה</h2><div class="form-grid">
   <div><label>פרויקט *</label><select id="rq_p" onchange="reqLive()">${optionList(ps, pid || (curProject()==="all"?ps[0]?.[0]:curProject()))}</select></div>
   <div><label>פריט *</label><select id="rq_m" onchange="reqLive()">${optionList(Object.entries(MATERIALS).map(([k,m])=>[k,`${m.name} (${m.unit})`]), mat)}</select></div>
   <div><label>כמות *</label><input id="rq_q" type="number" min="0" step="any" oninput="reqLive()"></div><div><label>נדרש עד</label><input id="rq_d" type="date" value="${addDays(7)}"></div>
   <div class="full"><label>סיבה / שימוש</label><input id="rq_r"></div>
   <div class="full" id="rq_check"></div><button class="primary full" onclick="saveRequest()">שלח דרישה</button></div>`);
  reqLive();
}
function reqLive(){
  const c = checkRequest(+val("rq_p"), val("rq_m"), nval("rq_q"));
  $("rq_check").innerHTML = `<div class="ai-panel"><b>🤖 בדיקה אוטומטית</b><ul>${c.msgs.map(m=>`<li class="fl-${m[0]}">${esc(m[1])}</li>`).join("")}</ul></div>`;
}
function saveRequest(){
  if (!guard("createRequest")) return;
  const pid = +val("rq_p"), mat = val("rq_m"), qty = nval("rq_q");
  if (!req(pid, "יש לבחור פרויקט") || !req(qty > 0, "יש להזין כמות")) return;
  const c = checkRequest(pid, mat, qty);
  const r = {id:nid(), date:today(), needBy:val("rq_d"), projectId:pid, mat, qty, reason:val("rq_r"), status:c.over?REQ.WAIT_CEO:REQ.APPROVED, over:c.over, overMsg:c.overMsg, requestedBy:S.user.id, supplierId:null, price:null};
  DB.requests.push(r); audit("דרישת רכש", `${r.id}: ${matName(mat)} ${qty}${c.over?" (חריגה)":""}`);
  if (c.over) notify(`דרישת רכש ${r.id} (${P(pid)?.name}) חורגת: ${c.overMsg}`, {roles:["ceo"], module:"purchasing"});
  else notify(`דרישת רכש ${r.id} מאושרת וממתינה להזמנה: ${matName(mat)} ${num(qty)}`, {roles:["purchasing"], module:"purchasing"});
  closeModal(); refresh(); toast(c.over ? "הדרישה חורגת — נשלחה לאישור מנכ״ל" : "הדרישה אושרה אוטומטית ועברה לרכש");
}
function ceoDecide(id, ok){
  if (!guard("approveOver")) return;
  const r = DB.requests.find(x => x.id===id);
  if (!ok){ const why = prompt("סיבת הדחייה:"); if (why === null) return; r.rejectReason = why; }
  r.status = ok ? REQ.APPROVED : REQ.REJECTED; r.approvedBy = S.user.id;
  audit(ok?"אישור חריגת רכש":"דחיית דרישת רכש", `${id}`);
  notify(ok ? `דרישה ${id} אושרה ע״י המנכ״ל — ניתן להזמין` : `דרישה ${id} נדחתה: ${r.rejectReason||""}`, {roles: ok?["purchasing"]:[], userId:r.requestedBy, module:"purchasing"});
  refresh(); toast(ok ? "החריגה אושרה — הועבר לרכש" : "הדרישה נדחתה");
}
function openOrder(id){
  if (!guard("orderRequest")) return;
  const r = DB.requests.find(x => x.id===id);
  const offers = DB.suppliers.filter(s => s.prices?.[r.mat]).sort((a,b)=>a.prices[r.mat]-b.prices[r.mat]);
  openModal(`<h2>הזמנה לדרישה ${id}</h2><p>${esc(matName(r.mat))} · ${num(r.qty)} ${MATERIALS[r.mat]?.unit} · ${pname(r.projectId)}</p>
   <h3>השוואת ספקים</h3>${offers.length ? `<div class="offers">${offers.map((s,i)=>`<label class="offer"><input type="radio" name="sup" value="${s.id}" ${i===0?"checked":""} onchange="$('or_price').value=${s.prices[r.mat]}">
     <b>${i===0?"🏆 ":""}${esc(s.name)}</b> — ${money(s.prices[r.mat])} ליח׳ · סה״כ ${money(s.prices[r.mat]*r.qty)}${i>0?` <small class="danger-text">(+${money((s.prices[r.mat]-offers[0].prices[r.mat])*r.qty)})</small>`:""}</label>`).join("")}</div>`
     : `<p class="notice warn">אין ספק עם מחיר לפריט זה. הוסף מחיר במסך ספקים.</p>`}
   <div class="form-grid"><div><label>מחיר ליחידה בהזמנה</label><input id="or_price" type="number" step="any" value="${offers[0]?.prices[r.mat]||""}"></div><div><label>צפי אספקה</label><input id="or_eta" type="date" value="${addDays(5)}"></div>
   <button class="primary full" ${offers.length?"":"disabled"} onclick="saveOrder(${id})">בצע הזמנה</button></div>`);
}
function saveOrder(id){
  if (!guard("orderRequest")) return;
  const r = DB.requests.find(x => x.id===id), sup = document.querySelector("input[name=sup]:checked"), price = nval("or_price");
  if (!req(sup, "יש לבחור ספק") || !req(price > 0, "יש להזין מחיר")) return;
  Object.assign(r, {supplierId:+sup.value, price, eta:val("or_eta"), status:REQ.ORDERED, orderedBy:S.user.id, orderedAt:today()});
  audit("הזמנת רכש", `${id} מ${DB.suppliers.find(s=>s.id===r.supplierId)?.name} — ${money(price*r.qty)}`);
  notify(`הזמנה ${id} בדרך למחסן: ${matName(r.mat)} ${num(r.qty)} (צפי ${fmtDate(r.eta)})`, {roles:["storekeeper"], module:"warehouse"});
  closeModal(); refresh(); toast("ההזמנה בוצעה — המחסנאי יקבל התראה");
}
function openReceive(id){
  if (!guard("receive")) return;
  const r = DB.requests.find(x => x.id===id);
  openModal(`<h2>קליטת משלוח — הזמנה ${id}</h2><p>${esc(matName(r.mat))} · הוזמן ${num(r.qty)} ${MATERIALS[r.mat]?.unit} · ספק: ${esc(DB.suppliers.find(s=>s.id===r.supplierId)?.name||"-")}</p>
   <div class="form-grid"><div><label>כמות שהתקבלה בפועל *</label><input id="rc_q" type="number" step="any" value="${r.qty}"></div><div><label>מס׳ תעודת משלוח</label><input id="rc_dn"></div>
   <div class="full"><label>תמונת תעודת משלוח</label><input id="rc_img" type="file" accept="image/*" capture="environment"></div>
   ${sigBlock("rc_sig")}<button class="primary full" onclick="saveReceive(${id})">אשר קליטה למלאי</button></div>`);
  sigPad("rc_sig");
}
async function saveReceive(id){
  if (!guard("receive")) return;
  const r = DB.requests.find(x => x.id===id), q = nval("rc_q"), sig = $("rc_sig")._get();
  if (!req(q > 0, "יש להזין כמות") || !req(sig, "נדרשת חתימת מחסנאי")) return;
  let img = null; const f = $("rc_img").files[0]; if (f){ try { img = (await readImage(f, 800)).data; } catch(e){} }
  let s = stockOf(r.mat); if (!s){ s = {id:nid(), mat:r.mat, qty:0, min:0, location:"מחסן מרכזי"}; DB.stock.push(s); }
  s.qty += q;
  DB.movements.push({id:nid(), at:new Date().toISOString(), type:"in", mat:r.mat, qty:q, projectId:null, toUserId:null, userId:S.user.id, note:`קליטת הזמנה ${id}${val("rc_dn")?" · ת״מ "+val("rc_dn"):""}`, signature:sig, img, refReq:id});
  r.status = REQ.SUPPLIED; r.suppliedAt = today(); r.receivedQty = q; r.receivedBy = S.user.id;
  if (q !== r.qty) notify(`הזמנה ${id}: התקבלו ${num(q)} מתוך ${num(r.qty)} — יש לבדוק מול הספק`, {roles:["purchasing","ceo"], module:"purchasing"});
  else notify(`הזמנה ${id} נקלטה במחסן (${matName(r.mat)} ${num(q)})`, {roles:["purchasing"], userId:r.requestedBy, module:"warehouse"});
  audit("קליטת משלוח", `${id}: ${q}`);
  if (!save()) return;
  closeModal(); render(); toast("המשלוח נקלט — המלאי ועלות הפרויקט עודכנו");
}
function viewRequest(id){
  const r = DB.requests.find(x => x.id===id), sup = DB.suppliers.find(s => s.id===r.supplierId);
  openModal(`<h2>דרישת רכש ${id}</h2>${st(r.status)}<table class="mini"><tbody>
   <tr><td>פרויקט</td><td>${pname(r.projectId)}</td></tr><tr><td>פריט</td><td>${esc(matName(r.mat))}</td></tr><tr><td>כמות</td><td>${num(r.qty)} ${MATERIALS[r.mat]?.unit||""}</td></tr>
   <tr><td>מבקש</td><td>${uname(r.requestedBy)} · ${fmtDate(r.date)}</td></tr><tr><td>סיבה</td><td>${esc(r.reason||"-")}</td></tr>
   ${r.over?`<tr><td>חריגה</td><td class="danger-text">${esc(r.overMsg)}</td></tr>`:""}${r.approvedBy?`<tr><td>החלטת מנכ״ל</td><td>${uname(r.approvedBy)}${r.rejectReason?" — "+esc(r.rejectReason):""}</td></tr>`:""}
   ${sup?`<tr><td>ספק</td><td>${esc(sup.name)} · ${money(r.price)} ליח׳ · ${money(r.price*r.qty)}</td></tr>`:""}${r.eta?`<tr><td>צפי אספקה</td><td>${fmtDate(r.eta)}</td></tr>`:""}
   ${r.suppliedAt?`<tr><td>נקלט</td><td>${fmtDate(r.suppliedAt)} · ${num(r.receivedQty??r.qty)} ע״י ${uname(r.receivedBy)}</td></tr>`:""}</tbody></table>`);
}

/* ------------------------------ ספקים ------------------------------ */
function openSupplier(id){
  if (!guard("manageSuppliers")) return;
  const s = id ? DB.suppliers.find(x => x.id===id) : {name:"",contact:"",phone:"",prices:{}};
  openModal(`<h2>${id?"עריכת ספק":"ספק חדש"}</h2><div class="form-grid">
   <div><label>שם ספק *</label><input id="sp_n" value="${esc(s.name)}"></div><div><label>איש קשר</label><input id="sp_c" value="${esc(s.contact)}"></div>
   <div><label>טלפון</label><input id="sp_ph" value="${esc(s.phone)}"></div><div></div>
   <h3 class="full">מחירון (השאר ריק לפריט שהספק לא מספק)</h3>
   ${Object.entries(MATERIALS).map(([k,m])=>`<div><label>${esc(m.name)} (₪ ל${esc(m.unit)})</label><input id="sp_${k}" type="number" step="any" value="${s.prices?.[k]??""}"></div>`).join("")}
   <button class="primary full" onclick="saveSupplier(${id||""})">שמור</button></div>`);
}
function saveSupplier(id){
  if (!guard("manageSuppliers")) return;
  const name = val("sp_n"); if (!req(name, "יש להזין שם ספק")) return;
  const prices = {}; Object.keys(MATERIALS).forEach(k => { const v = nval("sp_"+k); if (v > 0) prices[k] = v; });
  const d = {name, contact:val("sp_c"), phone:val("sp_ph"), prices};
  if (id) Object.assign(DB.suppliers.find(x => x.id===id), d); else DB.suppliers.push({id:nid(), ...d});
  audit(id?"עדכון מחירון ספק":"ספק חדש", name); closeModal(); refresh(); toast("נשמר");
}

/* ------------------------------ כתב כמויות ------------------------------ */
function openBoqLine(id, pid){
  if (!guard("editBoq")) return;
  const b = id ? B(id) : {projectId:pid, type:"dig", item:"", unit:"מ׳", qty:"", base:0, sale:"", cost:""};
  openModal(`<h2>${id?"עריכת סעיף":"סעיף חדש"} — ${pname(b.projectId)}</h2><div class="form-grid">
   <div><label>סוג עבודה</label><select id="bq_t" onchange="if(!$('bq_i').value||${!id}){$('bq_i').value=WORK[this.value].name;$('bq_u').value=WORK[this.value].unit}">${optionList(Object.entries(WORK).map(([k,w])=>[k,w.name]),b.type)}</select></div>
   <div><label>יחידה</label><input id="bq_u" value="${esc(b.unit)}"></div><div class="full"><label>תיאור הסעיף *</label><input id="bq_i" value="${esc(b.item||WORK[b.type].name)}"></div>
   <div><label>כמות חוזית *</label><input id="bq_q" type="number" step="any" value="${esc(b.qty)}"></div><div><label>כמות פתיחה (בוצע לפני המערכת)</label><input id="bq_b" type="number" step="any" value="${esc(b.base)}"></div>
   <div><label>מחיר מכירה ליח׳ *</label><input id="bq_s" type="number" step="any" value="${esc(b.sale)}"></div><div><label>עלות ליח׳ *</label><input id="bq_c" type="number" step="any" value="${esc(b.cost)}"></div>
   <button class="primary full" onclick="saveBoqLine(${id||"null"},${b.projectId})">שמור</button>
   ${id && !DB.tasks.some(t=>t.boqId===id) ? `<button class="danger full" onclick="delBoqLine(${id})">מחק סעיף</button>` : ""}</div>`);
}
function saveBoqLine(id, pid){
  if (!guard("editBoq")) return;
  const d = {type:val("bq_t"), unit:val("bq_u"), item:val("bq_i"), qty:nval("bq_q"), base:nval("bq_b"), sale:nval("bq_s"), cost:nval("bq_c")};
  if (!req(d.item, "יש להזין תיאור") || !req(d.qty > 0, "כמות חוזית חייבת להיות גדולה מ-0") || !req(d.sale > 0 && d.cost >= 0, "יש להזין מחיר מכירה ועלות")) return;
  if (d.cost > d.sale && !confirm("העלות גבוהה ממחיר המכירה — הסעיף הפסדי. להמשיך?")) return;
  if (id){ const b = B(id); audit("עדכון סעיף כתב כמויות", `${d.item}: כמות ${b.qty}→${d.qty}, מחיר ${b.sale}→${d.sale}`); Object.assign(b, d); }
  else { DB.boq.push({id:nid(), projectId:pid, ...d}); audit("סעיף חדש בכתב כמויות", `${P(pid)?.name}: ${d.item}`); }
  closeModal(); refresh(); toast("נשמר");
}
function delBoqLine(id){ if (!guard("editBoq") || !confirm("למחוק את הסעיף?")) return; const b = B(id); DB.boq = DB.boq.filter(x => x.id!==id); audit("מחיקת סעיף", b.item); closeModal(); refresh(); }

/* ------------------------------ חשבונות ------------------------------ */
function createBill(pid){
  if (!guard("billing")) return;
  if (DB.bills.some(b => b.projectId===pid && b.status==="טיוטה")) return toast("כבר קיימת טיוטה לפרויקט","danger");
  const lines = billLinesFor(pid), total = lines.reduce((a,l)=>a+(l.cum-l.prevCum)*l.price,0);
  if (!req(total > 0, "אין כמויות מאושרות חדשות לחיוב")) return;
  const b = {id:nid(), projectId:pid, period:monthKey(), date:today(), lines, total, status:"טיוטה", createdBy:S.user.id};
  DB.bills.push(b); audit("הפקת טיוטת חשבון", `${P(pid)?.name}: ${money(total)}`); refresh(); viewBill(b.id); toast("טיוטת החשבון הופקה");
}
function billHTML(b){
  const p = P(b.projectId);
  return `<p>לכבוד: <b>${esc(p?.client)}</b> · פרויקט: <b>${esc(p?.name)}</b> · תקופה: ${b.period} · חשבון מס׳ ${b.id} · ${st(b.status)}</p>
  <table class="mini bill"><thead><tr><th>סעיף</th><th>יח׳</th><th>מצטבר קודם</th><th>מצטבר נוכחי</th><th>לתקופה</th><th>מחיר</th><th>סכום</th></tr></thead><tbody>
  ${b.lines.map(l=>`<tr><td>${esc(l.item)}</td><td>${esc(l.unit)}</td><td>${num(l.prevCum)}</td><td>${num(l.cum)}</td><td><b>${num(l.cum-l.prevCum)}</b></td><td>${money(l.price)}</td><td>${money((l.cum-l.prevCum)*l.price)}</td></tr>`).join("")}</tbody>
  <tfoot><tr><td colspan="6">סה״כ לפני מע״מ</td><td>${money(b.total)}</td></tr><tr><td colspan="6">מע״מ 18%</td><td>${money(b.total*0.18)}</td></tr><tr><td colspan="6"><b>סה״כ לתשלום</b></td><td><b>${money(b.total*1.18)}</b></td></tr></tfoot></table>
  <p class="muted">החשבון כולל רק כמויות שאושרו ע״י מהנדס ביומני העבודה.</p>`;
}
function viewBill(id){
  const b = DB.bills.find(x => x.id===id);
  openModal(`<h2>חשבון ${id}</h2>${billHTML(b)}<div class="actions"><button class="dark" onclick="printHTML(printHeader('חשבון חלקי מס׳ ${id}')+billHTML(DB.bills.find(x=>x.id===${id}))+'<div class=sign-line>חתימת מהנדס: ____________ &nbsp; אישור מפקח: ____________</div>')">🖨 הדפס / שמור PDF</button>
   ${can("billing")&&b.status==="טיוטה"?`<button onclick="setBillStatus(${id},'נשלח')">אשר ושלח ללקוח</button>`:""}</div>`, true);
}
function setBillStatus(id, s){
  const b = DB.bills.find(x => x.id===id);
  if (s==="שולם" ? !guard("markPaid") : !guard("billing")) return;
  if (s==="נשלח" && !confirm(`לאשר ולשלוח את חשבון ${id} על סך ${money(b.total)}? לאחר מכן לא ניתן לערוך.`)) return;
  b.status = s; b[s==="שולם"?"paidAt":"sentAt"] = today(); audit(`חשבון ${s}`, `${id} · ${money(b.total)}`); closeModal(); refresh(); toast(`חשבון ${id}: ${s}`);
}
function delBill(id){ if (!guard("billing") || !confirm("למחוק את הטיוטה?")) return; DB.bills = DB.bills.filter(b => b.id!==id); audit("מחיקת טיוטת חשבון", id); refresh(); }

/* ------------------------------ מכרזים ------------------------------ */
function openTender(id){
  const t = id ? DB.tenders.find(x => x.id===id) : {name:"",client:"",due:addDays(14),markup:20,status:"בהכנה",lines:[{type:"dig",qty:0,cost:WORK.dig?31:0,sub:0}]};
  S.draft.tender = JSON.parse(JSON.stringify(t)); const ed = can("tenders");
  openModal(`<h2>${id?esc(t.name):"מכרז חדש"}</h2><div class="form-grid">
   <div><label>שם המכרז *</label><input id="tn_n" value="${esc(t.name)}" ${ed?"":"disabled"}></div><div><label>מזמין *</label><input id="tn_c" value="${esc(t.client)}" ${ed?"":"disabled"}></div>
   <div><label>מועד הגשה</label><input id="tn_d" type="date" value="${esc(t.due)}" ${ed?"":"disabled"}></div><div><label>אחוז רווח (קבלן ראשי) %</label><input id="tn_m" type="number" step="any" value="${t.markup}" oninput="S.draft.tender.markup=+this.value||0;tLines()" ${ed?"":"disabled"}></div></div>
   <div id="tn_lines"></div>
   ${ed?`<div class="actions"><button onclick="S.draft.tender.lines.push({type:'other',qty:0,cost:0,sub:0});tLines()">+ שורה</button><button class="dark" onclick="saveTender(${id||""})">שמור</button>
   ${id?`<select onchange="if(this.value)setTenderStatus(${id},this.value)"><option value="">שנה סטטוס…</option>${optionList(["בהכנה","הוגש","זכינו","הפסדנו"].map(x=>[x,x]))}</select>`:""}</div>`:""}`, true);
  tLines();
}
function tLines(){
  const t = S.draft.tender, ed = can("tenders"), c = tenderCalc(t);
  $("tn_lines").innerHTML = `<div class="table-wrap"><table class="mini"><thead><tr><th>סוג עבודה</th><th>כמות</th><th>עלות פנימית ליח׳</th><th>מחיר קבלן משנה</th><th>מחיר הצעה ליח׳</th><th>היסטוריה</th><th>סה״כ</th><th></th></tr></thead><tbody>
  ${t.lines.map((l,i) => { const uc = l.sub>0?l.sub:l.cost, up = Math.round(uc*(1+t.markup/100)*100)/100, h = priceHistory(l.type);
    return `<tr><td><select onchange="tl(${i},'type',this.value)" ${ed?"":"disabled"}>${optionList(Object.entries(WORK).map(([k,w])=>[k,w.name]),l.type)}</select></td>
    <td><input type="number" value="${l.qty}" onchange="tl(${i},'qty',this.value)" ${ed?"":"disabled"}></td><td><input type="number" step="any" value="${l.cost}" onchange="tl(${i},'cost',this.value)" ${ed?"":"disabled"}></td>
    <td><input type="number" step="any" value="${l.sub}" onchange="tl(${i},'sub',this.value)" placeholder="0 = ביצוע עצמי" ${ed?"":"disabled"}></td><td>${money(up)}</td>
    <td><small>${h.length?`${money(Math.min(...h.map(x=>x.price)))}–${money(Math.max(...h.map(x=>x.price)))}`:"-"}</small></td><td>${money(up*l.qty)}</td>
    <td>${ed?`<button class="small danger" onclick="S.draft.tender.lines.splice(${i},1);tLines()">×</button>`:""}</td></tr>`; }).join("")}</tbody>
  <tfoot><tr><td colspan="6">עלות פנימית כוללת</td><td colspan="2">${money(c.cost)}</td></tr><tr><td colspan="6"><b>מחיר הצעה</b></td><td colspan="2"><b>${money(c.price)}</b></td></tr><tr><td colspan="6">רווח צפוי</td><td colspan="2">${money(c.profit)} (${pct(c.profit,c.price)}%)</td></tr></tfoot></table></div>
  <p class="muted">מחיר ליחידה = (מחיר קבלן משנה אם קיים, אחרת עלות פנימית) × (1 + אחוז רווח). עמודת "היסטוריה" מציגה טווח מחירי מכירה מפרויקטים ומכרזים קודמים.</p>`;
}
function tl(i, k, v){ const l = S.draft.tender.lines[i]; l[k] = k==="type" ? v : (+v||0); if (k==="type" && !l.cost){ const h = DB.boq.find(b=>b.type===v); if (h) l.cost = h.cost; } tLines(); }
function saveTender(id){
  if (!guard("tenders")) return;
  const t = S.draft.tender; Object.assign(t, {name:val("tn_n"), client:val("tn_c"), due:val("tn_d"), markup:nval("tn_m")});
  if (!req(t.name && t.client, "יש להזין שם מכרז ומזמין") || !req(t.lines.some(l=>l.qty>0), "יש להוסיף לפחות שורה אחת עם כמות")) return;
  t.lines = t.lines.filter(l => l.qty > 0);
  if (id){ const i = DB.tenders.findIndex(x => x.id===id); DB.tenders[i] = t; } else { t.id = nid(); DB.tenders.push(t); }
  audit(id?"עדכון מכרז":"מכרז חדש", `${t.name}: ${money(tenderCalc(t).price)}`); closeModal(); refresh(); toast("המכרז נשמר");
}
function setTenderStatus(id, s){ if (!guard("tenders")) return; const t = DB.tenders.find(x => x.id===id); t.status = s; audit("סטטוס מכרז", `${t.name}: ${s}`); closeModal(); refresh(); if (s==="זכינו") toast("מזל טוב! ניתן ליצור פרויקט מהמכרז"); }
function tenderToProject(id){
  if (!guard("manageProjects")) return;
  const t = DB.tenders.find(x => x.id===id), c = tenderCalc(t);
  const p = {id:nid(), name:t.name, client:t.client, status:"תכנון", managerId:S.user.role==="engineer"?S.user.id:2, lat:null, lng:null, start:today(), end:addDays(180), budget:Math.round(c.cost)};
  DB.projects.push(p);
  t.lines.forEach(l => { const uc = l.sub>0?l.sub:l.cost; DB.boq.push({id:nid(), projectId:p.id, type:l.type, item:WORK[l.type].name, unit:WORK[l.type].unit, qty:l.qty, base:0, sale:Math.round(uc*(1+t.markup/100)*100)/100, cost:uc}); });
  t.projectId = p.id; audit("פרויקט נוצר ממכרז", t.name); save();
  S.filters.project = String(p.id); go("boq"); toast("הפרויקט וכתב הכמויות נוצרו מהמכרז — הגדר מיקום אתר בעריכת הפרויקט");
}

/* ------------------------------ מסמכים ------------------------------ */
function openDocUpload(){
  if (!guard("docs")) return;
  openModal(`<h2>העלאת מסמך</h2><div class="form-grid">
   <div class="full"><label>קובץ *</label><input id="dc_f" type="file" onchange="docAuto(this)"></div>
   <div><label>סוג</label><select id="dc_c">${optionList(DOC_CATS.map(c=>[c,c]),"אחר")}</select></div>
   <div><label>פרויקט</label><select id="dc_p"><option value="">כללי (חברה)</option>${optionList(visibleProjects().map(p=>[p.id,p.name]), curProject()==="all"?"":curProject())}</select></div>
   <p class="full muted" id="dc_auto">המערכת תזהה אוטומטית פרויקט וסוג לפי שם הקובץ. קבצים עד 1.5MB נשמרים במלואם; גדולים יותר נשמרים כרשומה בלבד (באב-טיפוס).</p>
   <button class="primary full" onclick="saveDoc()">העלה</button></div>`);
}
function docAuto(input){
  const n = (input.files[0]?.name || "").toLowerCase(); const hits = [];
  const p = DB.projects.find(p => n.includes(p.name.toLowerCase()) || n.includes(p.name.replace(/\s/g,"").toLowerCase()));
  if (p){ $("dc_p").value = p.id; hits.push("פרויקט: " + p.name); }
  const map = [["חוזה","חוזה"],["contract","חוזה"],["תוכנית","תוכנית"],["plan","תוכנית"],[".dwg","תוכנית"],["חשבון","חשבון"],["invoice","חשבון"],["משלוח","תעודת משלוח"],["delivery","תעודת משלוח"],["אישור","אישור"],["בטיחות","בטיחות"],["safety","בטיחות"]];
  const c = map.find(m => n.includes(m[0])); if (c){ $("dc_c").value = c[1]; hits.push("סוג: " + c[1]); }
  $("dc_auto").textContent = hits.length ? "🤖 זוהה אוטומטית — " + hits.join(" · ") : "לא זוהה פרויקט/סוג משם הקובץ — בחר ידנית";
}
async function saveDoc(){
  if (!guard("docs")) return;
  const f = $("dc_f").files[0]; if (!req(f, "יש לבחור קובץ")) return;
  const d = {id:nid(), projectId:val("dc_p")?+val("dc_p"):null, name:f.name, cat:val("dc_c"), size:f.size, data:null, by:S.user.id, at:new Date().toISOString()};
  if (f.size <= 1.5*1024*1024){ try { d.data = await readFileData(f); } catch(e){} } else toast("הקובץ גדול — נשמרה רשומה בלבד (בגרסת Production יישמר בענן)","warning");
  DB.docs.push(d); if (!save()){ DB.docs.pop(); d.data = null; DB.docs.push(d); save(); }
  audit("העלאת מסמך", f.name); closeModal(); render(); toast("המסמך נשמר");
}
function openDoc(id){ const d = DB.docs.find(x => x.id===id); if (d?.data) openDataUrl(d.data, d.name); }
function delDoc(id){ if (!guard("docs")) return; const d = DB.docs.find(x => x.id===id); if (!confirm(`למחוק את "${d.name}"?`)) return; DB.docs = DB.docs.filter(x => x.id!==id); audit("מחיקת מסמך", d.name); refresh(); }

/* ------------------------------ פגישות ------------------------------ */
function openMeeting(id){
  if (!guard("meetings")) return;
  const m = id ? DB.meetings.find(x => x.id===id) : {projectId:curProject()==="all"?"":+curProject(), date:addDays(1), time:"09:00", title:"", participants:"", summary:"", decisions:[]};
  openModal(`<h2>${id?"עריכת / סיכום פגישה":"פגישה חדשה"}</h2><div class="form-grid">
   <div class="full"><label>נושא *</label><input id="mt_t" value="${esc(m.title)}"></div>
   <div><label>פרויקט</label><select id="mt_p"><option value="">כללי</option>${optionList(visibleProjects().map(p=>[p.id,p.name]),m.projectId)}</select></div>
   <div><label>משתתפים</label><input id="mt_pa" value="${esc(m.participants)}"></div>
   <div><label>תאריך</label><input id="mt_d" type="date" value="${esc(m.date)}"></div><div><label>שעה</label><input id="mt_h" type="time" value="${esc(m.time)}"></div>
   <div class="full"><label>סיכום</label><textarea id="mt_s" rows="3">${esc(m.summary)}</textarea></div>
   <div class="full"><label>החלטות (שורה לכל החלטה)</label><textarea id="mt_dec" rows="3">${esc(m.decisions.map(d=>d.text).join("\n"))}</textarea></div>
   <button class="primary full" onclick="saveMeeting(${id||""})">שמור</button></div>`);
}
function saveMeeting(id){
  if (!guard("meetings")) return;
  const title = val("mt_t"); if (!req(title, "יש להזין נושא")) return;
  const old = id ? DB.meetings.find(x => x.id===id) : null;
  const decisions = val("mt_dec").split("\n").map(s => s.trim()).filter(Boolean).map(text => ({text, taskId: old?.decisions.find(d=>d.text===text)?.taskId || null}));
  const d = {title, projectId:val("mt_p")?+val("mt_p"):null, participants:val("mt_pa"), date:val("mt_d"), time:val("mt_h"), summary:val("mt_s"), decisions};
  if (old) Object.assign(old, d); else DB.meetings.push({id:nid(), ...d});
  if (!old) notify(`נקבעה פגישה: ${title} — ${fmtDate(d.date)} ${d.time}`, {roles:["ceo","engineer"], module:"meetings"});
  audit(old?"עדכון פגישה":"פגישה חדשה", title); closeModal(); refresh(); toast("נשמר");
}
function decisionToTask(mid, i){
  const m = DB.meetings.find(x => x.id===mid);
  openTaskForm(null, {projectId:m.projectId || visibleProjects()[0]?.id, title:m.decisions[i].text, notes:`מתוך פגישה: ${m.title} (${fmtDate(m.date)})`, fromMeeting:[mid,i]});
}
function meetingICS(id){
  const m = DB.meetings.find(x => x.id===id), d = m.date.replace(/-/g,""), t = (m.time||"09:00").replace(":","") + "00";
  const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//INDIX//HE","BEGIN:VEVENT",`UID:indix-${id}@indix`,`DTSTART:${d}T${t}`,`DURATION:PT1H`,`SUMMARY:${m.title}`,`DESCRIPTION:${(m.summary||"").replace(/\n/g,"\\n")}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");
  downloadBlob(ics, `meeting-${id}.ics`, "text/calendar");
}

/* ------------------------------ התראות ------------------------------ */
function markAllRead(){ myNotes().forEach(n => { if (!n.readBy.includes(S.user.id)) n.readBy.push(S.user.id); }); refresh(); }
function readNote(id){ const n = DB.notes.find(x => x.id===id); if (!n.readBy.includes(S.user.id)) n.readBy.push(S.user.id); save(); go(n.module); }

/* ------------------------------ ניהול ------------------------------ */
function saveSettings(){ if (!guard("admin")) return; const c = val("set_company"); if (!req(c, "יש להזין שם חברה")) return; DB.settings.company = c; audit("עדכון הגדרות חברה", c); refresh(); startApp(); toast("נשמר"); }
function openUser(id){
  if (!guard("admin")) return;
  const u = id ? U(id) : {name:"", role:"worker", pin:"", phone:"", active:true, projects:[]};
  openModal(`<h2>${id?"עריכת משתמש":"משתמש חדש"}</h2><div class="form-grid">
   <div><label>שם *</label><input id="us_n" value="${esc(u.name)}"></div><div><label>טלפון</label><input id="us_ph" value="${esc(u.phone)}"></div>
   <div><label>תפקיד</label><select id="us_r" ${id===S.user.id?"disabled":""}>${optionList(Object.entries(ROLES),u.role)}</select></div>
   ${CLOUD.enabled ? `<div class="full"><label>מייל כניסה *</label><input id="us_em" type="email" dir="ltr" value="${esc(u.email||"")}" ${id===S.user.id?"disabled":""}><small class="muted">העובד נרשם במסך הכניסה עם המייל הזה וסיסמה משלו, ומיד מקבל גישה לפי התפקיד.</small></div>`
   : `<div><label>קוד כניסה (4-8 ספרות) ${id?"— השאר ריק כדי לא לשנות":"*"}</label><input id="us_pin" inputmode="numeric" placeholder="${id?"••••":""}"></div>`}
   <div class="full"><label>פרויקטים מותרים</label><label class="chk"><input type="checkbox" id="us_all" ${u.projects==="all"?"checked":""}> כל הפרויקטים</label>
   <div class="chks">${DB.projects.map(p=>`<label class="chk"><input type="checkbox" class="us_pr" value="${p.id}" ${u.projects!=="all"&&u.projects.includes(p.id)?"checked":""}> ${esc(p.name)}</label>`).join("")}</div></div>
   <button class="primary full" onclick="saveUser(${id||""})">שמור</button></div>`);
}
function saveUser(id){
  if (!guard("admin")) return;
  const name = val("us_n"), pin = val("us_pin");
  if (!req(name, "יש להזין שם")) return;
  const email = CLOUD.enabled ? (id===S.user.id ? S.user.email : val("us_em").toLowerCase()) : undefined;
  if (CLOUD.enabled){
    if (!req(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email||""), "יש להזין מייל תקין")) return;
    if (!req(!DB.users.some(x => x.id!==id && (x.email||"").toLowerCase()===email), "המייל כבר משויך למשתמש אחר")) return;
  } else if ((!id || pin) && !req(/^\d{4,8}$/.test(pin), "קוד כניסה חייב להיות 4-8 ספרות")) return;
  const projects = $("us_all").checked ? "all" : [...document.querySelectorAll(".us_pr:checked")].map(c => +c.value);
  const d = {name, phone:val("us_ph"), role:id===S.user.id ? S.user.role : val("us_r"), projects};
  if (pin) d.pin = pin; if (CLOUD.enabled) d.email = email;
  if (id){ Object.assign(U(id), d); audit("עדכון משתמש", `${name}${pin?" (איפוס קוד)":""}`); }
  else { DB.users.push({id:nid(), active:true, pin:"", ...d}); audit("משתמש חדש", `${name} — ${ROLES[d.role]}`); }
  closeModal(); refresh(); toast("נשמר");
}
function toggleUser(id){
  if (!guard("admin") || id===S.user.id) return; const u = U(id);
  if (!confirm(`${u.active?"להשבית":"להפעיל"} את ${u.name}?`)) return;
  u.active = !u.active; audit(u.active?"הפעלת משתמש":"השבתת משתמש", u.name); refresh();
}
function exportBackup(){ if (!guard("admin")) return; audit("גיבוי נתונים"); save(); downloadBlob(JSON.stringify(DB), `indix-backup-${today()}.json`, "application/json"); }
function importBackup(input){
  if (!guard("admin")) return; const f = input.files[0]; if (!f) return;
  const fr = new FileReader(); fr.onload = () => {
    try { const d = JSON.parse(fr.result); if (!d.users || !d.projects || !d.ver) throw 0;
      if (!confirm("השחזור יחליף את כל הנתונים הנוכחיים. להמשיך?")) return;
      DB = d; DB.ver = DB_VER; Object.assign(MATERIALS, DB.customMaterials||{}); audit("שחזור מגיבוי", f.name); save(); toast("השחזור הושלם"); if (CLOUD.enabled){ clearTimeout(CLOUD.timer); CLOUD.sync().then(()=>location.reload()); } else setTimeout(()=>location.reload(), 800);
    } catch(e){ toast("קובץ גיבוי לא תקין","danger"); } };
  fr.readAsText(f);
}
function resetDemo(){ if (CLOUD.enabled) return; if (!guard("admin") || !confirm("כל הנתונים יימחקו ויוחלפו בנתוני דוגמה. להמשיך?")) return; localStorage.removeItem(DB_KEY); localStorage.removeItem(SESSION_KEY); location.hash = ""; location.reload(); }

/* ------------------------------ הפעלה ------------------------------ */
function init(){
  $("verTag").textContent = APP_VERSION;
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  $("modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
  window.addEventListener("hashchange", () => S.user && navigate(location.hash.slice(1)));
  if (CLOUD.init()){
    cloudLoginUI();
    $("pwInput").addEventListener("keydown", e => { if (e.key === "Enter") cloudLogin(); });
    afterAuth().catch(e => authMsg("שגיאה: " + e.message, true));
    return;
  }
  load(); Object.assign(MATERIALS, DB.customMaterials || {});
  renderLogin();
  $("pinInput").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
  window.addEventListener("storage", e => { if (e.key === DB_KEY && S.user){ load(); S.user = U(S.user.id) || S.user; render(); } }); // סנכרון בין לשוניות
  const sid = localStorage.getItem(SESSION_KEY), u = sid && U(sid);
  if (u && u.active){ S.user = u; startApp(); } else localStorage.removeItem(SESSION_KEY);
}
init();

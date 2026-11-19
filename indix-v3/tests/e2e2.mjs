// Round 2: demo company — every role, every screen, new features, edge cases
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const URL = 'http://127.0.0.1:8766/index.html';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
const ctx = await b.newContext({ viewport:{width:1366,height:900}, acceptDownloads:true });
const page = await ctx.newPage(); const errors = [], findings = [];
page.on('pageerror', e => errors.push(e.message));
const bug = (a,m) => { findings.push(`[${a}] ${m}`); console.log('  ✗', a, m); };
const ev = (f,a) => page.evaluate(f,a);
await page.goto(URL); await page.waitForTimeout(400);

// old-device simulation: an old seed in storage should be replaced by the demo once
await ev(() => { localStorage.setItem('indix_v3_db', JSON.stringify({ver:3, settings:{company:'ישן'}, users:[{id:1,name:'Yasen',role:'ceo',pin:'1598',active:true,projects:'all'}], projects:[],boq:[],tasks:[],reports:[],daily:[],plans:[],stock:[],movements:[],suppliers:[],requests:[],bills:[],tenders:[],meetings:[],docs:[],notes:[],audit:[]})); Object.keys(localStorage).filter(k=>k.startsWith('indix_demo_loaded')).forEach(k=>localStorage.removeItem(k)); });
await page.reload(); await page.waitForTimeout(400);
const comp = await ev(() => DB.settings.company); if (!comp.includes('אופק')) bug('demo', 'old device data not replaced by demo company: ' + comp);
// dates are current
const lastRep = await ev(() => DB.reports.map(r=>r.date).sort().pop()); const t0 = await ev(() => today());
const age = (new Date(t0) - new Date(lastRep))/864e5; console.log('last report', lastRep, 'today', t0, 'age', age);
if (age > 9) bug('demo', 'demo data is stale');
// after reload, data persists (not re-seeded again)
await ev(() => { DB.settings.company = 'אופק בדיקת שמירה'; save(); }); await page.reload(); await page.waitForTimeout(300);
if ((await ev(() => DB.settings.company)) !== 'אופק בדיקת שמירה') bug('demo','data re-seeded on every load (user changes lost)');

// every user, every screen, every project filter, every modal
const res = await ev(() => {
  const out = [];
  for (const u of DB.users){
    S.user = u; S.filters = {}; try { startApp(); } catch(e){ out.push(u.name+' start '+e.message); }
    for (const k of ROLE_ACCESS[u.role]){ try { navigate(k); } catch(e){ out.push(`${u.role}/${k}: ${e.message}`); } }
    for (const p of visibleProjects()){ S.filters.project = String(p.id); for (const k of ROLE_ACCESS[u.role]) { try { S.current=k; render(); } catch(e){ out.push(`${u.role}/${k}/p${p.id}: ${e.message}`);} } }
    S.filters = {};
    try { visibleReports().slice(-3).forEach(r => openApprove(r.id)); closeModal(); } catch(e){ out.push(u.role+' approve modal '+e.message); }
    try { visibleProjects().forEach(p => openProject(p.id)); closeModal(); } catch(e){ out.push(u.role+' project modal '+e.message); }
    try { DB.plans.filter(p=>canSeeProject(p.projectId)).forEach(p => openPlan(p.id)); closeModal(); } catch(e){ out.push(u.role+' plan modal '+e.message); }
    if (u.role==='ceo'){ try { DB.bills.forEach(x => viewBill(x.id)); DB.requests.forEach(x => viewRequest(x.id)); DB.tenders.forEach(x => openTender(x.id)); DB.meetings.forEach(x=>openMeeting(x.id)); closeModal(); } catch(e){ out.push('ceo modals '+e.message); } }
  }
  return out;
});
res.forEach(x => bug('render', x));

// login as engineer via UI and try over-BOQ task
async function loginAs(name){
  if (await page.locator('#appView').isVisible()){ await page.locator('.logout').click(); await page.waitForLoadState('load'); await page.waitForTimeout(250); }
  const v = await page.locator('#userInput option', {hasText:name}).first().getAttribute('value');
  await page.locator('#userInput').selectOption(v); await page.locator('#pinInput').fill('1598'); await page.locator('#localLogin button.primary').click(); await page.waitForTimeout(300);
}
await ev(() => { localStorage.removeItem('indix_session'); }); await page.reload(); await page.waitForTimeout(300);
await loginAs('סאמי');
console.log('user', await ev(() => S.user?.name), await page.locator('#loginErr').textContent());
const eng = await ev(() => { navigate('tasks'); openTaskForm(); if (!$('tk_p')) return 'NO FORM: '+$('modal').className+' '+$('toasts').innerText+' '+S.user.role; const pid = +$('tk_p').value; const b = projectBoq(pid)[0]; $('tk_b').value = b.id; $('tk_title').value='חורגת'; $('tk_qty').value = String(b.qty*5); saveTask(); return DB.tasks.some(t=>t.title==='חורגת'); });
console.log('eng', eng); if (eng===true) bug('tasks','engineer could create task beyond contract quantity'); await page.keyboard.press('Escape');

// worker: report then cancel own pending report
await loginAs('מוחמד');
const wk = await ev(() => { const t = myTasks().find(t => t.status!=='הושלם' && t.qty - taskDone(t) - taskPending(t) > 0); if (!t) return 'no task';
  navigate('fieldAI'); $('rf_task').value = t.id; $('rf_qty').value = '1'; submitReport();
  const r = DB.reports.filter(x=>x.userId===S.user.id && x.status==='pending').pop(); if (!r) return 'no report';
  openApprove(r.id); const hasBtn = !!document.querySelector('#modal button.danger'); cancelReport(r.id);
  return {hasBtn, gone: !DB.reports.some(x=>x.id===r.id), st: T(r.taskId).status}; });
console.log('worker cancel:', wk); if (!wk.hasBtn || !wk.gone) bug('field','cancel own report failed '+JSON.stringify(wk));
// worker changes own PIN
const pinOk = await ev(() => { openMyPin(); $('mp_old').value='1598'; $('mp_new').value='2468'; saveMyPin(); return S.user.pin === '2468' && DB.users.find(u=>u.id===S.user.id).pin==='2468'; });
if (!pinOk) bug('pin','change own pin failed');
await page.locator('.logout').click(); await page.waitForLoadState('load'); await page.waitForTimeout(250);
const v = await page.locator('#userInput option', {hasText:'מוחמד'}).first().getAttribute('value');
await page.locator('#userInput').selectOption(v); await page.locator('#pinInput').fill('1598'); await page.locator('#localLogin button.primary').click(); await page.waitForTimeout(200);
if (await page.locator('#appView').isVisible()) bug('pin','old PIN still works');
await page.locator('#pinInput').fill('2468'); await page.locator('#localLogin button.primary').click(); await page.waitForTimeout(200);
if (!(await page.locator('#appView').isVisible())) bug('pin','new PIN does not work');

// purchasing: cancel request + PO print + storekeeper stock count
await loginAs('מאיה');
const pr = await ev(() => { const pid = visibleProjects().find(p=>p.status==='פעיל').id; openRequest('cable', pid); $('rq_q').value='10'; saveRequest();
  const r = DB.requests.filter(x=>x.requestedBy===S.user.id).pop(); viewRequest(r.id); cancelRequest(r.id);
  const o = DB.requests.find(x=>x.status==='הוזמן — ממתין לאספקה' || x.status==='סופק למחסן'); let printed = false; if (o){ printPO(o.id); printed = document.getElementById('printArea').innerHTML.includes('הזמנת רכש'); }
  return {cancel: r.status, printed}; });
console.log('purchasing:', pr); if (pr.cancel !== 'נדחה' || !pr.printed) bug('purchasing', JSON.stringify(pr));
await loginAs('ג׳ורג׳');
const sc = await ev(() => { navigate('warehouse'); const s = stockOf('conduit'); const before = s.qty; openStockEdit('conduit'); $('se_min').value='300'; $('se_cnt').value=String(before-20); saveStockEdit('conduit'); const noNote = stockOf('conduit').qty===before;
  $('se_note').value='צינורות פגומים'; saveStockEdit('conduit'); return {noNote, after: stockOf('conduit').qty, before, min: stockOf('conduit').min, mv: DB.movements.filter(m=>m.adjust).length}; });
console.log('stock count:', sc); if (!sc.noNote || sc.after !== sc.before-20 || sc.min !== 300) bug('warehouse','stock count '+JSON.stringify(sc));

// CEO: start empty company
await loginAs('Claude');
await ev(() => { window.prompt = () => 'צ.ב הנדסת מערכות'; startEmpty(); }); await page.waitForTimeout(800);
const em = await ev(() => ({users: DB.users.length, projects: DB.projects.length, comp: DB.settings.company, logged: !!S.user, stock: DB.stock.length}));
console.log('empty:', em); if (em.users !== 1 || em.projects !== 0 || !em.logged) bug('admin','start empty failed '+JSON.stringify(em));
// reset back to demo
await ev(() => resetDemo()); await page.waitForTimeout(800);
if (!(await ev(() => DB.settings.company.includes('אופק')))) bug('admin','reset to demo failed');

console.log('\nERRORS:', errors.length ? errors : 'none'); console.log('FINDINGS:', findings.length ? findings : 'none');
await b.close();

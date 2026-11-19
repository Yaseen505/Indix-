// INDIX — end-to-end company test: drives the real UI as CEO, engineers, workers, contractors, purchasing, storekeeper.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const URL = process.env.URL || 'http://127.0.0.1:8766/index.html';
const SHOTS = '/home/claude/e2e/shots'; fs.mkdirSync(SHOTS, {recursive:true});
const findings = []; const log = (...a) => console.log(...a);
const bug = (area, msg) => { findings.push(`[${area}] ${msg}`); log('  ✗ BUG', area, msg); };

// tiny PNG (site photo) generated in-browser later; here a 64x48 solid PNG
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAADT6sB4AAAAQElEQVR4nO3PMQ0AIAwAsOFf9MbBQw1Nq6Bzd3ZfPgIKqKCCCiqooIIKKqiggggqqKCCCiqooIIKKqiggn8sMDUHAd1HLIlZAAAAAElFTkSuQmCC', 'base64');
// photo.png generated with sharp
fs.writeFileSync('/home/claude/e2e/contract-demo.pdf', '%PDF-1.4\n% demo\n');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
const ctx = await browser.newContext({ viewport:{width:1366,height:900}, geolocation:{latitude:32.7021, longitude:35.1082}, permissions:['geolocation'], locale:'he-IL', acceptDownloads:true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type()==='error') errors.push('console: ' + m.text()); });

const S = sel => page.locator(sel);
const ev = (fn, arg) => page.evaluate(fn, arg);
async function toastText(){ const t = await S('#toasts .toast').last().textContent().catch(()=>null); return t; }
async function clickText(text, scope = 'body'){ await page.locator(scope).getByRole('button', {name:text, exact:false}).first().click(); await page.waitForTimeout(120); }
async function modalOpen(){ return !(await S('#modal').getAttribute('class')).includes('hidden'); }
async function loginAs(name){
  if (await S('#appView').isVisible()) { await S('.logout').click(); await page.waitForLoadState('load'); await page.waitForTimeout(250); }
  const opt = await page.locator('#userInput option', {hasText:name}).first().getAttribute('value');
  await S('#userInput').selectOption(opt); await S('#pinInput').fill(await ev(id => String(U(id).pin), +opt)); await S('#localLogin button.primary').click();
  await page.waitForTimeout(250);
  if (!(await S('#appView').isVisible())) bug('login', `could not log in as ${name}: ${await S('#loginErr').textContent()}`);
}
async function submit(area, expectFail=false){
  await S('#modal button.primary').first().click(); await page.waitForTimeout(150);
  if (await modalOpen()){ const t = await toastText(); if (!expectFail) bug(area, `form did not save: "${t}"`); await page.keyboard.press('Escape'); await page.waitForTimeout(80); return false; }
  return true;
}
async function nav(key){ if (await modalOpen()) await page.keyboard.press('Escape'); await page.evaluate(k => go(k), key); await page.waitForTimeout(150); }
async function drawSig(id){ const b = await S('#'+id).boundingBox(); await page.mouse.move(b.x+20,b.y+40); await page.mouse.down(); await page.mouse.move(b.x+120,b.y+90,{steps:5}); await page.mouse.move(b.x+220,b.y+30,{steps:5}); await page.mouse.up(); }
async function shot(n){ await page.screenshot({path:`${SHOTS}/${n}.png`}); }

// ============================== START ==============================
await page.goto(URL); await page.waitForTimeout(400);
log('== fresh load: demo data and login screen');
const users0 = await ev(() => DB.users.map(u => u.name + '|' + u.role));
log('  users:', users0.length);

// ---------- CEO: company setup ----------
const ceoName = await ev(() => DB.users.find(u => u.role==='ceo').name);
await loginAs(ceoName);
log('== CEO setup');
await nav('admin');
await S('#set_company').fill('חברת בדיקה E2E בע״מ'); await clickText('שמור', '.card');
if ((await ev(() => DB.settings.company)) !== 'חברת בדיקה E2E בע״מ') bug('admin', 'company name not saved');

// new users via UI
const newUsers = [['מהנדס בדיקה','engineer','2222'],['עובד בדיקה','worker','3333'],['קבלן בדיקה','contractor','4444'],['רכש בדיקה','purchasing','5555'],['מחסנאי בדיקה','storekeeper','6666']];
for (const [n, r, pin] of newUsers){
  await clickText('+ משתמש'); await S('#us_n').fill(n); await S('#us_r').selectOption(r); await S('#us_pin').fill(pin); await S('#us_ph').fill('050-1111111');
  if (r !== 'engineer' && r !== 'purchasing' && r !== 'storekeeper') { /* assign later per project */ } else await S('#us_all').check();
  await submit('admin');
  if (!(await ev(n => DB.users.some(u => u.name===n), n))) bug('admin', `user ${n} not created`);
}
// invalid pin
await clickText('+ משתמש'); await S('#us_n').fill('בלי קוד'); await submit('admin', true);
if (await ev(() => DB.users.some(u => u.name==='בלי קוד'))) bug('admin','user created without PIN'); await page.keyboard.press('Escape');

// supplier
await nav('suppliers'); await clickText('+ ספק'); await S('#sp_n').fill('ספק בדיקה'); await S('#sp_cable').fill('50'); await S('#sp_fixture').fill('500'); await submit('suppliers');
if (!(await ev(() => DB.suppliers.some(s => s.name==='ספק בדיקה' && s.prices.cable===50)))) bug('suppliers','new supplier not saved');

// project
await nav('projects'); await clickText('+ פרויקט חדש');
await S('#np_name').fill('פרויקט בדיקה — כפר כנא'); await S('#np_client').fill('מועצה מקומית כפר כנא'); await S('#np_budget').fill('500000');
await S('#np_lat').fill('32.7021'); await S('#np_lng').fill('35.1082'); await submit('projects');
const pid = await ev(() => DB.projects.find(p => p.name==='פרויקט בדיקה — כפר כנא')?.id);
if (!pid) bug('projects','project not created'); else log('  project', pid);
// duplicate name
await clickText('+ פרויקט חדש'); await S('#np_name').fill('פרויקט בדיקה — כפר כנא'); await S('#np_client').fill('x'); await submit('projects', true);
if ((await ev(() => DB.projects.filter(p => p.name==='פרויקט בדיקה — כפר כנא').length)) > 1) bug('projects','duplicate project allowed'); await page.keyboard.press('Escape');

// BOQ lines
await nav('boq'); await ev(p => setFilter('project', String(p)), pid);
const lines = [['dig','2000','42','31'],['cable','2500','76','55'],['pole','60','850','620'],['fixture','60','780','560']];
for (const [t,q,s,c] of lines){
  await clickText('+ סעיף'); await S('#bq_t').selectOption(t); await S('#bq_q').fill(q); await S('#bq_s').fill(s); await S('#bq_c').fill(c); await submit('boq');
}
const boqN = await ev(p => projectBoq(p).length, pid);
if (boqN !== 4) bug('boq', `expected 4 BOQ lines, got ${boqN}`);
// assign field users to project
for (const n of ['עובד בדיקה','קבלן בדיקה']){
  await nav('admin'); const uid = await ev(n => DB.users.find(u=>u.name===n).id, n);
  await ev(id => openUser(id), uid); await S(`.us_pr[value="${pid}"]`).check(); await submit('admin');
  if (!(await ev(([n,p]) => DB.users.find(u=>u.name===n).projects.includes(p), [n,pid]))) bug('admin', `assign ${n} to project failed`);
}
// plan upload with image + marks
await nav('plans'); await clickText('+ העלאת תוכנית'); await S('#pl_p').selectOption(String(pid)); await S('#pl_n').fill('תוכנית תאורה בדיקה'); await S('#pl_f').setInputFiles('/home/claude/e2e/photo.png'); await S('#modal button.primary').click(); await page.waitForTimeout(500); if (await modalOpen()){ bug('plans','upload modal stayed open: '+await toastText()); await page.keyboard.press('Escape'); }
const plan = await ev(p => DB.plans.find(x => x.projectId===p), pid);
if (!plan) bug('plans','plan upload failed'); else {
  await clickText('אשר גרסה'); if ((await ev(p => DB.plans.find(x => x.projectId===p).status, pid)) !== 'מאושר') bug('plans','approve plan failed');
}

// tasks via UI
async function newTask(type, title, qty, who){
  await nav('tasks'); await clickText('+ משימה'); await S('#tk_p').selectOption(String(pid)); await page.waitForTimeout(80);
  const bid = await ev(([p,t]) => projectBoq(p).find(b=>b.type===t).id, [pid,type]); await S('#tk_b').selectOption(String(bid));
  await S('#tk_title').fill(title); await S('#tk_qty').fill(String(qty));
  const uid = await ev(n => DB.users.find(u=>u.name===n).id, who);
  const opts = await S('#tk_a option').allTextContents();
  if (!opts.some(o => o.includes(who))) { bug('tasks', `${who} not offered as assignee (options: ${opts.join(' / ')})`); await page.keyboard.press('Escape'); return null; }
  await S('#tk_a').selectOption(String(uid)); await S('#tk_loc').fill('רחוב הראשי'); await submit('tasks');
  return ev(t => DB.tasks.find(x => x.title===t)?.id, title);
}
const tDig = await newTask('dig','חפירה 300 מ׳ — רחוב הראשי',300,'עובד בדיקה');
const tCable = await newTask('cable','השחלת כבל 400 מ׳',400,'קבלן בדיקה');
const tPole = await newTask('pole','העמדת 12 עמודים',12,'עובד בדיקה');
// over-BOQ task (qty bigger than contract) — should warn/block
await nav('tasks'); await clickText('+ משימה'); await S('#tk_p').selectOption(String(pid)); await page.waitForTimeout(80);
await S('#tk_b').selectOption(String(await ev(p => projectBoq(p).find(b=>b.type==='pole').id, pid))); await S('#tk_title').fill('משימה חורגת'); await S('#tk_qty').fill('5000');
await S('#tk_a').selectOption(String(await ev(() => DB.users.find(u=>u.name==='עובד בדיקה').id))); await submit('tasks', true);
if (!(await ev(() => DB.audit.some(a => a.action==='חריגה מכתב כמויות במשימה')))) bug('tasks','CEO over-BOQ override not audited');
await ev(() => { const t = DB.tasks.find(t=>t.title==='משימה חורגת'); if (t){ DB.tasks = DB.tasks.filter(x=>x!==t); save(); } }); await page.keyboard.press('Escape').catch(()=>{});
await shot('01-ceo-setup');

// meeting with decisions -> task
await nav('meetings'); await clickText('+ פגישה'); await S('#mt_t').fill('פגישת פתיחה — בדיקה'); await S('#mt_p').selectOption(String(pid)); await S('#mt_dec').fill('להזמין כבל\nלתאם פקח'); await submit('meetings');
const mt = await ev(() => DB.meetings.find(m => m.title==='פגישת פתיחה — בדיקה'));
if (!mt || mt.decisions.length !== 2) bug('meetings','meeting/decisions not saved');

// document upload
await nav('docs'); await clickText('+ העלאת מסמך'); await S('#dc_f').setInputFiles('/home/claude/e2e/contract-demo.pdf'); await S('#dc_p').selectOption(String(pid)); await S('#modal button.primary').click(); await page.waitForTimeout(400); if (await modalOpen()) await page.keyboard.press('Escape');
if (!(await ev(() => DB.docs.some(d => d.name==='contract-demo.pdf')))) bug('docs','doc upload failed');
else if ((await ev(() => DB.docs.find(d => d.name==='contract-demo.pdf').cat)) !== 'חוזה') bug('docs','auto-detect "contract" in filename did not set category');

// ---------- WORKER ----------
log('== worker field flow');
await loginAs('עובד בדיקה');
const wNav = await S('#nav button').allTextContents();
if (wNav.some(t => t.includes('כספים'))) bug('perm','worker sees finance');
await page.goto(URL + '#finance'); await page.waitForTimeout(200);
if ((await ev(() => S.current)) === 'finance') bug('perm','worker reached finance via URL');
await nav('dashboard');
const myCards = await S('.grid.projects .card').count(); if (myCards < 2) bug('worker', `dashboard shows ${myCards} tasks, expected 2`);
await clickText('▶ התחל עבודה');
await nav('fieldAI'); await page.waitForTimeout(500);
await S('#rf_task').selectOption(String(tDig)); await S('#rf_qty').fill('150'); await S('#rf_note').fill('התקדמות טובה');
await S('.report-form input[type=file]').setInputFiles('/home/claude/e2e/photo.png'); await page.waitForTimeout(500);
await clickText('📍 קבל מיקום'); await page.waitForTimeout(500);
await clickText('שלח דיווח לאישור מהנדס'); await page.waitForTimeout(300);
const r1 = await ev(t => DB.reports.filter(r => r.taskId===t).pop(), tDig);
if (!r1) bug('field','report not created'); else { if (!r1.photo) bug('field','photo not attached'); if (!r1.gps) bug('field','GPS not attached'); }
// second report exceeding the remaining qty
await S('#rf_task').selectOption(String(tDig)); await S('#rf_qty').fill('400'); await clickText('שלח דיווח לאישור מהנדס'); await page.waitForTimeout(200);
const overRep = await ev(t => DB.reports.filter(r => r.taskId===t).length, tDig);
log('  reports on dig task after over-report:', overRep);
// draft persistence: type qty, navigate away and back
await S('#rf_qty').fill('77'); await nav('tasks'); await nav('fieldAI');
if ((await S('#rf_qty').inputValue()) !== '77') log('  (note) draft qty not kept across screens');
// empty submit
await S('#rf_qty').fill(''); await clickText('שלח דיווח לאישור מהנדס');
await shot('02-worker-field');

// ---------- CONTRACTOR (another device: no GPS permission) ----------
log('== contractor');
await loginAs('קבלן בדיקה');
await nav('fieldAI'); await page.waitForTimeout(300);
await S('#rf_task').selectOption(String(tCable)); await S('#rf_qty').fill('400'); await S('#rf_stage').selectOption('סיום');
await clickText('שלח דיווח לאישור מהנדס'); await page.waitForTimeout(200);

// ---------- ENGINEER ----------
log('== engineer approvals');
await loginAs('מהנדס בדיקה');
const engNav = await S('#nav button').allTextContents();
if (!engNav.some(t => t.includes('שטח'))) bug('perm','engineer missing field screen');
await nav('fieldAI');
const pend = await ev(p => DB.reports.filter(r => r.projectId===p && r.status==='pending').map(r=>r.id), pid);
log('  pending:', pend.length);
if (pend.length < 2) bug('engineer', `expected >=2 pending reports, got ${pend.length}`);
// approve first, correct qty on second, reject third
for (const [i,id] of pend.entries()){
  await ev(id => openApprove(id), id); await page.waitForTimeout(100);
  if (i===0){ await clickText('✓ אשר'); }
  else if (i===1){ await S('#ap_qty').fill('350'); await S('#ap_note').fill('נמדד בשטח 350'); await clickText('✓ אשר'); }
  else { await clickText('✗ דחה'); if (await modalOpen()) { await S('#ap_note').fill('כמות לא סבירה'); await clickText('✗ דחה'); } }
  await page.waitForTimeout(150);
}
const tDigNow = await ev(t => ({st:T(t).status, done:taskDone(T(t))}), tDig);
log('  dig task:', tDigNow);
// daily log approve
await nav('daily');
const dl = await ev(p => DB.daily.find(d => d.projectId===p && d.date===today()), pid);
if (!dl) bug('daily','daily log not created by report');
else { await ev(([p]) => openDaily(p, today()), [pid]); await S('#dl_w').fill('בהיר'); await S('#dl_n').fill('יום עבודה תקין'); await clickText('✓ אשר יומן'); }
if ((await ev(p => DB.daily.find(d => d.projectId===p && d.date===today())?.status, pid)) !== 'מאושר') bug('daily','daily log not approved (maybe pending reports remain)');
// print daily (should not crash)
await ev(p => printDaily(p, today()), pid).catch(e => bug('daily','print crashed '+e.message));
// purchase request within BOQ, and over BOQ
async function request(mat, qty){
  await nav('purchasing'); await clickText('+ דרישת רכש'); await S('#rq_p').selectOption(String(pid)); await S('#rq_m').selectOption(mat); await S('#rq_q').fill(String(qty)); await S('#rq_r').fill('בדיקה'); await submit('purchasing');
  return ev(([m,q]) => DB.requests.filter(r => r.mat===m && r.qty===q).pop(), [mat, qty]);
}
const rqOk = await request('cable', 1000), rqOver = await request('fixture', 90);
if (!rqOk || rqOk.status !== 'מאושר — ממתין להזמנה') bug('purchasing', `within-BOQ request status: ${rqOk?.status}`);
if (!rqOver || rqOver.status !== 'ממתין לאישור מנכ״ל') bug('purchasing', `over-BOQ request status: ${rqOver?.status}`);
// zero qty request should fail
await nav('purchasing'); await clickText('+ דרישת רכש'); await S('#rq_q').fill('0'); await submit('purchasing', true);
// bill: engineer creates draft
await nav('billing'); await ev(p => setFilter('project', String(p)), pid);
await clickText('הפק חשבון מהכמויות המאושרות'); await page.waitForTimeout(150);
const draft = await ev(p => DB.bills.find(b => b.projectId===p && b.status==='טיוטה'), pid);
if (!draft) bug('billing','draft bill not created'); else log('  draft bill', draft.total);
await page.keyboard.press('Escape');
await shot('03-engineer');

// ---------- CEO approves over request + sends bill ----------
log('== CEO decisions');
await loginAs(ceoName);
await nav('dashboard');
const waitTxt = await S('.timeline').first().textContent();
if (!waitTxt.includes(String(rqOver?.id))) bug('dashboard','over request not shown in CEO waiting list');
await ev(id => ceoDecide(id, true), rqOver.id);
await nav('billing'); await ev(p => setFilter('project', String(p)), pid);
if (draft){ await ev(id => setBillStatus(id,'נשלח'), draft.id); await ev(id => setBillStatus(id,'שולם'), draft.id); }
const billSt = draft ? await ev(id => DB.bills.find(b=>b.id===id).status, draft.id) : null;
if (draft && billSt !== 'שולם') bug('billing', `bill status ${billSt}`);
// second bill should only include new quantities
await nav('billing');
const nextTotal = await ev(p => billLinesFor(p).reduce((a,l)=>a+(l.cum-l.prevCum)*l.price,0), pid);
if (nextTotal !== 0) bug('billing', `after billing everything, next period total should be 0 but is ${nextTotal}`);

// ---------- PURCHASING ----------
log('== purchasing');
await loginAs('רכש בדיקה');
for (const r of [rqOk, rqOver]){
  await ev(id => openOrder(id), r.id); await page.waitForTimeout(100);
  const offers = await S('.offer').count(); if (!offers) bug('purchasing', `no supplier offers for ${r.mat}`);
  await clickText('בצע הזמנה'); await page.waitForTimeout(100);
}
const ordered = await ev(ids => ids.map(id => DB.requests.find(r=>r.id===id).status), [rqOk.id, rqOver.id]);
if (ordered.some(s => s !== 'הוזמן — ממתין לאספקה')) bug('purchasing', `orders status ${ordered}`);

// ---------- STOREKEEPER ----------
log('== storekeeper');
await loginAs('מחסנאי בדיקה');
const cableBefore = await ev(() => stockOf('cable').qty);
await ev(id => openReceive(id), rqOk.id); await S('#rc_q').fill('950'); await S('#rc_dn').fill('12345');
await clickText('אשר קליטה למלאי'); // without signature → should be refused
if (await ev(id => DB.requests.find(r=>r.id===id).status === 'סופק למחסן', rqOk.id)) bug('warehouse','receive accepted without signature');
await drawSig('rc_sig'); await clickText('אשר קליטה למלאי'); await page.waitForTimeout(200);
const cableAfter = await ev(() => stockOf('cable').qty);
if (cableAfter - cableBefore !== 950) bug('warehouse', `stock delta ${cableAfter-cableBefore} != 950`);
// issue to the contractor
await nav('warehouse'); await clickText('⬆ ניפוק לפרויקט');
await S('#mv_mat').selectOption('cable'); await S('#mv_qty').fill('400'); await S('#mv_p').selectOption(String(pid));
const toOpts = await S('#mv_to option').allTextContents(); log('  issue-to options:', toOpts.length);
await S('#mv_to').selectOption(String(await ev(() => DB.users.find(u=>u.name==='קבלן בדיקה').id)));
await drawSig('mv_sig'); await clickText('שמור תנועה'); await page.waitForTimeout(200);
if ((await ev(() => stockOf('cable').qty)) !== cableAfter - 400) bug('warehouse','issue did not reduce stock');
// issue more than in stock
await clickText('⬆ ניפוק לפרויקט'); await S('#mv_mat').selectOption('cabinet'); await S('#mv_qty').fill('99999'); await drawSig('mv_sig'); await clickText('שמור תנועה');
if ((await ev(() => stockOf('cabinet').qty)) < 0) bug('warehouse','negative stock allowed');
await page.keyboard.press('Escape');
await shot('04-store');

// ---------- CEO: tender -> project, finance, alerts, backup ----------
log('== CEO tender & reports');
await loginAs(ceoName);
await nav('tenders'); await clickText('+ מכרז חדש'); await S('#tn_n').fill('מכרז בדיקה'); await S('#tn_c').fill('עירייה');
await S('#tn_lines input[type=number]').first().fill('1000'); await S('#tn_lines input[type=number]').first().dispatchEvent('change'); await page.waitForTimeout(100);
await clickText('שמור');
const tn = await ev(() => DB.tenders.find(t => t.name==='מכרז בדיקה'));
if (!tn) bug('tenders','tender not saved'); else {
  await ev(id => setTenderStatus(id,'זכינו'), tn.id); await ev(id => tenderToProject(id), tn.id); await page.waitForTimeout(200);
  if (!(await ev(() => DB.projects.some(p => p.name==='מכרז בדיקה')))) bug('tenders','project from tender not created');
  // run tenderToProject twice?
  const before = await ev(() => DB.projects.length); await ev(id => tenderToProject(id), tn.id).catch(()=>{});
  if ((await ev(() => DB.projects.length)) > before) bug('tenders','tenderToProject can create duplicate projects');
}
for (const k of ['finance','ai','alerts','progress','people','warehouse','suppliers','docs','meetings','admin']) await nav(k);
await nav('alerts'); await clickText('סמן הכל כנקרא');
// decision -> task
await nav('meetings');
const decBtn = S('.card', {hasText:'פגישת פתיחה — בדיקה'}).locator('button:has-text("→ צור משימה")').first(); if (await decBtn.count()) { await decBtn.click(); await S('#tk_qty').fill('5'); await submit('meetings'); }
if (!(await ev(() => DB.meetings.find(m=>m.title==='פגישת פתיחה — בדיקה').decisions.some(d=>d.taskId)))) bug('meetings','decision→task link not saved');
// disable user, ensure can't log in
const wid = await ev(() => DB.users.find(u=>u.name==='עובד בדיקה').id);
await nav('admin'); await ev(id => toggleUser(id), wid);
const canLogin = await page.locator('#userInput option', {hasText:'עובד בדיקה'}).count();
// backup export
const [dl1] = await Promise.all([page.waitForEvent('download', {timeout:3000}).catch(()=>null), ev(() => exportBackup())]);
if (!dl1) bug('admin','backup download did not start');
await shot('05-ceo-end');

// ---------- mobile layout ----------
log('== mobile');
await page.setViewportSize({width:390, height:844});
for (const k of ['dashboard','fieldAI','tasks','purchasing','billing']){ await nav(k); const ow = await ev(() => document.documentElement.scrollWidth > window.innerWidth + 2); if (ow) bug('mobile', `${k} overflows horizontally on phone`); }
await shot('06-mobile');
await page.setViewportSize({width:1366, height:900});

// ---------- invariants ----------
log('== invariants');
const inv = await ev(() => {
  const out = [];
  DB.stock.forEach(s => { if (s.qty < 0) out.push('negative stock ' + s.mat); });
  DB.tasks.forEach(t => { if (taskDone(t) > t.qty) out.push(`task over-done ${t.title} ${taskDone(t)}/${t.qty}`); });
  const ids = new Set(); for (const c of ['projects','boq','tasks','reports','requests','bills','movements','docs','meetings','users']) DB[c].forEach(r => { const k=c+r.id; if (ids.has(k)) out.push('dup id '+k); ids.add(k); });
  return out;
});
inv.forEach(x => bug('data', x));

log('\n===== JS ERRORS =====\n' + (errors.length ? errors.join('\n') : 'none'));
log('\n===== FINDINGS (' + findings.length + ') =====\n' + findings.join('\n'));
fs.writeFileSync('/home/claude/e2e/findings.json', JSON.stringify({findings, errors}, null, 1));
await browser.close();

// Round 3: BOQ-required projects, BOQ search in tasks ("פירוק"), extra work, contractor statements
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const URL = 'http://127.0.0.1:8766/index.html';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
const ctx = await b.newContext({ viewport:{width:1180,height:820}, geolocation:{latitude:32.7021, longitude:35.1082}, permissions:['geolocation'] });
const page = await ctx.newPage(); const errors = [], findings = [];
page.on('pageerror', e => errors.push(e.message));
const bug = (a,m) => { findings.push(`[${a}] ${m}`); console.log('  ✗', a, m); };
const ev = (f,a) => page.evaluate(f,a); const S = s => page.locator(s);
const modalOpen = async () => !(await S('#modal').getAttribute('class')).includes('hidden');
const toast = async () => (await S('#toasts .toast').last().textContent().catch(()=>''));
fs.writeFileSync('/home/claude/e2e/boq.csv', 'סעיף,יחידה,כמות,מחיר,עלות,מחיר קבלן\nפירוק עמוד תאורה קיים,יח׳,25,330,210,190\nפירוק גוף תאורה קיים,יח׳,25,150,90,75\nהעמדת עמוד תאורה 10 מ׳,יח׳,25,880,630,\nחפירה לכבלים,מ׳,800,44,31,\nהשחלת כבל 5×25,מ׳,900,76,55,47\n');
async function loginAs(name){
  if (await S('#appView').isVisible()){ await ev(() => logout()); await page.waitForLoadState('load'); await page.waitForTimeout(250); }
  const v = await page.locator('#userInput option', {hasText:name}).first().getAttribute('value');
  await S('#userInput').selectOption(v); await S('#pinInput').fill('1598'); await S('#localLogin button.primary').click(); await page.waitForTimeout(300);
}
const nav = k => ev(k => navigate(k), k);
await page.goto(URL); await page.waitForTimeout(400);
await ev(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(400);

// demo contains new items
const demo = await ev(() => ({rem: DB.boq.filter(b=>b.type==='remove').length, x: DB.boq.filter(b=>b.extra).length, sb: (DB.subbills||[]).length}));
console.log('demo:', demo); if (!demo.rem || demo.x !== 2 || demo.sb !== 4) bug('demo', JSON.stringify(demo));

// ===== engineer creates project: must attach BOQ =====
await loginAs('סאמי'); await nav('projects');
await page.getByRole('button', {name:'+ פרויקט חדש'}).click();
await S('#np_name').fill('שדרוג תאורה — ריינה'); await S('#np_client').fill('מועצה מקומית ריינה'); await S('#np_lat').fill('32.7230'); await S('#np_lng').fill('35.3120');
await S('#modal button.primary').click(); await page.waitForTimeout(200);
if (!(await modalOpen())) bug('project','project saved without BOQ file'); else console.log('  blocked without BOQ:', await toast());
await S('#np_boq').setInputFiles('/home/claude/e2e/boq.csv'); await S('#modal button.primary').click(); await page.waitForTimeout(900); await page.getByRole('button',{name:'הכנס לכתב הכמויות'}).click(); await page.waitForTimeout(300);
const np = await ev(() => { const p = DB.projects.find(p => p.name==='שדרוג תאורה — ריינה'); return p && {id:p.id, boq: projectBoq(p.id).map(b=>[b.item,b.type,b.qty,b.sale,b.sub]), doc: DB.docs.some(d=>d.projectId===p.id && d.cat==='כתב כמויות'), cur:S.current}; });
console.log('  project:', np); if (!np || np.boq.length !== 5 || !np.doc) bug('project','BOQ CSV not imported / doc not saved '+JSON.stringify(np));
if (np && np.boq[0][1] !== 'remove') bug('project','type guess for פירוק wrong');
await page.screenshot({path:'/home/claude/e2e/shots/v34-boq.png'});
// photo BOQ on another project
await nav('projects'); await page.getByRole('button', {name:'+ פרויקט חדש'}).click();
await S('#np_name').fill('פרויקט עם צילום'); await S('#np_client').fill('לקוח'); await S('#np_boq').setInputFiles('/home/claude/e2e/photo.png'); await S('#modal button.primary').click(); await page.waitForTimeout(900); await page.keyboard.press('Escape');
if (!(await ev(() => DB.docs.some(d => d.cat==='כתב כמויות' && d.data && d.data.startsWith('data:image'))))) bug('project','photo BOQ not stored');
// paste import in BOQ screen
await ev(() => { const p = DB.projects.find(p=>p.name==='פרויקט עם צילום'); S.filters.project = String(p.id); navigate('boq'); openBoqImport(p.id); });
await S('#bi_txt').fill('סעיף\tיחידה\tכמות\tמחיר\nפירוק מרכזייה ישנה\tיח׳\t2\t2500\nהתקנת גוף תאורה LED\tיח׳\t30\t790\t560\t'); await S('#bi_txt').dispatchEvent('input');
await S('#modal button.primary').click(); await page.waitForTimeout(200);
const pasted = await ev(() => projectBoq(DB.projects.find(p=>p.name==='פרויקט עם צילום').id).map(b=>b.item+'|'+b.type));
console.log('  pasted:', pasted); if (pasted.length !== 2) bug('boq','paste import failed');

// ===== engineer creates task by typing "פירוק" =====
await nav('tasks'); await page.getByRole('button', {name:'+ משימה'}).click();
await S('#tk_p').selectOption(String(np.id)); await page.waitForTimeout(100);
await S('#tk_q').fill('פירוק'); await page.waitForTimeout(150);
const sugg = await S('#tk_sug .sug-item').allTextContents(); console.log('  suggestions for "פירוק":', sugg.map(s=>s.slice(0,60)));
if (sugg.filter(s => s.includes('פירוק') && !s.includes('אחר')).length !== 2) bug('task','"פירוק" should list the 2 dismantling items');
await page.screenshot({path:'/home/claude/e2e/shots/v34-search.png'});
await S('#tk_sug .sug-item', ).filter({hasText:'פירוק עמוד'}).first().click();
await S('#tk_qty').fill('10'); await S('#tk_a').selectOption({index:0}); await S('#modal button.primary').click(); await page.waitForTimeout(200);

const tk1chk = await ev(() => { const t = DB.tasks[DB.tasks.length-1]; return {title:t.title, item:B(t.boqId).item, extra:!!B(t.boqId).extra}; });
console.log('  task1:', tk1chk); if (tk1chk.item !== 'פירוק עמוד תאורה קיים' || tk1chk.extra) bug('task','picked BOQ item not linked');
// over the BOQ free qty -> blocked for engineer
await page.getByRole('button', {name:'+ משימה'}).click(); await S('#tk_p').selectOption(String(np.id)); await S('#tk_q').fill('פירוק עמוד'); await page.waitForTimeout(100);
await S('#tk_sug .sug-item').first().click(); await S('#tk_qty').fill('99'); await S('#modal button.primary').click(); await page.waitForTimeout(150);
if (!(await modalOpen())) bug('task','over-BOQ task allowed for engineer'); else { console.log('  over-BOQ blocked:', (await toast()).slice(0,60)); await page.keyboard.press('Escape'); }
// "other" -> extra work
await page.getByRole('button', {name:'+ משימה'}).click(); await S('#tk_p').selectOption(String(np.id));
await S('#tk_q').fill('פירוק שלט פרסום ישן'); await page.waitForTimeout(150);
const extraBtn = S('.sug-extra'); if (!(await extraBtn.count())) bug('task','no "other / extra" option'); else await extraBtn.click();
await S('#tk_xp').fill('400'); await S('#tk_xs').fill('250'); await S('#tk_xn').fill('בקשת המועצה בשטח');
await S('#tk_qty').fill('3'); await page.screenshot({path:'/home/claude/e2e/shots/v34-extra.png'});
const contractorOpt = await S('#tk_a option').allTextContents(); const ci = contractorOpt.findIndex(o => o.includes('קבלן'));
if (ci >= 0) await S('#tk_a').selectOption({index:ci});
await S('#modal button.primary').click(); await page.waitForTimeout(200);
const xl = await ev(() => { const b = DB.boq.find(b => b.item==='פירוק שלט פרסום ישן'); return b && {extra:b.extra, st:b.extraStatus, qty:b.qty, sale:b.sale, sub:b.sub, type:b.type, tasks: DB.tasks.filter(t=>t.boqId===b.id).length, note: DB.notes.some(n=>n.text.includes('פירוק שלט פרסום ישן') && n.roles.includes('ceo'))}; });
console.log('  extra line:', xl); if (!xl || !xl.extra || xl.st !== 'ממתין לאישור מזמין' || !xl.tasks || !xl.note) bug('extra','extra not created/notified '+JSON.stringify(xl));
// second task on same extra -> qty grows
await page.getByRole('button', {name:'+ משימה'}).click(); await S('#tk_p').selectOption(String(np.id)); await S('#tk_q').fill('שלט'); await page.waitForTimeout(100);
await S('#tk_sug .sug-item').filter({hasText:'פירוק שלט'}).first().click(); await S('#tk_qty').fill('2'); await S('#modal button.primary').click(); await page.waitForTimeout(150);
if ((await ev(() => DB.boq.find(b => b.item==='פירוק שלט פרסום ישן').qty)) !== 5) bug('extra','extra qty did not grow with 2nd task');

// ===== contractor reports on extra task; engineer approves =====
const subName = ci >= 0 ? contractorOpt[ci].split(' — ')[0] : null; console.log('  contractor:', subName);
if (subName){
  await loginAs(subName.slice(0,6)); await nav('fieldAI'); await page.waitForTimeout(300);
  const tid = await ev(() => DB.tasks.find(t => t.title.includes('פירוק שלט') && t.assigneeId===S.user.id)?.id);
  await S('#rf_task').selectOption(String(tid)); await S('#rf_qty').fill('3'); await page.getByRole('button',{name:'שלח דיווח לאישור מהנדס'}).click(); await page.waitForTimeout(200);
  await loginAs('סאמי');
  const rid = await ev(t => DB.reports.filter(r => r.taskId===t).pop()?.id, tid); await ev(id => openApprove(id), rid);
  await page.getByRole('button',{name:/✓ אשר/}).click(); await page.waitForTimeout(150);
  // client billing excludes pending extra
  await ev(p => { S.filters.project = String(p); navigate('billing'); }, np.id);
  const billHas = await ev(p => billLinesFor(p).some(l => l.item.includes('שלט')), np.id);
  if (billHas) bug('billing','pending extra included in client bill');
  if (!(await S('.notice.warn', {hasText:'חריגות'}).count())) bug('billing','no warning about executed pending extras');
  // contractor statement includes extra at contractor price
  const st = await ev(n => { const u = DB.users.find(u=>u.name.startsWith(n)); return subStatementLines(u.id, monthKey()).find(l => l.item.includes('שלט')); }, subName.slice(0,6));
  console.log('  contractor line:', st); if (!st || st.rate !== 250 || st.total !== 750 || !st.extra) bug('sub','extra not in contractor statement at 250/unit');
  await page.screenshot({path:'/home/claude/e2e/shots/v34-billing.png', fullPage:true});
  // engineer approves contractor statement
  const uid = await ev(n => DB.users.find(u=>u.name.startsWith(n)).id, subName.slice(0,6));
  await ev(([u]) => approveSub(u, monthKey()), [uid]);
  if ((await ev(([u]) => DB.subbills.find(s=>s.userId===u && s.period===monthKey())?.status, [uid])) !== 'אושר ע״י מהנדס') bug('sub','engineer approve statement failed');
  // CEO approves extra with price -> included in bill; CEO pays contractor
  await loginAs('Claude');
  const dashX = await S('.timeline-item', {hasText:'עבודה חריגה'}).count(); if (!dashX) bug('dashboard','CEO does not see pending extras');
  const xid = await ev(() => DB.boq.find(b => b.item==='פירוק שלט פרסום ישן').id);
  await ev(id => openBoqLine(id), xid); await S('#bq_c').fill('250'); await S('#bq_xok').check(); await S('#modal button.primary').click(); await page.waitForTimeout(150);
  const after = await ev(([p,id]) => ({st:B(id).extraStatus, inBill: billLinesFor(p).find(l=>l.boqId===id)}), [np.id, xid]);
  console.log('  after CEO approval:', after); if (after.st !== 'אושר' || !after.inBill || after.inBill.cum !== 3) bug('extra','approved extra not billable');
  await ev(([u]) => approveSub(u, monthKey()), [uid]); const sbid = await ev(([u]) => DB.subbills.filter(s=>s.userId===u && s.period===monthKey()).pop().id, [uid]); await ev(id => paySub(id), sbid); if ((await ev(id => DB.subbills.find(s=>s.id===id).status, sbid)) !== 'שולם') bug('sub','CEO approve+pay failed');
  // contractor sees own statement
  await loginAs(subName.slice(0,6)); await nav('dashboard');
  if (!(await S('h3', {hasText:'החשבון החודשי שלי'}).count())) bug('sub','contractor dashboard missing statement');
  await page.getByRole('button',{name:'הצג חשבון'}).first().click(); await page.waitForTimeout(150);
  if (!(await S('#modalContent').textContent()).includes('שלט')) bug('sub','contractor cannot see the extra in his statement');
  await page.screenshot({path:'/home/claude/e2e/shots/v34-contractor.png'});
  // contractor must not view another contractor's statement
  const other = await ev(() => { const o = DB.users.find(u => u.role==='contractor' && u.id!==S.user.id); closeModal(); viewSub(o.id, monthKey()); return $('modal').classList.contains('hidden'); });
  if (!other) bug('perm','contractor can view another contractor statement');
}
// mobile check for task form
await page.setViewportSize({width:390,height:844}); await loginAs('סאמי'); await nav('tasks'); await ev(() => openTaskForm()); await S('#tk_q').fill('פירוק');
const ow = await ev(() => document.documentElement.scrollWidth > innerWidth + 2); if (ow) bug('mobile','task form overflows'); await page.screenshot({path:'/home/claude/e2e/shots/v34-mobile-task.png'});
console.log('\nERRORS:', errors.length ? errors : 'none'); console.log('FINDINGS:', findings.length ? findings : 'none');
await b.close();

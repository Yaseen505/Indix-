// V3.6: mandatory contract terms + contractor, PDF BOQ, per-item profit (chain), saved contractor price list, statements, client bill
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const URL = 'http://127.0.0.1:8766/index.html';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
const ctx = await b.newContext({ viewport:{width:1280,height:860}, locale:'he-IL' });
const page = await ctx.newPage(); const errors = [], findings = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type()==='error') errors.push('console: '+m.text()); });
page.on('dialog', d => d.accept());
const bug = (a,m) => { findings.push(`[${a}] ${m}`); console.log('  ✗', a, m); };
const ok = m => console.log('  ✓', m);
const ev = (f,a) => page.evaluate(f,a); const S = s => page.locator(s);
async function loginAs(name){ if (await S('#appView').isVisible()){ await ev(() => logout()); await page.waitForLoadState('load'); await page.waitForTimeout(250); }
  const v = await page.locator('#userInput option', {hasText:name}).first().getAttribute('value'); await S('#userInput').selectOption(v); await S('#pinInput').fill('1598'); await S('#localLogin button.primary').click(); await page.waitForTimeout(300); }
await page.goto(URL); await ev(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(500);
const users = await ev(() => DB.users.map(u => [u.id,u.name,u.role,u.active]));
console.log('users:', users.map(u=>u[1]+'/'+u[2]).join(', '));
const eng = users.find(u=>u[2]==='engineer'), eng2 = users.filter(u=>u[2]==='engineer')[1] || eng, con = users.find(u=>u[2]==='contractor' && u[3]);
const lastToast = () => ev(() => [...document.querySelectorAll('#toasts > *, .toast')].map(t=>t.textContent).pop() || '');

// ===== 1. new project — mandatory fields
await loginAs(eng[1]); await ev(() => navigate('projects'));
await page.getByRole('button',{name:'+ פרויקט חדש'}).click();
await S('#np_name').fill('תאורה — קרית גת'); await S('#np_client').fill('עיריית קרית גת');
await S('#np_boq').setInputFiles('/home/claude/e2e/boq-kiryat-gat.pdf');
await S('#modal button.primary').click(); await page.waitForTimeout(300);
if (await ev(() => DB.projects.some(p=>p.name==='תאורה — קרית גת'))) bug('mandatory','project saved without discount'); else ok('blocked without discount: '+(await lastToast()).slice(0,60));
await S('#np_disc').fill('20'); await S('#modal button.primary').click(); await page.waitForTimeout(200);
await S('#np_main').fill('10'); await S('#modal button.primary').click(); await page.waitForTimeout(200);
if (await ev(() => DB.projects.some(p=>p.name==='תאורה — קרית גת'))) bug('mandatory','saved without contractor'); else ok('blocked without contractor');
await S('#np_con').selectOption(String(con[0]));
await page.screenshot({path:'/home/claude/e2e/shots/v36-form.png'});
await S('#modal button.primary').click(); await page.waitForTimeout(3500);

// ===== 2. PDF read -> review
const title = await S('#modalContent h2').textContent().catch(()=> ''); console.log('  review:', title);
const n = await S('.ai_ck').count(); if (n !== 70) bug('pdf', `expected 70 rows, got ${n}`); else ok('PDF: 70 rows read');
const r0 = await ev(() => S.draft.aiBoq.rows.slice(0,3)); console.log('  rows:', JSON.stringify(r0));
if (!r0[0]?.item.includes('פירוק עמוד') || r0[0].qty !== 40 || r0[0].sale !== 450) bug('pdf', 'row 1 wrong');
if (!r0[1]?.item.includes('והידוק') || r0[1].qty !== 1801 || r0[1].sale !== 48) bug('pdf', 'wrapped row 2 wrong: '+r0[1]?.item);
await page.screenshot({path:'/home/claude/e2e/shots/v36-review.png'});
// fill one contractor price in review, insert -> profit screen opens because others missing
await S('.ai_sub').nth(2).fill('500'); await page.waitForTimeout(100);
const pr = await S('.ai_pr').nth(2).textContent(); if (!pr.includes('580')) bug('calc', 'review profit cell: '+pr); else ok('review profit 1500 -20% -10% -500 = 580');
await page.getByRole('button',{name:'הכנס לכתב הכמויות'}).click(); await page.waitForTimeout(900);
const pid = await ev(() => DB.projects.find(p=>p.name==='תאורה — קרית גת').id);
const pt = await S('#modalContent h2').textContent().catch(()=> ''); if (!pt.includes('מחירי קבלן')) bug('flow','profit screen did not open: '+pt); else ok('profit screen opened (missing prices)');
// fill all: price = sale*0.6 except the "מרכזיית" lines -> loss
await ev(() => document.querySelectorAll('.pf_in').forEach(i => { if (i.value === ''){ const b = B(+i.dataset.id); i.value = b.item.includes('מרכזיית') ? 20000 : Math.round(b.sale*0.6); } }));
await ev(() => pfCalc());
const ai = await S('#pf_ai').textContent(); console.log('  AI:', ai.replace(/\s+/g,' ').slice(0,220));
if (!ai.includes('בהפסד')) bug('calc','loss summary missing');
await page.screenshot({path:'/home/claude/e2e/shots/v36-profit.png'});
await page.getByRole('button',{name:'שמור מחירי קבלן'}).click(); await page.waitForTimeout(400);
const pp = await ev(p => { const x = projectProfit(p); return {missing:x.missing, losses:x.losses.length, profit:x.profit}; }, pid); console.log('  project profit:', pp);
if (pp.missing) bug('save','still missing');
const pole = await ev(p => { const b = projectBoq(p).find(b=>b.item.startsWith('העמדת עמוד')); return lineProfit(b); }, pid);
if (pole.unit !== 580 || pole.net !== 1080 || pole.afterDisc !== 1200) bug('calc', JSON.stringify(pole)); else ok('chain calc: 1500 → 1200 → 1080 − 500 = 580');
const nPrices = await ev(c => DB.cprices.filter(x=>x.contractorId===c).length, con[0]); console.log('  price list for contractor:', nPrices);
await S('#content').screenshot({path:'/home/claude/e2e/shots/v36-boq.png'}).catch(()=>{});

// ===== 3. another engineer, another project, same contractor -> prices auto-filled
await loginAs(eng2[1]); await ev(() => navigate('projects'));
await page.getByRole('button',{name:'+ פרויקט חדש'}).click();
await S('#np_name').fill('תאורה — שדרות'); await S('#np_client').fill('עיריית שדרות'); await S('#np_disc').fill('15'); await S('#np_main').fill('0'); await S('#np_con').selectOption(String(con[0]));
await S('#np_boq').setInputFiles('/home/claude/e2e/boq-kiryat-gat.pdf'); await S('#modal button.primary').click(); await page.waitForTimeout(3500);
const stars = await ev(() => S.draft.aiBoq.rows.filter(r=>r.fromList).length); if (stars !== 70) bug('pricelist', 'prefilled '+stars+'/70'); else ok('second project: all 70 contractor prices prefilled from saved price list');
await page.getByRole('button',{name:'הכנס לכתב הכמויות'}).click(); await page.waitForTimeout(700);
const pid2 = await ev(() => DB.projects.find(p=>p.name==='תאורה — שדרות').id);
const p2 = await ev(p => { const b = projectBoq(p).find(b=>b.item.startsWith('העמדת עמוד')); return [missingSub(p).length, b.sub, lineProfit(b).unit]; }, pid2);
if (p2[0] || p2[1] !== 500 || p2[2] !== 775) bug('pricelist', JSON.stringify(p2)); else ok('project 2 (15%, 0%): 1500 → 1275 − 500 = 775');

// ===== 4. task blocked when contractor price missing
await ev(p => { const b = projectBoq(p)[0]; b.sub = null; }, pid2);
const before = await ev(() => DB.tasks.length);
await ev(p => { const b = projectBoq(p)[0]; openTaskForm?.(); }, pid2).catch(()=>{});
await ev(([p]) => { closeModal(); document.body.insertAdjacentHTML('beforeend', `<div id="tmpf" style="display:none"><input id="tk_p" value="${p}"><input id="tk_b" value="${projectBoq(p)[0].id}"><input id="tk_title" value="x"><input id="tk_qty" value="5"><input id="tk_a" value="${DB.users.find(u=>u.role==='worker').id}"><input id="tk_loc"><input id="tk_due"><input id="tk_notes"></div>`); S.draft.extra = null; saveTask(); document.getElementById('tmpf').remove(); }, [pid2]);
if (await ev(() => DB.tasks.length) !== before) bug('task','task created without contractor price'); else ok('task blocked: '+(await lastToast()).slice(0,70));

// ===== 5. statement: worker report in project 1 goes to contractor at contractor price
const wk = users.find(u=>u[2]==='worker');
const st = await ev(([p, w, c]) => { const b = projectBoq(p).find(b=>b.item.startsWith('העמדת עמוד'));
  DB.reports.push({id:nid(), projectId:p, boqId:b.id, taskId:null, userId:w, qty:10, qtyReported:10, date:today(), at:new Date().toISOString(), status:'approved', photo:null, gps:null});
  const lines = subStatementLines(c, monthKey()), mine = subStatementLines(w, monthKey()).filter(l=>l.projectId===p);
  return {line: lines.find(l=>l.boqId===b.id), workerLines: mine.length}; }, [pid, wk[0], con[0]]);
if (!st.line || st.line.total !== 5000 || st.workerLines) bug('statement', JSON.stringify(st)); else ok('contractor statement: 10 poles × 500 = 5,000 (worker not paid twice)');

// ===== 6. client bill with chain deductions
await loginAs(eng[1]);
const bill = await ev(p => { S.filters.project = String(p); createBill(p); const b = DB.bills.find(x=>x.projectId===p); closeModal(); return b && {gross:b.gross, total:b.total, d:b.discountPct, m:b.mainPct}; }, pid);
if (!bill || bill.gross !== 15000 || bill.total !== 10800) bug('bill', JSON.stringify(bill)); else ok('client bill: 15,000 −20% −10% = 10,800');
await ev(() => navigate('boq')); await page.waitForTimeout(300);
await page.screenshot({path:'/home/claude/e2e/shots/v36-boq-page.png', fullPage:false});

// ===== 7. older project without terms shows warning; edit sets them
const old = await ev(() => DB.projects.find(p => !p.contractorId)?.id);
if (old){ await ev(o => { S.filters.project = String(o); navigate('boq'); }, old); await page.waitForTimeout(200);
  const w = await S('#content').textContent(); if (!w.includes('לא הוגדרו קבלן')) bug('old','no warning on old project'); else ok('old project shows "set terms" warning'); }

console.log('\nerrors:', errors.length ? errors : 'none'); console.log('findings:', findings.length ? findings : 'none');
await b.close();

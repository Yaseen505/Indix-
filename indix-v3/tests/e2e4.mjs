// Round 4: AI reads BOQ (xlsx, CSV, photo via mocked Claude), daily earnings, engineer→CEO approval chain
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const URL = 'http://127.0.0.1:8766/index.html';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
const ctx = await b.newContext({ viewport:{width:1280,height:860}, geolocation:{latitude:32.80, longitude:35.33}, permissions:['geolocation'] });
const page = await ctx.newPage(); const errors = [], findings = [];
page.on('pageerror', e => errors.push(e.message));
const bug = (a,m) => { findings.push(`[${a}] ${m}`); console.log('  ✗', a, m); };
const ev = (f,a) => page.evaluate(f,a); const S = s => page.locator(s);
async function loginAs(name){ if (await S('#appView').isVisible()){ await ev(() => logout()); await page.waitForLoadState('load'); await page.waitForTimeout(250); }
  const v = await page.locator('#userInput option', {hasText:name}).first().getAttribute('value'); await S('#userInput').selectOption(v); await S('#pinInput').fill('1598'); await S('#localLogin button.primary').click(); await page.waitForTimeout(300); }
await page.goto(URL); await ev(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(400);
console.log('demo v:', await ev(() => window.INDIX_DEMO.v), 'subbills:', await ev(() => DB.subbills.map(s=>s.userId+':'+s.status).join(', ')));

// ===== 1. new project with xlsx (no Claude available) -> heuristic reader -> review -> import
await loginAs('סאמי'); await ev(() => navigate('projects'));
await page.getByRole('button',{name:'+ פרויקט חדש'}).click();
await S('#np_name').fill('תאורה — כפר מנדא'); await S('#np_client').fill('מועצה מקומית כפר מנדא'); await S('#np_lat').fill('32.81'); await S('#np_lng').fill('35.26');
await S('#np_boq').setInputFiles('/home/claude/e2e/boq-test.xlsx'); await S('#modal button.primary').click(); await page.waitForTimeout(1500);
const rev = await S('#modalContent h2').textContent().catch(()=>''); console.log('  review title:', rev);
const nRows = await S('.ai_ck').count(); if (nRows !== 7) bug('ai-xlsx', `expected 7 rows (6 + sheet 2), got ${nRows}`);
const first = await S('.ai_it').first().inputValue(); if (!first.includes('פירוק עמוד')) bug('ai-xlsx', 'first row: '+first);
await page.screenshot({path:'/home/claude/e2e/shots/v35-review.png'});
// edit a rate, then import
await S('.ai_sub').first().fill('260'); await page.getByRole('button',{name:'הכנס לכתב הכמויות'}).click(); await page.waitForTimeout(300);
const pid = await ev(() => DB.projects.find(p=>p.name==='תאורה — כפר מנדא').id);
const lines = await ev(p => projectBoq(p).map(b=>[b.item,b.type,b.qty,b.sale,b.sub]), pid); console.log('  imported:', lines.length, lines[0]);
if (lines.length !== 7 || lines[0][4] !== 260 || lines[0][1] !== 'remove') bug('ai-xlsx','import wrong');
if (!lines.some(l => l[0]==='מרכזיית תאורה חדשה' && l[1]==='cabinet')) bug('ai-xlsx','second sheet missing');
// engineer finds "פירוק עמודים" fast
await ev(() => { navigate('tasks'); openTaskForm(); }); await S('#tk_p').selectOption(String(pid)); await S('#tk_q').fill('פירוק עמוד'); await page.waitForTimeout(100);
const sg = await S('#tk_sug .sug-item:not(.sug-extra)').allTextContents(); console.log('  "פירוק עמוד" ->', sg.map(x=>x.slice(0,45)));
if (sg.length !== 1) bug('search','expected one match for פירוק עמוד');
await page.keyboard.press('Escape');

// ===== 2. photo with mocked Claude
await ev(() => { window.__mock = true; AI._s = Object.assign(async () => ({text:''}), {
  limits: async () => ({maxPromptBytes:262144, images:{maxCount:5, maxInputBytes:2e7, mediaTypes:['image/jpeg','image/png']}}),
  json: async (prompt, opt) => { window.__lastPrompt = prompt; window.__lastImgs = (opt.images||[]).length; return [{item:'פירוק עמוד בטון ישן',unit:'יח׳',qty:8,price:460,sub:240},{item:'התקנת גוף תאורה LED 60W',unit:'יח׳',qty:24,price:720,sub:null},{item:'סה"כ',unit:'',qty:0,price:0}]; } }); });
await ev(p => openAiBoq(p), pid); await S('#modal input[type=file]').setInputFiles('/home/claude/e2e/photo.png'); await page.waitForTimeout(1200);
const ph = await ev(() => ({imgs: window.__lastImgs, rows: document.querySelectorAll('.ai_ck').length, promptHe: (window.__lastPrompt||'').includes('כתב כמויות')}));
console.log('  photo via Claude:', ph); if (ph.imgs !== 1 || ph.rows !== 2 || !ph.promptHe) bug('ai-photo', JSON.stringify(ph));
await page.getByRole('button',{name:'הכנס לכתב הכמויות'}).click(); await page.waitForTimeout(200);
// photo without Claude -> clear note
await ev(() => { AI._s = null; AI.sample = async () => null; }); await ev(p => openAiBoq(p), pid); await S('#modal input[type=file]').setInputFiles('/home/claude/e2e/photo.png'); await page.waitForTimeout(800);
const note = await S('#modalContent .notice.warn').first().textContent().catch(()=>''); if (!note.includes('Claude')) bug('ai-photo','no fallback note: '+note); await page.keyboard.press('Escape');

// ===== 3. worker reports -> sees earnings
const t = await ev(p => { S.user = U(2); const b = projectBoq(p).find(b=>b.item.includes('פירוק עמוד תאורה')); openTaskForm(); $('tk_p').value=p; taskFormDeps(); tkPick(b.id); $('tk_qty').value='10'; $('tk_a').value = DB.users.find(u=>u.name.startsWith('מוחמד')).id; saveTask(); return DB.tasks[DB.tasks.length-1].id; }, pid);
await loginAs('מוחמד'); await ev(() => navigate('dashboard'));
const before = await ev(() => earnSummary(S.user.id, monthKey())); console.log('  worker month before:', before.approved, before.pending);
await ev(() => navigate('fieldAI')); await page.waitForTimeout(300);
await S('#rf_task').selectOption(String(t)); await S('#rf_qty').fill('4'); await S('.report-form input[type=file]').setInputFiles('/home/claude/e2e/photo.png'); await page.waitForTimeout(400);
await page.getByRole('button',{name:'שלח דיווח לאישור מהנדס'}).click(); await page.waitForTimeout(300);
const tt = await S('#toasts .toast').last().textContent(); console.log('  toast:', tt.slice(0,140));
if (!tt.includes('1,040') && !tt.includes('1040')) bug('earn','report toast should say 4×260=1,040 ₪');
await ev(() => navigate('dashboard')); await page.screenshot({path:'/home/claude/e2e/shots/v35-worker-earn.png', fullPage:true});
const card = await S('.earn').textContent().catch(()=>''); if (!card.includes('ממתין')) bug('earn','earnings card missing');
// ===== 4. engineer approves report + statement; CEO approves; paid
await loginAs('סאמי');
await ev(() => { const r = DB.reports.filter(r=>r.status==='pending' && r.userId===DB.users.find(u=>u.name.startsWith('מוחמד')).id).pop(); openApprove(r.id); });
await page.getByRole('button',{name:/✓ אשר/}).click(); await page.waitForTimeout(150);
const wid = await ev(() => DB.users.find(u=>u.name.startsWith('מוחמד')).id);
// engineer dashboard lists previous-month statements waiting (yousef/itai from October)
await ev(() => navigate('dashboard')); const waitEng = await ev(() => subsWaiting().length); console.log('  engineer waiting statements:', waitEng);
if (!waitEng) bug('flow','engineer does not see statements to approve');
await ev(([u]) => viewSub(u, monthKey()), [wid]); await page.screenshot({path:'/home/claude/e2e/shots/v35-statement.png'});
const aiPanel = await S('#modalContent .ai-panel').textContent(); if (!aiPanel.includes('בדיקת AI')) bug('flow','no AI check panel');
await page.getByRole('button',{name:'✓ אשר כמהנדס'}).click(); await page.waitForTimeout(150);
let st = await ev(([u]) => DB.subbills.filter(s=>s.userId===u && s.period===monthKey()).pop()?.status, [wid]); if (st !== 'אושר ע״י מהנדס') bug('flow','engineer step: '+st);
// CEO
await loginAs('Claude'); await ev(() => navigate('dashboard'));
const waitCeo = await ev(() => subsWaiting().length); console.log('  CEO waiting statements:', waitCeo); if (waitCeo < 2) bug('flow','CEO should see engineer-approved statements (incl. October)');
await ev(([u]) => viewSub(u, monthKey()), [wid]); await page.getByRole('button',{name:'✓ אשר לתשלום (מנכ״ל)'}).click(); await page.waitForTimeout(150);
st = await ev(([u]) => DB.subbills.filter(s=>s.userId===u && s.period===monthKey()).pop()?.status, [wid]); if (st !== 'אושר לתשלום') bug('flow','CEO step: '+st);
await ev(([u]) => { const sb = DB.subbills.filter(s=>s.userId===u && s.period===monthKey()).pop(); paySub(sb.id); }, [wid]);
st = await ev(([u]) => DB.subbills.filter(s=>s.userId===u && s.period===monthKey()).pop()?.status, [wid]); if (st !== 'שולם') bug('flow','pay: '+st);
// CEO cannot skip engineer for a draft
const skip = await ev(() => { const u = DB.users.find(u=>u.name.startsWith('יוסף')).id; approveSub(u, '2026-10'); return (DB.subbills.find(s=>s.userId===u && s.period==='2026-10')||{}).status || 'none'; });
console.log('  CEO on draft:', skip); if (skip !== 'none') bug('flow','CEO skipped engineer approval');
await ev(() => { S.filters.subPeriod = '2026-10'; navigate('billing'); }); await page.screenshot({path:'/home/claude/e2e/shots/v35-billing.png', fullPage:true});
// render all screens for all users (regression)
const res = await ev(() => { const out=[]; for (const u of DB.users){ S.user=u; S.filters={}; for (const k of ROLE_ACCESS[u.role]) { try { navigate(k); } catch(e){ out.push(u.role+'/'+k+': '+e.message); } } try { if (['worker','contractor'].includes(u.role)) viewSub(u.id, monthKey()); closeModal(); } catch(e){ out.push('viewSub '+e.message);} } return out; });
res.forEach(x => bug('render', x));
console.log('\nERRORS:', errors.length ? errors : 'none'); console.log('FINDINGS:', findings.length ? findings : 'none');
await b.close();

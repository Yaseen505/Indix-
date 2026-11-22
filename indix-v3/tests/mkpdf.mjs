// Builds a realistic Hebrew BOQ PDF (multi-page, repeated header, wrapped descriptions)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const items = [];
const base = [
  ['פירוק עמוד תאורה קיים כולל יסוד ופינוי לאתר מורשה', "יח'", 40, 450],
  ['חפירה ידנית או בכלים מכניים לתעלה לכבלים בעומק עד 1.0 מ\' ורוחב 40 ס"מ כולל מילוי חוזר והידוק', "מ'", 1800, 48],
  ['העמדת עמוד תאורה בגובה 8 מ\'', "יח'", 120, 1500],
  ['התקנת גוף תאורה לד 60W', "יח'", 120, 900],
  ['השחלת כבל 5x25 ממ"ר אלומיניום בצנרת קיימת', "מ'", 2600, 78],
  ['מרכזיית תאורה כולל יסוד ומונה', "קומפ'", 2, 21000],
];
for (let i = 0; i < 70; i++){ const b = base[i % base.length]; items.push([`08.0${1+Math.floor(i/10)}.${String(10+i).padStart(4,'0')}`, i < base.length ? b[0] : b[0] + ' — קטע ' + (i+1), b[1], b[2] + i, b[3]]); }
const rows = items.map(r => `<tr><td>${r[0]}</td><td class="d">${r[1]}</td><td>${r[2]}</td><td>${r[3].toLocaleString('en-US')}</td><td>${r[4].toLocaleString('en-US',{minimumFractionDigits:2})}</td><td>${(r[3]*r[4]).toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>`).join('');
const html = `<html dir="rtl" lang="he"><head><meta charset="utf-8"><style>body{font-family:'DejaVu Sans',sans-serif;font-size:11px} table{border-collapse:collapse;width:100%} td,th{border:1px solid #999;padding:3px} td.d{width:45%} thead{display:table-header-group}</style></head>
<body><h2>כתב כמויות — תאורת רחובות קרית גת</h2><p>פרק 08 — מתקני חשמל ותאורה</p>
<table><thead><tr><th>מס' סעיף</th><th>תיאור</th><th>יח'</th><th>כמות</th><th>מחיר יחידה</th><th>סה"כ</th></tr></thead><tbody>${rows}</tbody></table>
<p>סה"כ לפרק 08: ${items.reduce((a,r)=>a+r[3]*r[4],0).toLocaleString('en-US')}</p></body></html>`;
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
const p = await b.newPage(); await p.setContent(html); await p.pdf({path:'/home/claude/e2e/boq-kiryat-gat.pdf', format:'A4', margin:{top:'15mm',bottom:'15mm',left:'10mm',right:'10mm'}});
await b.close(); console.log('items', items.length);

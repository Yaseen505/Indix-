"use strict";
/* =========================================================================
   INDIX — AI שקורא כתב כמויות (צילום / אקסל / CSV) והופך אותו לסעיפים
   - בגרסה שמחוברת ל-Claude: צילום נקרא בראייה ממוחשבת, אקסל מנותח ומסודר ע״י Claude.
   - בלי חיבור: אקסל ו-CSV נקראים ישירות בדפדפן (זיהוי עמודות לפי הכותרות).
   ========================================================================= */
const AI = {
  _s: null,
  async sample(){
    if (this._s !== null) return this._s;
    try { this._s = (window.claude && window.claude.use) ? await window.claude.use("sample") : null; } catch(e){ this._s = null; }
    return this._s;
  },
  async canImages(){ const s = await this.sample(); if (!s) return false; try { return !!(await s.limits()).images; } catch(e){ return false; } }
};
// טעינה מוקדמת (לא חוסם)
setTimeout(() => AI.sample(), 0);

/* ---------- קריאת קובץ אקסל (xlsx) בדפדפן, בלי ספריות ---------- */
async function unzipEntries(buf){
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = -1; for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  if (eocd < 0) throw new Error("קובץ אקסל לא תקין");
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true); const out = {};
  for (let i = 0; i < n; i++){
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
    out[name] = {method, csize, off}; p += 46 + nlen + xlen + clen;
  }
  out._read = async name => {
    const e = out[name]; if (!e) return null;
    const lh = e.off, start = lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true), data = u8.subarray(start, start + e.csize);
    if (e.method === 0) return new TextDecoder().decode(data);
    const ds = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(ds).text();
  };
  return out;
}
async function xlsxToRows(file){
  const z = await unzipEntries(await file.arrayBuffer());
  const xml = s => new DOMParser().parseFromString(s, "application/xml");
  const ssTxt = await z._read("xl/sharedStrings.xml"), ss = [];
  if (ssTxt) xml(ssTxt).querySelectorAll("si").forEach(si => ss.push([...si.querySelectorAll("t")].map(t => t.textContent).join("")));
  const sheets = Object.keys(z).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((a,b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
  const all = [];
  for (const sh of sheets){
    const rows = [], d = xml(await z._read(sh));
    d.querySelectorAll("sheetData row").forEach(r => {
      const row = [];
      r.querySelectorAll("c").forEach(c => {
        const ref = c.getAttribute("r") || "", col = ref.replace(/\d+/g, "").split("").reduce((a,ch) => a*26 + ch.charCodeAt(0) - 64, 0) - 1;
        const t = c.getAttribute("t"), v = c.querySelector("v")?.textContent ?? c.querySelector("is t")?.textContent ?? "";
        row[col >= 0 ? col : row.length] = t === "s" ? (ss[+v] ?? "") : v;
      });
      if (row.some(x => String(x ?? "").trim())) rows.push(Array.from(row, x => x ?? ""));
    });
    if (rows.length) all.push(rows);
  }
  return all; // גיליון = מערך שורות
}

/* ---------- קריאת PDF בדפדפן (pdf.js, נטען רק כשצריך) ---------- */
let _pdfjs = null;
async function pdfLib(){
  if (_pdfjs) return _pdfjs;
  const base = new URL("vendor/pdfjs/", document.baseURI).href;
  const lib = await import(base + "pdf.min.mjs");
  lib.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.mjs";
  return (_pdfjs = lib);
}
const PDF_HEAD = {item:/תיאור|פירוט|פריט|עבודה|description|item/i, qty:/כמות|qty|quantity/i};
const isNumCell = t => /^[\d,.\s₪-]+$/.test(t) && /\d/.test(t);
const isUnitTxt = t => /^(יח|מ['׳"״]?|מ"[אקר]|מ״[אקר]|מטר|קומפ|קומפלט|טון|ק"ג|ק״ג|ליטר|יום|שעה|קמ|unit|pcs|m|m2|m3|ls)['׳.]*$/i.test(t.replace(/\s+/g,""));
/* הופך PDF לטבלה (תיאור | יחידה | כמות | מחיר | סה״כ). עובד גם כשהתיאור נשבר לכמה שורות ומיושר למעלה/אמצע/למטה.
   מחזיר {sheets, chars, pages, doc} */
async function pdfToSheets(file, onStatus = () => {}){
  const lib = await pdfLib();
  const doc = await lib.getDocument({data: new Uint8Array(await file.arrayBuffer()), isEvalSupported:false}).promise;
  let chars = 0, numOrder = null; const out = [["תיאור","יחידה","כמות","מחיר","סה\"כ"]];
  for (let pn = 1; pn <= doc.numPages; pn++){
    if (pn % 5 === 1) onStatus(`קורא את ${file.name} — עמוד ${pn} מתוך ${doc.numPages}…`);
    const page = await doc.getPage(pn), tc = await page.getTextContent();
    const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({t:i.str.trim(), x0:i.transform[4], x1:i.transform[4] + (i.width || i.str.length*4), y:i.transform[5], h:Math.abs(i.transform[3]) || 8}));
    items.forEach(i => chars += i.t.length);
    if (!items.length) continue;
    // שורות לפי גובה
    items.sort((a,b) => b.y - a.y);
    const lines = [];
    items.forEach(i => { const L = lines.find(l => Math.abs(l.y - i.y) <= Math.max(2, i.h*0.3)); if (L) L.items.push(i); else lines.push({y:i.y, h:i.h, items:[i]}); });
    lines.sort((a,b) => b.y - a.y); lines.forEach(L => L.items.sort((a,b) => b.x1 - a.x1)); // מימין לשמאל
    // כותרת הטבלה: קובעת את סדר עמודות המספרים (כמות / מחיר / סה״כ)
    const txt = L => L.items.map(i => i.t).join(" ");
    const hi = lines.findIndex(L => PDF_HEAD.qty.test(txt(L)) && PDF_HEAD.item.test(txt(L)));
    let body = lines;
    if (hi >= 0){
      const H = lines[hi], qx = H.items.find(i => PDF_HEAD.qty.test(i.t));
      // כותרות שנשברו לשתי שורות (למשל "מחיר / יחידה") — אוספים את כל הטקסט סביב שורת הכותרת
      const near = lines.filter(L => Math.abs(L.y - H.y) <= H.h*1.7).flatMap(L => L.items).filter(i => !isNumCell(i.t));
      const left = near.filter(i => qx && i.x1 <= qx.x1 + 1).sort((a,b) => b.x1 - a.x1); // הכמות ומה שמשמאלה
      const names = []; left.forEach(i => { const last = names.find(n => Math.min(n.x1, i.x1) - Math.max(n.x0, i.x0) > -2); if (last){ last.t = last.t + " " + i.t; last.x0 = Math.min(last.x0, i.x0); last.x1 = Math.max(last.x1, i.x1); } else names.push({...i}); });
      names.sort((a,b) => b.x1 - a.x1);
      body = lines.filter(L => L.y < H.y - H.h*1.7);
      numOrder = names.map(n => /כמות|qty/i.test(n.t) ? "qty" : /סה.?כ|total|סכום/i.test(n.t) ? "total" : /מחיר|תעריף|price|rate/i.test(n.t) ? "price" : /יח|unit/i.test(n.t) ? null : "other").filter(Boolean);
    }
    const order = numOrder || ["qty","price","total"];
    // אזור התיאור: טקסט עברי/לועזי ארוך
    const descItems = body.flatMap(L => L.items).filter(i => !isNumCell(i.t) && !isUnitTxt(i.t) && i.t.length > 6);
    if (!descItems.length) continue;
    const xs0 = descItems.map(i => i.x0).sort((a,b)=>a-b), xs1 = descItems.map(i => i.x1).sort((a,b)=>a-b);
    const R = xs1[Math.floor(xs1.length*0.9)] + 3, Lx = xs0[Math.floor(xs0.length*0.05)] - 3; // גבולות (בלי חריגים)
    // ניתוח כל שורה
    const parsed = body.map(L => {
      const d = [], nums = [], units = [], no = [];
      L.items.forEach(i => {
        const cx = (i.x0 + i.x1)/2;
        if (cx > R) no.push(i.t);
        else if (cx >= Lx && !(isUnitTxt(i.t) && i.x1 < Lx + 40)) d.push(i.t);
        else if (isNumCell(i.t)) nums.push(parseFloat(i.t.replace(/[₪,\s]/g, "")));
        else if (isUnitTxt(i.t) || i.t.length <= 6) units.push(i.t);
        else d.push(i.t);
      });
      return {y:L.y, h:L.h, desc:d.join(" ").trim(), nums, unit:units.join(" "), no:no.join(" ")};
    }).filter(r => r.desc || r.nums.length);
    // שורות עוגן = שורות עם מספרים. שורות תיאור בלבד מצטרפות לעוגן הקרוב
    const anchors = parsed.filter(r => r.nums.length >= 2);
    anchors.forEach(a => a.parts = a.desc ? [{y:a.y, t:a.desc}] : []);
    parsed.filter(r => r.nums.length < 2 && r.desc).forEach(r => {
      if (/^(סה.?כ|total|פרק|תת.?פרק)/i.test(r.desc)) return;
      let best = null, bd = 1e9; anchors.forEach(a => { const dy = Math.abs(a.y - r.y); if (dy < bd){ bd = dy; best = a; } });
      if (best && bd <= Math.max(best.h, r.h) * 2.6) best.parts.push({y:r.y, t:r.desc});
    });
    anchors.forEach(a => {
      const desc = a.parts.sort((x,y) => y.y - x.y).map(p => p.t).join(" ").replace(/\s+/g, " ").trim();
      const v = {}; order.forEach((k, j) => { if (a.nums[j] != null && v[k] == null) v[k] = a.nums[j]; });
      if (v.qty != null && v.price != null && v.total != null && Math.abs(v.qty*v.price - v.total) > Math.max(1, v.total*0.01) && Math.abs(v.price*v.total) > 0){
        // סדר לא צפוי — מנסה למצוא שלישייה שמתאימה (כמות × מחיר = סה״כ)
        const n = a.nums; for (let i=0;i<n.length;i++) for (let j=0;j<n.length;j++) for (let k=0;k<n.length;k++) if (i!==j&&j!==k&&i!==k && Math.abs(n[i]*n[j]-n[k]) <= Math.max(1,n[k]*0.005)){ v.qty=n[i]; v.price=n[j]; v.total=n[k]; i=j=k=99; }
      }
      out.push([desc, a.unit, v.qty ?? "", v.price ?? "", v.total ?? ""]);
    });
  }
  return {sheets: out.length > 1 ? [out] : [], chars, pages: doc.numPages, doc};
}
/* PDF סרוק (בלי טקסט): הופך עמודים לתמונות כדי ש-Claude יקרא */
async function pdfPagesToImages(doc, max = 5){
  const out = [];
  for (let pn = 1; pn <= Math.min(doc.numPages, max); pn++){
    const page = await doc.getPage(pn), vp = page.getViewport({scale:1.6}), cv = document.createElement("canvas");
    cv.width = vp.width; cv.height = vp.height; await page.render({canvasContext:cv.getContext("2d"), viewport:vp}).promise;
    out.push(await new Promise(r => cv.toBlob(r, "image/jpeg", 0.85)));
  }
  return out;
}

/* ---------- זיהוי עמודות לפי כותרות (בלי AI) ---------- */
function rowsToBoq(rows){
  const H = {item:/תיאור|סעיף|פריט|עבודה|description|item/i, unit:/^יח|יחיד|unit/i, qty:/כמות|qty|quantity/i, sale:/מחיר|תעריף|price|rate/i, cost:/עלות|cost/i, sub:/קבלן|ביצוע|sub/i};
  let hi = rows.findIndex(r => r.some(c => H.qty.test(String(c))) && r.some(c => H.item.test(String(c))));
  let map = {item:0, unit:1, qty:2, sale:3, cost:4, sub:5};
  if (hi >= 0){
    map = {}; rows[hi].forEach((c, i) => { const s = String(c).trim(); for (const k of ["sub","cost","qty","unit","sale","item"]) if (map[k] == null && H[k].test(s) && !/סה.?כ|total/i.test(s) && !(k==="item" && /מס['׳]?|מספר|קוד|^no\.?$|#/i.test(s))){ map[k] = i; break; } });
    const di = rows[hi].findIndex(c => /תיאור|description/i.test(String(c))); if (di >= 0) map.item = di; // עמודת התיאור עדיפה
    if (map.item == null) map.item = rows[hi].findIndex(c => String(c).trim());
  }
  const num_ = v => parseFloat(String(v ?? "").replace(/[₪,\s]/g, ""));
  return rows.slice(hi + 1).map(r => ({item:String(r[map.item] ?? "").trim(), unit:String(r[map.unit] ?? "").trim() || "יח׳", qty:num_(r[map.qty]), sale:num_(r[map.sale]) || 0, cost:num_(r[map.cost]) || 0, sub:map.sub != null && !isNaN(num_(r[map.sub])) ? num_(r[map.sub]) : null}))
    .filter(x => x.item && x.qty > 0 && !/סה.?כ|total/i.test(x.item));
}

/* ---------- Claude: קריאת צילום או טבלה ---------- */
const BOQ_PROMPT = `אתה קורא כתב כמויות (Bill of Quantities) של חברת תשתיות חשמל, תאורת רחוב ורמזורים בישראל.
חלץ את כל הסעיפים שיש בהם כמות. דלג על כותרות, סיכומים (סה"כ), פרקים ושורות ריקות. אל תמציא סעיפים ואל תשנה מספרים.
החזר JSON בלבד: מערך של אובייקטים {"item": תיאור הסעיף המלא בעברית כפי שכתוב, "unit": יחידה (יח׳/מ׳/מ"ר/קומפלט...), "qty": כמות (מספר), "price": מחיר ליחידה (מספר או 0 אם אין), "sub": מחיר לקבלן ליחידה אם מופיע אחרת null}.
דוגמה: [{"item":"פירוק עמוד תאורה קיים כולל יסוד","unit":"יח׳","qty":12,"price":450,"sub":null}]`;
function aiRowsNorm(arr){
  return (Array.isArray(arr) ? arr : arr?.items || []).map(x => ({item:String(x.item||"").trim(), unit:String(x.unit||"יח׳").trim(), qty:+x.qty || 0, sale:+(x.price ?? x.sale) || 0, cost:0, sub:x.sub == null || x.sub === "" ? null : +x.sub}))
    .filter(x => x.item && x.qty > 0);
}
async function imageBlob(file){
  if (!file.type.startsWith("image/")) return file;
  const r = await readImage(file, 1800); return await (await fetch(r.data)).blob();
}

/* קורא קבצים ומחזיר {rows, via, note} */
async function aiReadBoqFiles(files, onStatus = () => {}){
  files = [...files]; const imgs = files.filter(f => f.type.startsWith("image/")), others = files.filter(f => !f.type.startsWith("image/"));
  let rows = [], via = [], notes = [];
  const sample = await AI.sample();
  for (const f of others){
    let sheets = null;
    if (/\.xlsx$/i.test(f.name)){ onStatus(`קורא את ${f.name}…`); sheets = await xlsxToRows(f); }
    else if (/\.(csv|txt|tsv)$/i.test(f.name)){ const t = await f.text(); sheets = [t.split(/\r?\n/).filter(l => l.trim()).map(l => l.includes("\t") ? l.split("\t") : l.split(/[,;](?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, "")))]; }
    else if (/\.pdf$/i.test(f.name) || f.type === "application/pdf"){
      onStatus(`פותח את ${f.name}…`);
      let r; try { r = await pdfToSheets(f, onStatus); } catch(e){ notes.push(`${f.name}: לא הצלחתי לפתוח את ה-PDF (${e.message || e}). אפשר לייצא אותו לאקסל ולצרף שוב.`); continue; }
      if (r.chars < 40){ // PDF סרוק
        if (sample && await AI.canImages()){
          onStatus(`🤖 Claude קורא PDF סרוק (${Math.min(r.pages,5)} עמודים)…`);
          try { rows.push(...aiRowsNorm(await sample.json(BOQ_PROMPT + "\n\nמצורפים עמודים מ-PDF סרוק של כתב הכמויות, לפי הסדר.", {images: await pdfPagesToImages(r.doc), modelTier:"default"}))); via.push("PDF סרוק + AI"); }
          catch(e){ notes.push(`${f.name}: קריאת ה-PDF הסרוק נכשלה — צרף קובץ אקסל או צילומים חדים`); }
        } else notes.push(`${f.name}: ה-PDF סרוק (תמונה בלי טקסט). צרף את קובץ האקסל המקורי או צילומים של הדפים. הקובץ נשמר במסמכים.`);
        continue;
      }
      sheets = r.sheets; via.push(`PDF (${r.pages} עמ׳)`);
      if (!sheets.length || !sheets[0].length){ notes.push(`${f.name}: לא נמצאה טבלה ב-PDF`); continue; }
    }
    else { notes.push(`${f.name}: ${/\.xls$/i.test(f.name) ? "פורמט אקסל ישן (xls) — פתח באקסל ושמור כ-xlsx או CSV" : "סוג קובץ לא נתמך לקריאה"}. הקובץ נשמר במסמכים.`); continue; }
    const heur = sheets.flatMap(t => rowsToBoq(t));
    if (heur.length >= 3){ rows.push(...heur); via.push("טבלה"); continue; } // טבלה ברורה — נקראת כולה, גם כתב כמויות של אלפי סעיפים
    if (sample && sheets.length){
      onStatus("🤖 Claude מסדר את הטבלה…");
      try { const tsv = sheets.map((t,i) => `--- גיליון ${i+1} ---\n` + t.slice(0, 600).map(r => r.join("\t")).join("\n")).join("\n").slice(0, 120000);
        const got = aiRowsNorm(await sample.json(BOQ_PROMPT + "\n\nהטבלה (עמודות מופרדות בטאב):\n" + tsv, {modelTier:"default"}));
        if (got.length){ rows.push(...got); via.push("AI"); continue; } } catch(e){ if (e?.code === "not_granted") AI._s = null; }
    }
    sheets.forEach(t => rows.push(...rowsToBoq(t))); via.push("טבלה");
  }
  if (imgs.length){
    if (sample && await AI.canImages()){
      onStatus(`🤖 Claude קורא ${imgs.length} צילומים… (עד דקה)`);
      try {
        const lim = (await sample.limits()).images, blobs = [];
        for (const f of imgs.slice(0, lim.maxCount || 5)) blobs.push(await imageBlob(f));
        rows.push(...aiRowsNorm(await sample.json(BOQ_PROMPT + `\n\nמצורפים ${blobs.length} צילומים של דפי כתב הכמויות, לפי הסדר.`, {images:blobs, modelTier:"default"})));
        via.push("צילום + AI");
      } catch(e){ notes.push(e?.code === "not_granted" ? "לא אושר שימוש ב-Claude — הצילום נשמר, הזן את הסעיפים ידנית" : "קריאת הצילום נכשלה — נסה צילום חד וישר יותר, או קובץ אקסל"); }
    } else notes.push("קריאת צילום ב-AI זמינה בגרסה שמחוברת ל-Claude. הצילום נשמר במסמכים — אפשר לצרף גם קובץ אקסל/CSV.");
  }
  return {rows, via:[...new Set(via)], notes};
}

/* ---------- מסך בדיקה לפני הכנסה לכתב הכמויות ---------- */
function boqReviewModal(pid, res){
  const pj = P(pid), cid = pj?.contractorId;
  res.rows.forEach(r => { if ((r.sub == null || r.sub === "") && cid){ const x = cpriceFind(cid, r.item); if (x){ r.sub = x.price; r.fromList = true; } } });
  S.draft.aiBoq = {pid, rows:res.rows};
  const exists = new Set(projectBoq(pid).map(b => b.item));
  openModal(`<h2>🤖 ${res.rows.length ? `זוהו ${res.rows.length} סעיפים` : "לא זוהו סעיפים"} — ${pname(pid)}</h2>
   ${res.via.length ? `<p class="muted">נקרא באמצעות: ${esc(res.via.join(", "))}. בדוק, תקן אם צריך, ולחץ "הכנס לכתב הכמויות". מכאן המהנדס ימצא כל סעיף במשימות לפי מילה (למשל "פירוק").</p>` : ""}
   ${res.notes.map(n => `<p class="notice warn">${esc(n)}</p>`).join("")}
   ${res.rows.length ? `<div class="table-wrap"><table class="mini"><thead><tr><th>✓</th><th>סעיף</th><th>סוג</th><th>יח׳</th><th>כמות</th><th>מחיר ללקוח</th><th>${cid ? `מחיר קבלן (${esc(uname(cid))}) *` : "מחיר לביצוע (עובד/קבלן)"}</th>${cid ? "<th>הרווח שלך ליח׳</th>" : ""}</tr></thead><tbody>
   ${res.rows.map((r,i) => `<tr${exists.has(r.item)?' class="muted"':""}><td><input type="checkbox" class="ai_ck" data-i="${i}" ${exists.has(r.item)?"":"checked"}></td>
     <td><input class="ai_it" data-i="${i}" value="${esc(r.item)}">${exists.has(r.item)?'<small class="muted">כבר קיים</small>':""}</td><td><small>${esc(WORK[guessType(r.item)].name)}</small></td>
     <td><input class="ai_un" data-i="${i}" value="${esc(r.unit)}" style="width:60px"></td><td><input class="ai_q" data-i="${i}" type="number" step="any" value="${r.qty}" style="width:80px"></td>
     <td><input class="ai_s" data-i="${i}" type="number" step="any" value="${r.sale||""}" style="width:90px" oninput="aiRowProfit(${i})"></td><td><input class="ai_sub" data-i="${i}" type="number" step="any" value="${r.sub ?? ""}" style="width:90px" placeholder="להשלים" oninput="aiRowProfit(${i})">${r.fromList?' <span title="מולא מהמחירון השמור של הקבלן">★</span>':""}</td>${cid ? `<td class="ai_pr" data-i="${i}"></td>` : ""}</tr>`).join("")}</tbody></table></div>
   ${cid ? `<p class="muted">הנחת חוזה ${num(pj.discountPct||0)}% · רווח קבלן ראשי ${num(pj.mainPct||0)}% · ★ = מחיר שנשמר לקבלן בעבר. אפשר להכניס עכשיו ולהשלים מחירים חסרים במסך "💲 מחירי קבלן".</p>` : ""}
   <button class="primary full" onclick="saveAiBoq()">הכנס לכתב הכמויות</button>` : `<p>אפשר להדביק את הטבלה ידנית: <button onclick="openBoqImport(${pid})">📋 ייבוא מאקסל</button></p>`}`, true);
  if (cid) res.rows.forEach((r, i) => aiRowProfit(i));
}
function aiRowProfit(i){
  const pid = S.draft.aiBoq?.pid, pj = P(pid); if (!pj?.contractorId) return;
  const cell = document.querySelector(`.ai_pr[data-i="${i}"]`); if (!cell) return;
  const sale = +document.querySelector(`.ai_s[data-i="${i}"]`).value || 0, sv = document.querySelector(`.ai_sub[data-i="${i}"]`).value;
  if (sv === ""){ cell.innerHTML = `<small class="danger-text">חסר</small>`; return; }
  const u = r2(netUnit(sale, pj) - +sv); cell.innerHTML = `<b class="${u<0?"danger-text":"success-text"}">${money2(u)}</b>`;
}
function saveAiBoq(){
  if (!guard("editBoq")) return;
  const {pid, rows} = S.draft.aiBoq || {}; if (!pid) return;
  const get = (cls, i) => document.querySelector(`.${cls}[data-i="${i}"]`);
  let n = 0;
  rows.forEach((r, i) => {
    if (!get("ai_ck", i)?.checked) return;
    const item = get("ai_it", i).value.trim(), qty = +get("ai_q", i).value, sale = +get("ai_s", i).value || 0, subV = get("ai_sub", i).value;
    if (!item || !(qty > 0)) return;
    DB.boq.push({id:nid(), projectId:+pid, type:guessType(item), item, unit:get("ai_un", i).value.trim() || "יח׳", qty, base:0, sale, cost:Math.round(sale*0.75*100)/100, sub:subV === "" ? null : +subV, src:"ai"}); n++;
  });
  if (!req(n, "לא נבחרו סעיפים")) return;
  audit("כתב כמויות נקרא ע״י AI", `${P(pid)?.name}: ${n} סעיפים`);
  afterBoqAdded(pid, `${n} סעיפים נכנסו לכתב הכמויות`);
}
async function aiReadBoq(pid, files){
  if (!guard("editBoq")) return;
  if (!files || !files.length) return;
  openModal(`<h2>🤖 קורא את כתב הכמויות…</h2><p id="ai_st" class="muted">מתחיל…</p><div class="spinner"></div>`);
  try { const res = await aiReadBoqFiles(files, t => { const e = $("ai_st"); if (e) e.textContent = t; }); boqReviewModal(pid, res); }
  catch(e){ closeModal(); toast("קריאת הקובץ נכשלה: " + (e.message || e.code || e), "danger"); }
}
function openAiBoq(pid){
  if (!guard("editBoq")) return;
  openModal(`<h2>🤖 קריאת כתב כמויות — ${pname(pid)}</h2>
   <p class="muted">צרף צילומים של דפי כתב הכמויות, או קובץ אקסל (xlsx) / CSV. ה-AI יקרא את כל הסעיפים — כמות, יחידה ומחיר — ותוכל לבדוק אותם לפני ההכנסה.</p>
   <label class="file-btn">📷 צלם / בחר קבצים<input type="file" multiple accept="image/*,.xlsx,.csv,.txt,.pdf,.xls" hidden onchange="aiReadBoq(${pid}, this.files)"></label>`);
}
/* קריאה של מסמך "כתב כמויות" שכבר נשמר */
async function aiReadBoqDoc(id){
  const d = DB.docs.find(x => x.id===id); if (!d?.data) return toast("הקובץ לא נשמר במלואו — צרף אותו שוב","danger");
  const blob = await (await fetch(d.data)).blob(); const f = new File([blob], d.name, {type:blob.type});
  aiReadBoq(d.projectId, [f]);
}

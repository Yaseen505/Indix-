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

/* ---------- זיהוי עמודות לפי כותרות (בלי AI) ---------- */
function rowsToBoq(rows){
  const H = {item:/תיאור|סעיף|פריט|עבודה|description|item/i, unit:/^יח|יחיד|unit/i, qty:/כמות|qty|quantity/i, sale:/מחיר|תעריף|price|rate/i, cost:/עלות|cost/i, sub:/קבלן|ביצוע|sub/i};
  let hi = rows.findIndex(r => r.some(c => H.qty.test(String(c))) && r.some(c => H.item.test(String(c))));
  let map = {item:0, unit:1, qty:2, sale:3, cost:4, sub:5};
  if (hi >= 0){
    map = {}; rows[hi].forEach((c, i) => { const s = String(c).trim(); for (const k of ["sub","cost","qty","unit","sale","item"]) if (map[k] == null && H[k].test(s) && !/סה.?כ|total/i.test(s)){ map[k] = i; break; } });
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
    else { notes.push(`${f.name}: ${/\.pdf$/i.test(f.name) ? "קובץ PDF — צלם את הדפים או ייצא לאקסל כדי שה-AI יקרא אותו" : /\.xls$/i.test(f.name) ? "פורמט אקסל ישן (xls) — שמור כ-xlsx או CSV" : "סוג קובץ לא נתמך לקריאה"}. הקובץ נשמר במסמכים.`); continue; }
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
  S.draft.aiBoq = {pid, rows:res.rows};
  const exists = new Set(projectBoq(pid).map(b => b.item));
  openModal(`<h2>🤖 ${res.rows.length ? `זוהו ${res.rows.length} סעיפים` : "לא זוהו סעיפים"} — ${pname(pid)}</h2>
   ${res.via.length ? `<p class="muted">נקרא באמצעות: ${esc(res.via.join(", "))}. בדוק, תקן אם צריך, ולחץ "הכנס לכתב הכמויות". מכאן המהנדס ימצא כל סעיף במשימות לפי מילה (למשל "פירוק").</p>` : ""}
   ${res.notes.map(n => `<p class="notice warn">${esc(n)}</p>`).join("")}
   ${res.rows.length ? `<div class="table-wrap"><table class="mini"><thead><tr><th>✓</th><th>סעיף</th><th>סוג</th><th>יח׳</th><th>כמות</th><th>מחיר ללקוח</th><th>מחיר לביצוע (עובד/קבלן)</th></tr></thead><tbody>
   ${res.rows.map((r,i) => `<tr${exists.has(r.item)?' class="muted"':""}><td><input type="checkbox" class="ai_ck" data-i="${i}" ${exists.has(r.item)?"":"checked"}></td>
     <td><input class="ai_it" data-i="${i}" value="${esc(r.item)}">${exists.has(r.item)?'<small class="muted">כבר קיים</small>':""}</td><td><small>${esc(WORK[guessType(r.item)].name)}</small></td>
     <td><input class="ai_un" data-i="${i}" value="${esc(r.unit)}" style="width:60px"></td><td><input class="ai_q" data-i="${i}" type="number" step="any" value="${r.qty}" style="width:80px"></td>
     <td><input class="ai_s" data-i="${i}" type="number" step="any" value="${r.sale||""}" style="width:90px"></td><td><input class="ai_sub" data-i="${i}" type="number" step="any" value="${r.sub ?? ""}" style="width:90px" placeholder="להשלים"></td></tr>`).join("")}</tbody></table></div>
   <button class="primary full" onclick="saveAiBoq()">הכנס לכתב הכמויות</button>` : `<p>אפשר להדביק את הטבלה ידנית: <button onclick="openBoqImport(${pid})">📋 ייבוא מאקסל</button></p>`}`, true);
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
  closeModal(); S.filters.project = String(pid); save(); go("boq"); toast(`${n} סעיפים נכנסו לכתב הכמויות — המהנדס ימצא אותם במשימות לפי מילה`);
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

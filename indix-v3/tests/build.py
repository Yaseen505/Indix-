# Build the artifact (demo, local-mode) folder from the repo source
import shutil, os, re, sys
src = "/home/claude/Indix-/indix-v3"; out = sys.argv[1] if len(sys.argv)>1 else "/home/claude/e2e/app"
shutil.rmtree(out, ignore_errors=True); os.makedirs(out+"/js")
for f in ["styles.css"]: shutil.copy(f"{src}/{f}", out)
for f in os.listdir(f"{src}/js"): shutil.copy(f"{src}/js/{f}", out+"/js")
h = open(f"{src}/index.html", encoding="utf8").read()
shim = '''<script>
/* תצוגה מקדימה: אחסון וחלונות אישור מותאמים לסביבת התצוגה */
(function(){
  try{ localStorage.setItem("__t","1"); localStorage.removeItem("__t"); }
  catch(e){ var m={}; var mem={getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m={}}};
    try{ Object.defineProperty(window,"localStorage",{value:mem,configurable:true}); }catch(_){ } }
  window.confirm=function(){return true}; window.prompt=function(m,d){return d||"נדחה"};
})();
</script>
'''
h = h.replace("</head>", shim + "\n</head>")
h = h.replace('<div class="brand">INDIX</div>', '<div class="brand">INDIX</div>\n      <p class="notice warn">גרסת הדגמה לניסיון — הנתונים נשמרים רק במכשיר הזה. הגרסה המחוברת לענן תעלה ב-Netlify.</p>', 1)
h = h.replace('  <script src="config.js"></script>\n','').replace('  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n','')
if os.path.exists(f"{src}/js/demo-data.js") and 'demo-data.js' not in h:
    h = h.replace('<script src="js/core.js"></script>', '<script src="js/demo-data.js"></script>\n  <script src="js/core.js"></script>')
open(out+"/index.html","w",encoding="utf8").write(h)
print("built", out)

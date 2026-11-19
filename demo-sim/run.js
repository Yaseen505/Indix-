// Runs INDIX core.js + simulation in a VM with a simulated clock. Usage: TZ=Asia/Jerusalem node run.js <indix-v3 dir> <out.json>
const fs = require("fs"), vm = require("vm"), path = require("path");
const dir = process.argv[2], outFile = process.argv[3];
const RealDate = Date;
let SIM = RealDate.now();
class SimDate extends RealDate {
  constructor(...a){ if (a.length === 0) super(SIM); else super(...a); }
  static now(){ return SIM; }
}
const out = {};
const ctx = {
  Date: SimDate, __RealDate: RealDate, __out: out, console, Intl, Math, JSON,
  __setSim(date, hh, mm){ SIM = new RealDate(`${date}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00`).getTime(); },
  document: { getElementById: () => null }, localStorage: { getItem: () => null, setItem(){} }, window: {}, navigator: {}
};
vm.createContext(ctx);
const actions = fs.readFileSync(path.join(dir, "js/actions.js"), "utf8");
const checkReq = actions.slice(actions.indexOf("function checkRequest("), actions.indexOf("function openRequest("));
const src = fs.readFileSync(path.join(dir, "js/core.js"), "utf8") + "\n;\n" + checkReq + "\n" + fs.readFileSync(path.join(__dirname, "sim-body.js"), "utf8");
vm.runInContext(src, ctx, { filename: "sim.js" });
fs.writeFileSync(outFile, JSON.stringify(out.db));
console.log(JSON.stringify(out.sum, null, 1));

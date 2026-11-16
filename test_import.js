/* 真实装箱单导入测试（乌干达段B包，北京海仕明）
 * 语义校验：数量=零件数 vs 包装件数=包装数（应以包装为单位）
 * 重量：优先总毛量分摊到包装
 */
"use strict";
const fs = require("fs");
const XLSX = require("./lib/xlsx.full.min.js");
const ImportLib = require("./lib/importer.js");
const PackLib = require("./lib/pack.js");

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ✅ " + name + (detail ? "  " + detail : "")); }
  else { fail++; console.log("  ❌ " + name + (detail ? "  " + detail : "")); }
}

const wb = XLSX.read(fs.readFileSync("testdata/uganda.xlsx"), { type: "buffer" });
const PALETTE = ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16","#f97316","#6366f1","#14b8a6","#a855f7"];
let goods = [], seq = 0;
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" });
  const r = ImportLib.rowsToGoods(rows, PALETTE, seq);
  goods = goods.concat(r.goods); seq = r.seq;
}

console.log("[真实装箱单] 乌干达段B包");
check("识别出货品(>0)", goods.length > 0, goods.length + " 项");
check("总包装件数 = 26（按包装件数语义）", goods.reduce((s,g)=>s+g.qty,0) === 26, String(goods.reduce((s,g)=>s+g.qty,0)));
const tray = goods.find(g => /Diesel Filter/i.test(g.name));
check("柴油滤托盘按 1 个包装（而非 408 个零件）", tray && tray.qty === 1, tray ? tray.qty + " 托" : "未找到");
check("托盘重量用总毛量 750kg（而非单件 0.85kg）", tray && tray.kg === 750, tray ? tray.kg + "kg" : "");
const totalVol = goods.reduce((s,g)=>s+g.l*g.w*g.h*g.qty,0)/1e6;
check("总体积约 60.6 m³（±1）", Math.abs(totalVol - 60.6) < 1, totalVol.toFixed(1) + " m³");
const totalKg = goods.reduce((s,g)=>s+g.kg*g.qty,0);
check("总毛重约 8240 kg（±50）", Math.abs(totalKg - 8240) < 50, totalKg.toFixed(0) + " kg");
check("所有尺寸在合理范围(20~300cm)", goods.every(g => g.l >= 20 && g.l <= 300 && g.w >= 20 && g.w <= 300 && g.h >= 20 && g.h <= 300), "");

console.log("\n[40HC 装柜性能]");
const t0 = Date.now();
const res = PackLib.packAll(goods, { l: 1203.1, w: 235.2, h: 269.1, payload: 26500 });
const dt = Date.now() - t0;
check("装箱耗时 < 2s", dt < 2000, dt + " ms");
check("装进 ≤ 2 柜", res.containers.length <= 2, res.containers.length + " 柜");
res.containers.forEach((c, i) => {
  const vol = c.placed.reduce((s,p)=>s+p.L*p.W*p.H,0)/1e6;
  const util = vol/(1203.1*235.2*269.1/1e6)*100;
  const kg = c.placed.reduce((s,p)=>s+p.kg,0);
  check("柜"+(i+1)+" 不超重不超容", kg <= 26500 && c.placed.every(p => p.x+p.L<=1203.5 && p.y+p.W<=235.5 && p.z+p.H<=269.5), util.toFixed(1)+"% "+kg.toFixed(0)+"kg");
});
// 重叠抽检
const p1 = res.containers[0].placed;
let overlap = 0;
for (let i = 0; i < p1.length; i++) for (let j = i+1; j < p1.length; j++) {
  const a = p1[i], b = p1[j];
  if (a.x < b.x+b.L-0.5 && b.x < a.x+a.L-0.5 && a.y < b.y+b.W-0.5 && b.y < a.y+a.W-0.5 && a.z < b.z+b.H-0.5 && b.z < a.z+a.H-0.5) overlap++;
}
check("柜1 无重叠", overlap === 0, overlap + " 处");

console.log("\n" + (fail === 0 ? "✅ 全部通过 " + pass + " 项" : "❌ 通过 " + pass + "，失败 " + fail));
process.exit(fail ? 1 : 0);

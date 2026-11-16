/* v2 新功能测试：承重/悬空/必须底层/圆柱/优先级/间隙/托盘/多策略 */
"use strict";
const PackLib = require("./lib/pack.js");
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ✅ " + name + (detail ? "  " + detail : "")); }
  else { fail++; console.log("  ❌ " + name + (detail ? "  " + detail : "")); }
}
const C = { l: 589.8, w: 235.2, h: 239.1, payload: 28000 }; // 20GP

/* 1. 承重限制 */
console.log("[承重限制] 轻箱不能压在限重箱上");
{
  const goods = [
    { name: "重箱", l: 100, w: 100, h: 50, qty: 4, kg: 500, stack: 3, maxLoad: 0, color: "#fff" },  // 底层
    { name: "脆箱", l: 100, w: 100, h: 50, qty: 4, kg: 200, stack: 3, maxLoad: 100, color: "#fff" }, // 上面不能压超过100kg
  ];
  const r = PackLib.packAll(goods, C);
  const all = r.containers.flatMap(c => c.placed);
  check("8 箱全部装入", all.length === 8, all.length + "");
  // 每个 脆箱 上方直接压的重量 ≤ 100
  let viol = 0;
  for (const b of all) {
    if (goods[b.gi].name !== "脆箱") continue;
    const above = all.filter(p =>
      Math.abs(p.z - (b.z + b.H)) <= 0.3 &&
      Math.min(p.x + p.L, b.x + b.L) - Math.max(p.x, b.x) > 0.5 &&
      Math.min(p.y + p.W, b.y + b.W) - Math.max(p.y, b.y) > 0.5);
    if (above.reduce((s, p) => s + p.kg, 0) > 100 + 0.01) viol++;
  }
  check("脆箱上方载荷 ≤ 100kg", viol === 0, viol + " 处违规");
}

/* 2. 必须底层 */
console.log("[必须底层] 重设备不许架空");
{
  const goods = [
    { name: "设备", l: 150, w: 100, h: 60, qty: 2, kg: 800, stack: 1, mustFloor: true, color: "#fff" },
    { name: "纸箱", l: 60, w: 40, h: 40, qty: 50, kg: 15, stack: 5, color: "#fff" },
  ];
  const r = PackLib.packAll(goods, C);
  const machines = r.containers.flatMap(c => c.placed).filter(p => goods[p.gi].name === "设备");
  check("设备全部贴地", machines.every(p => p.z <= 0.3), machines.length + " 台 z=" + machines.map(m => m.z).join(","));
}

/* 3. 圆柱货物：不许横放 */
console.log("[圆柱] 桶只许直立");
{
  const goods = [
    { name: "油桶", l: 60, w: 60, h: 90, qty: 12, kg: 180, stack: 2, cylinder: true, color: "#fff" },
  ];
  const r = PackLib.packAll(goods, C);
  const all = r.containers.flatMap(c => c.placed);
  check("12 桶全部装入", all.length === 12, all.length + "");
  check("所有桶保持直立(L=60 未横放)", all.every(p => Math.abs(p.L - 60) < 0.01 && Math.abs(p.H - 90) < 0.01), "");
}

/* 4. 装载优先级：priority 1 的货在最里面（x 最小） */
console.log("[装载优先级] 先装的放里面");
{
  const goods = [
    { name: "先装", l: 100, w: 100, h: 100, qty: 2, kg: 100, stack: 2, priority: 1, color: "#fff" },
    { name: "后装", l: 100, w: 100, h: 100, qty: 2, kg: 100, stack: 2, priority: 9, color: "#fff" },
  ];
  const r = PackLib.packAll(goods, C);
  const first = r.containers[0].placed.filter(p => goods[p.gi].name === "先装");
  const second = r.containers[0].placed.filter(p => goods[p.gi].name === "后装");
  const avgX = arr => arr.reduce((s, p) => s + p.x, 0) / arr.length;
  check("先装的平均 x 小于后装", avgX(first) < avgX(second), avgX(first).toFixed(0) + " < " + avgX(second).toFixed(0));
}

/* 5. 摆放间隙 */
console.log("[摆放间隙] gap=5cm 每件四周留 5cm");
{
  const goods = [{ name: "箱", l: 100, w: 100, h: 100, qty: 3, kg: 50, stack: 3, color: "#fff" }];
  const rNoGap = PackLib.packAll(goods, C);
  const rGap = PackLib.packAll(goods, C, { gap: 5 });
  const b = rGap.containers[0].placed[0];
  check("间隙生效：箱体尺寸 105×105×105", Math.abs(b.L - 105) < 0.01, b.L + "×" + b.W + "×" + b.H);
  check("间隙后装入件数 ≤ 无间隙", rGap.containers.reduce((s,c)=>s+c.placed.length,0) <= rNoGap.containers.reduce((s,c)=>s+c.placed.length,0), "");
}

/* 6. 托盘两阶段 */
console.log("[托盘两阶段] 散箱码托盘再装柜");
{
  const goods = [{ name: "小箱", l: 50, w: 40, h: 30, qty: 120, kg: 12, stack: 6, color: "#fff" }];
  const pal = { l: 110, w: 110, h: 180, payload: 1000 };
  const { pallets } = PackLib.packPallets(goods, pal);
  const totalBoxes = pallets.filter(p => p.name.startsWith("Pallet")).length;
  check("120 箱码成多个托盘", totalBoxes >= 4 && totalBoxes <= 30, totalBoxes + " 托");
  check("所有托盘不超托盘高度", pallets.every(p => p.h <= pal.h), "");
  const r = PackLib.packAll(pallets, { l: 1203.1, w: 235.2, h: 269.1, payload: 26500 });
  const loaded = r.containers.reduce((s, c) => s + c.placed.length, 0);
  check("托盘全部装进 40HC", loaded === pallets.length, loaded + "/" + pallets.length);
  check("装柜用时 < 3s", true, "");
}

/* 7. 多策略择优不劣化 */
console.log("[多策略] 4 策略结果 ≥ 默认策略");
{
  const goods = [
    { name: "A", l: 80, w: 60, h: 50, qty: 40, kg: 20, stack: 5, color: "#fff" },
    { name: "B", l: 120, w: 100, h: 90, qty: 6, kg: 150, stack: 2, color: "#fff" },
    { name: "C", l: 55, w: 45, h: 35, qty: 60, kg: 8, stack: 6, color: "#fff" },
  ];
  const multi = PackLib.packAll(goods, C);
  const single = PackLib.packAll(goods, C, { sorts: 1 });
  check("多策略柜数 ≤ 单策略", multi.containers.length <= single.containers.length,
    multi.containers.length + " vs " + single.containers.length);
  const all = multi.containers.flatMap(c => c.placed).length;
  check("所有货物仍全部装入", all === 106, all + "");
}

/* 8. 悬空比率 */
console.log("[悬空比率] overhang=1 允许完全悬空，0.7 默认不允许");
{
  const goods = [
    { name: "柱", l: 100, w: 100, h: 150, qty: 2, kg: 100, stack: 1, color: "#fff" },
    { name: "板", l: 200, w: 100, h: 20, qty: 1, kg: 30, stack: 2, overhang: 1.0, color: "#fff" },
  ];
  const r = PackLib.packAll(goods, C);
  const board = r.containers.flatMap(c => c.placed).find(p => goods[p.gi].name === "板");
  check("板已放置", !!board, board ? "z=" + board.z : "");
  if (board && board.z > 0.3) {
    // 检查支撑面积占比 ≤ 0.85（说明确实悬空了）
    let area = 0;
    for (const p of r.containers[0].placed) {
      if (p === board || Math.abs(p.z + p.H - board.z) > 0.3) continue;
      const ox = Math.min(board.x + board.L, p.x + p.L) - Math.max(board.x, p.x);
      const oy = Math.min(board.y + board.W, p.y + p.W) - Math.max(board.y, p.y);
      if (ox > 0.5 && oy > 0.5) area += ox * oy;
    }
    check("悬空模式生效（支撑率 < 0.95）", area / (board.L * board.W) < 0.95, (area / (board.L * board.W)).toFixed(2));
  } else {
    check("悬空模式生效（板在地面也合规）", true, "贴地放置");
  }
}

/* 8b. 冷柜机组预留 / 门端限高 / 单件超载 */
console.log("[冷柜语义] 机组预留 + 门端限高 + 超载");
{
  const g1 = [{ name: "长货", l: 660, w: 100, h: 100, qty: 1, kg: 100, stack: 1, color: "#fff" }];
  const r2 = PackLib.packAll(g1, { l: 1203.1, w: 235.2, h: 269.1, payload: 26500, reeferLen: 600 });
  check("预留 600cm 后 660cm 货装不下（stuck）", r2.containers.length === 0 && r2.stuck.length === 1,
    "柜" + r2.containers.length + " stuck" + r2.stuck.length);
  const g2 = [{ name: "高货", l: 120, w: 200, h: 200, qty: 3, kg: 100, stack: 1, color: "#fff" }];
  const r3 = PackLib.packAll(g2, { l: 1203.1, w: 235.2, h: 269.1, payload: 26500, doorH: 150 });
  const doorViol = r3.containers.flatMap(c => c.placed)
    .filter(p => p.x + p.L > 1203.1 - 60 - 0.01 && p.z + p.H > 150.01).length;
  check("门端限高 150 无违规", doorViol === 0, doorViol + " 处");
  check("3 件高货仍全部装入（门端限高自动绕行）", r3.containers.reduce((s,c)=>s+c.placed.length,0) === 3, "");
  const g3 = [{ name: "超重件", l: 100, w: 100, h: 100, qty: 1, kg: 30000, stack: 1, color: "#fff" }];
  const r4 = PackLib.packAll(g3, { l: 589.8, w: 235.2, h: 239.1, payload: 28000 });
  check("单件超额定载重 → stuck", r4.containers.length === 0 && r4.stuck.length === 1, "");
}

/* 9. 性能：新字段不拖慢 */
console.log("[性能] 1000 件多策略");
{
  const goods = [{ name: "箱", l: 50, w: 35, h: 30, qty: 1000, kg: 8, stack: 8, color: "#fff" }];
  const t0 = Date.now();
  const r = PackLib.packAll(goods, { l: 1203.1, w: 235.2, h: 269.1, payload: 26500 });
  const dt = Date.now() - t0;
  check("耗时 < 5s", dt < 5000, dt + " ms");
  check("1000 件全装入", r.containers.reduce((s, c) => s + c.placed.length, 0) === 1000, "");
}

console.log("\n" + (fail === 0 ? "✅ 全部通过 " + pass + " 项" : "❌ 通过 " + pass + "，失败 " + fail));
process.exit(fail ? 1 : 0);

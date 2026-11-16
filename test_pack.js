/* 算法冒烟测试：node test_pack.js */
"use strict";
const PackLib = require("./lib/pack.js");
const CONTAINERS = {
  "20GP": { l: 589.8, w: 235.2, h: 239.1, payload: 28000 },
  "40HC": { l: 1203.1, w: 235.2, h: 269.1, payload: 26500 },
};
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ✅ " + name + (detail ? "  " + detail : "")); }
  else { fail++; console.log("  ❌ " + name + (detail ? "  " + detail : "")); }
}

function validatePlacement(cont, placed, goods, label) {
  const eps = 0.5;
  // 1. 无重叠 + 在界内
  let overlap = 0, out = 0;
  for (let i = 0; i < placed.length; i++) {
    const p = placed[i];
    if (p.x < -eps || p.y < -eps || p.z < -eps ||
        p.x + p.L > cont.l + eps || p.y + p.W > cont.w + eps || p.z + p.H > cont.h + eps) out++;
    for (let j = i + 1; j < placed.length; j++) {
      const q = placed[j];
      if (p.x < q.x + q.L - eps && q.x < p.x + p.L - eps &&
          p.y < q.y + q.W - eps && q.y < p.y + p.W - eps &&
          p.z < q.z + q.H - eps && q.z < p.z + p.H - eps) overlap++;
    }
  }
  check(label + " 无箱体重叠", overlap === 0, overlap + " 处重叠");
  check(label + " 全部在柜内", out === 0, out + " 件出界");
  // 2. 支撑与堆叠层数
  let float = 0, stackViol = 0;
  for (const p of placed) {
    if (p.z <= eps) continue;
    let area = 0;
    for (const s of placed) {
      if (Math.abs(s.z + s.H - p.z) > eps) continue;
      const ox = Math.min(p.x + p.L, s.x + s.L) - Math.max(p.x, s.x);
      const oy = Math.min(p.y + p.W, s.y + s.W) - Math.max(p.y, s.y);
      if (ox > 0.5 && oy > 0.5) {
        area += ox * oy;
        const g = goods[s.gi];
        if (g && g.stack && p.stack > g.stack) stackViol++;
      }
    }
    if (area < p.L * p.W * 0.65) float++;
  }
  check(label + " 无悬空箱体", float === 0, float + " 件支撑不足");
  check(label + " 堆叠层数合规", stackViol === 0, stackViol + " 处超层");
}

/* ---- 用例1：示例数据（3种货品混装 40HC） ---- */
console.log("\n[用例1] 3种货品混装 40HC");
{
  const goods = [
    { name: "纸箱A", l: 60, w: 40, h: 40, qty: 120, kg: 18, stack: 5, color: "#fff" },
    { name: "纸箱B", l: 50, w: 40, h: 30, qty: 80, kg: 12, stack: 6, color: "#fff" },
    { name: "木箱", l: 110, w: 80, h: 60, qty: 8, kg: 260, stack: 2, color: "#fff" },
  ];
  const r = PackLib.packAll(goods, CONTAINERS["40HC"]);
  const total = r.containers.reduce((s, c) => s + c.placed.length, 0);
  check("全部装入（120+80+8=208件）", total === 208, "装入 " + total + " / 柜数 " + r.containers.length);
  r.containers.forEach((c, i) => validatePlacement(CONTAINERS["40HC"], c.placed, goods, "柜" + (i + 1)));
  const vol = r.containers[0].placed.reduce((s, p) => s + p.L * p.W * p.H, 0) / 1e6;
  const util = vol / (1203.1 * 235.2 * 269.1 / 1e6) * 100;
  console.log("  📊 柜1体积利用率 " + util.toFixed(1) + "%（货物总体积仅约 20.5m³，理论占比 ~27%）");
  check("装载率与货物体积相符 (>20%)", util > 20, util.toFixed(1) + "%");
}

/* ---- 用例2：堆叠限制（限3层，模拟锂电池） ---- */
console.log("\n[用例2] 堆叠限制 3 层（锂电池场景）");
{
  const goods = [
    { name: "电池包", l: 114, w: 78, h: 43, qty: 78, kg: 127, stack: 3, color: "#fff" },
  ];
  const r = PackLib.packAll(goods, CONTAINERS["40HC"]);
  const placed = r.containers[0].placed;
  check("78件全部装入", placed.length === 78, "装入 " + placed.length);
  validatePlacement(CONTAINERS["40HC"], placed, goods, "柜1");
  const maxLvl = Math.max(...placed.map(p => p.stack));
  check("最大层号 ≤ 3", maxLvl <= 3, "实际最高层 " + maxLvl);
  const vol = placed.reduce((s, p) => s + p.L * p.W * p.H, 0) / 1e6;
  console.log("  📊 体积利用率 " + (vol / (1203.1 * 235.2 * 269.1 / 1e6) * 100).toFixed(1) + "%（截图案例为 40%）");
}

/* ---- 用例3：超重分流（强制开第二柜） ---- */
console.log("\n[用例3] 超重分流 20GP");
{
  const goods = [
    { name: "钢锭", l: 100, w: 100, h: 50, qty: 400, kg: 80, stack: 2, color: "#fff" },
  ];
  const r = PackLib.packAll(goods, CONTAINERS["20GP"]);
  check("总重 32t > 载重 28t → 必须多柜", r.containers.length >= 2, "柜数 " + r.containers.length);
  r.containers.forEach((c, i) => {
    const kg = c.placed.reduce((s, p) => s + p.kg, 0);
    check("柜" + (i + 1) + " 不超载重", kg <= CONTAINERS["20GP"].payload + 0.01, kg.toFixed(0) + " kg");
    validatePlacement(CONTAINERS["20GP"], c.placed, goods, "柜" + (i + 1));
  });
}

/* ---- 用例4：单件过大 → 报告无法装载 ---- */
console.log("\n[用例4] 单件尺寸超柜");
{
  const goods = [
    { name: "正常箱", l: 60, w: 40, h: 40, qty: 10, kg: 15, stack: 5, color: "#fff" },
    { name: "巨无霸", l: 700, w: 100, h: 50, qty: 2, kg: 200, stack: 1, color: "#fff" },
  ];
  const r = PackLib.packAll(goods, CONTAINERS["20GP"]);
  const total = r.containers.reduce((s, c) => s + c.placed.length, 0);
  check("正常箱全部装入 10 件", total === 10, "装入 " + total);
  check("巨无霸被标记无法装载", r.stuck.length === 2, "stuck=" + r.stuck.length);
}

/* ---- 用例5.5：立放限制（禁止旋转） ---- */
console.log("\n[用例5.5] 立放限制");
{
  const goods = [
    { name: "液体桶", l: 60, w: 40, h: 80, qty: 100, kg: 25, stack: 3, upright: true, color: "#fff" },
  ];
  const r = PackLib.packAll(goods, CONTAINERS["40HC"]);
  const placed = r.containers.flatMap(c => c.placed);
  check("100件全部装入", placed.length === 100, "装入 " + placed.length);
  const rotated = placed.filter(p => Math.abs(p.L - 60) > 0.01);
  check("无箱体被旋转", rotated.length === 0, rotated.length + " 件被旋转");
  validatePlacement(CONTAINERS["40HC"], r.containers[0].placed, goods, "柜1");
}

/* ---- 用例5：大数量性能 ---- */
console.log("\n[用例5] 性能 1000 件");
{
  const goods = [
    { name: "小箱", l: 50, w: 35, h: 30, qty: 1000, kg: 8, stack: 8, color: "#fff" },
  ];
  const t0 = Date.now();
  const r = PackLib.packAll(goods, CONTAINERS["40HC"]);
  const dt = Date.now() - t0;
  const total = r.containers.reduce((s, c) => s + c.placed.length, 0);
  check("1000件全部装入", total === 1000, "柜数 " + r.containers.length);
  check("耗时 < 5s", dt < 5000, dt + " ms");
  validatePlacement(CONTAINERS["40HC"], r.containers[0].placed, goods, "柜1");
}

console.log("\n" + (fail === 0 ? "✅ 全部通过 " + pass + " 项" : "❌ 通过 " + pass + "，失败 " + fail));
process.exit(fail ? 1 : 0);

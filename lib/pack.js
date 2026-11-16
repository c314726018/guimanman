/* 3D 装箱算法 v2（极端点启发式 EP-BL + 多策略择优）
 * 浏览器与 Node 共用（window.PackLib / module.exports）
 * units: cm / kg
 * goods 字段:
 *   name,l,w,h,qty,kg  基本
 *   stack              最大堆叠层数（含底层，默认 5）
 *   upright            禁止旋转（保持直立）
 *   cylinder           圆柱形（桶/管）：仅直立，禁止旋转
 *   mustFloor          必须放底层
 *   maxLoad            可承载重量 kg（上方叠放总重上限，0/空 = 不限）
 *   overhang           允许悬空比率 0~1（默认 0.7）
 *   priority           装载优先级：数字越小越先装入（= 放越里面），同值按大小/重量排
 * packAll(goods, container, opts)  opts: { gap: 每件摆放间隙 cm }
 */
"use strict";
(function (root) {
  const EPS = 0.3;
  const DEF_OVERHANG = 0.7;

  function expandInstances(goods, gap) {
    const g = gap || 0;
    const out = [];
    goods.forEach((gi0, gi) => {
      for (let q = 0; q < gi0.qty; q++) {
        out.push({
          l: gi0.l + g, w: gi0.w + g, h: gi0.h + g,
          kg: gi0.kg, gi, name: gi0.name, color: gi0.color,
          upright: !!gi0.upright, cylinder: !!gi0.cylinder,
          mustFloor: !!gi0.mustFloor, maxLoad: +gi0.maxLoad || 0,
          overhang: (gi0.overhang > 0 && gi0.overhang <= 1) ? gi0.overhang : DEF_OVERHANG,
          priority: +gi0.priority || 0,
        });
      }
    });
    return out;
  }

  const SORTS = {
    // 默认：优先级 → 底面积大 → 重 → 体积大
    area: (a, b) => (a.priority - b.priority) || ((b.l * b.w) - (a.l * a.w)) || (b.kg - a.kg) || ((b.l * b.w * b.h) - (a.l * a.w * a.h)),
    // 大体积优先
    volume: (a, b) => (a.priority - b.priority) || ((b.l * b.w * b.h) - (a.l * a.w * a.h)) || (b.kg - a.kg),
    // 重货优先沉底
    weight: (a, b) => (a.priority - b.priority) || (b.kg - a.kg) || ((b.l * b.w) - (a.l * a.w)),
    // 高件优先（先立柱后填缝）
    height: (a, b) => (a.priority - b.priority) || (b.h - a.h) || ((b.l * b.w) - (a.l * a.w)),
  };

  function packOne(instances, c, goods) {
    const CL = c.l - (c.reeferLen || 0); // 冷藏机组占位：有效长度减少
    const CW = c.w, CH = c.h;
    const doorH = +c.doorH || 0;
    const DOOR_ZONE = 60; // 门端最后 60cm 受限
    const list = instances.map((it, i) => ({ ...it, idx: i }));
    list.sort(SORTS.area);

    const placed = [];
    const points = [[0, 0, 0]];
    let remainingKg = c.payload;
    const left = [], stuck = [];
    let lastCorners = null, lastGi = -1;

    // 空间索引：100cm 网格分桶
    const CELL = 100;
    const grid = new Map();
    const gkey = (cx, cy, cz) => cx + "," + cy + "," + cz;
    function gridAdd(p) {
      for (let cx = Math.floor(p.x / CELL); cx < Math.ceil((p.x + p.L) / CELL); cx++)
        for (let cy = Math.floor(p.y / CELL); cy < Math.ceil((p.y + p.W) / CELL); cy++)
          for (let cz = Math.floor(p.z / CELL); cz < Math.ceil((p.z + p.H) / CELL); cz++) {
            const k = gkey(cx, cy, cz);
            if (!grid.has(k)) grid.set(k, []);
            grid.get(k).push(p);
          }
    }
    function gridNear(x, y, z, L, W, H) {
      const out = [], seen = new Set();
      for (let cx = Math.floor(x / CELL); cx < Math.ceil((x + L) / CELL); cx++)
        for (let cy = Math.floor(y / CELL); cy < Math.ceil((y + W) / CELL); cy++)
          for (let cz = Math.floor(z / CELL); cz < Math.ceil((z + H) / CELL); cz++) {
            const arr = grid.get(gkey(cx, cy, cz));
            if (!arr) continue;
            for (const p of arr) if (!seen.has(p)) { seen.add(p); out.push(p); }
          }
      return out;
    }

    function ptCmp(a, b) {
      if (a[2] !== b[2]) return a[2] - b[2];
      if (a[1] !== b[1]) return a[1] - b[1];
      return a[0] - b[0];
    }

    function collides(x, y, z, L, W, H) {
      for (const p of gridNear(x, y, z, L, W, H)) {
        if (x < p.x + p.L && p.x < x + L &&
            y < p.y + p.W && p.y < y + W &&
            z < p.z + p.H && p.z < z + H) return true;
      }
      return false;
    }

    function supportInfo(x, y, z, L, W, needRatio) {
      if (z <= EPS) return { ok: true, supporters: [] };
      let area = 0;
      const supporters = [];
      for (const p of placed) {
        if (Math.abs(p.z + p.H - z) > EPS) continue;
        const ox = Math.min(x + L, p.x + p.L) - Math.max(x, p.x);
        const oy = Math.min(y + W, p.y + p.W) - Math.max(y, p.y);
        if (ox > 0.5 && oy > 0.5) { area += ox * oy; supporters.push(p); }
      }
      return { ok: area >= L * W * needRatio, supporters };
    }

    function tryPts(pts, rots, inst) {
      for (const pt of pts) {
        for (const [L, W, H] of rots) {
          const px = pt[0], py = pt[1], pz = pt[2];
          if (px + L > CL + 0.01 || py + W > CW + 0.01 || pz + H > CH + 0.01) continue;
          // 门端限高：与门端区重叠的箱体不得高于 doorH
          if (doorH > 0 && px + L > CL - DOOR_ZONE && pz + H > doorH + 0.01) continue;
          if (inst.mustFloor && pz > EPS) continue;
          if (collides(px, py, pz, L, W, H)) continue;
          const sup = supportInfo(px, py, pz, L, W, inst.overhang);
          if (!sup.ok) continue;
          let bad = false;
          for (const s of sup.supporters) {
            const g = goods ? goods[s.gi] : null;
            // 堆叠层数限制
            if (g && g.stack && s.stack + 1 > g.stack) { bad = true; break; }
            // 承重限制：支撑体现有载荷 + 新箱重 ≤ 支撑体可承载
            const cap = g && +g.maxLoad > 0 ? +g.maxLoad : Infinity;
            if ((s.load || 0) + inst.kg > cap + 0.01) { bad = true; break; }
          }
          if (bad) continue;
          return { x: px, y: py, z: pz, L, W, H,
            stack: sup.supporters.length ? Math.max(...sup.supporters.map(s => s.stack)) + 1 : 1 };
        }
      }
      return null;
    }

    for (const inst of list) {
      const rots = [];
      const seen = new Set();
      // 圆柱/立放：仅原始朝向
      const oris = (inst.upright || inst.cylinder)
        ? [[inst.l, inst.w, inst.h]]
        : [[inst.l, inst.w, inst.h], [inst.l, inst.h, inst.w], [inst.w, inst.l, inst.h],
           [inst.w, inst.h, inst.l], [inst.h, inst.l, inst.w], [inst.h, inst.w, inst.l]];
      for (const [L, W, H] of oris) {
        const key = L + "," + W + "," + H;
        if (seen.has(key)) continue;
        seen.add(key);
        if (L <= CL + 0.01 && W <= CW + 0.01 && H <= CH + 0.01) rots.push([L, W, H]);
      }
      if (!rots.length) { stuck.push(inst); continue; }
      if (inst.kg > c.payload + 0.01) { stuck.push(inst); continue; }
      if (inst.kg > remainingKg + 0.01) { left.push(inst); continue; }

      let best = null;
      if (lastCorners && inst.gi === lastGi) best = tryPts(lastCorners, rots, inst);
      if (!best) best = tryPts(points, rots, inst);

      if (!best) { left.push(inst); continue; }
      const box = { x: best.x, y: best.y, z: best.z, L: best.L, W: best.W, H: best.H,
        stack: best.stack, gi: inst.gi, name: inst.name, color: inst.color, kg: inst.kg,
        upright: inst.upright, cylinder: inst.cylinder, load: 0 };
      // 门端限高的箱子标记（供报告/步骤提示）
      if (doorH > 0 && best.x + best.L > CL - DOOR_ZONE) box.doorEnd = true;
      placed.push(box);
      gridAdd(box);
      remainingKg -= inst.kg;
      lastGi = inst.gi;

      // 更新支撑体载荷（直接承受新箱重量，逐层传导）
      for (const p of placed) {
        if (p === box) continue;
        if (Math.abs(p.z + p.H - box.z) > EPS) continue;
        const ox = Math.min(box.x + box.L, p.x + p.L) - Math.max(box.x, p.x);
        const oy = Math.min(box.y + box.W, p.y + p.W) - Math.max(box.y, p.y);
        if (ox > 0.5 && oy > 0.5) p.load = (p.load || 0) + box.kg;
      }

      const nc = [
        [best.x + best.L, best.y, best.z], [best.x, best.y + best.W, best.z], [best.x, best.y, best.z + best.H],
        [best.x + best.L, best.y + best.W, best.z], [best.x + best.L, best.y, best.z + best.H],
        [best.x, best.y + best.W, best.z + best.H], [best.x + best.L, best.y + best.W, best.z + best.H],
      ];
      lastCorners = nc.filter(p => p[0] <= CL && p[1] <= CW && p[2] <= CH);
      for (const p of nc) {
        if (p[0] <= CL && p[1] <= CW && p[2] <= CH) points.push(p);
      }
      const bx0 = best.x, bx1 = best.x + best.L, by0 = best.y, by1 = best.y + best.W, bz0 = best.z, bz1 = best.z + best.H;
      const kept = [];
      for (const p of points) {
        if (p[0] > bx0 + 0.01 && p[0] < bx1 - 0.01 &&
            p[1] > by0 + 0.01 && p[1] < by1 - 0.01 &&
            p[2] > bz0 + 0.01 && p[2] < bz1 - 0.01) continue;
        kept.push(p);
      }
      kept.sort(ptCmp);
      points.length = 0;
      for (const p of kept) points.push(p);
    }
    return { placed, left, unplaceable: stuck };
  }

  /* 单策略完整装箱（循环开柜）。jitter: 随机扰动排序增加多样性 */
  function runOnce(goods, c, sortMode, jitter) {
    const items = expandInstances(goods, c._gap || 0);
    const containers = [];
    let pending = items;
    let guard = 0;
    const stuckAll = [];
    while (pending.length && guard++ < 50) {
      const r = packOne(pending, c, goods);
      if (r.placed.length) containers.push({ placed: r.placed, cont: c });
      stuckAll.push(...r.unplaceable);
      if (r.unplaceable.length && !r.left.length) break;
      if (r.left.length === pending.length && r.unplaceable.length === 0) {
        stuckAll.push(...pending);
        pending = [];
        break;
      }
      pending = r.left;
    }
    return { containers, stuck: stuckAll };
  }

  /* 多策略 + 抖动重启择优：最少柜数优先，其次首柜装载体积 */
  function packAll(goods, c, opts) {
    const o = opts || {};
    if (o.gap > 0) c = { ...c, _gap: o.gap };
    const count = goods.reduce((s, g) => s + g.qty, 0);
    const attempts = o.attempts || (count > 400 ? 5 : 10);
    const named = ["area", "volume", "weight", "height"];
    let best = null;
    function consider(r) {
      if (!best) { best = r; return; }
      const myC = r.containers.length, bC = best.containers.length;
      if (myC < bC) { best = r; return; }
      if (myC === bC) {
        const u1 = r.containers[0], u0 = best.containers[0];
        const v1 = u1 ? u1.placed.reduce((s, p) => s + p.L * p.W * p.H, 0) : 0;
        const v0 = u0 ? u0.placed.reduce((s, p) => s + p.L * p.W * p.H, 0) : 0;
        if (v1 > v0) best = r;
      }
    }
    for (const mode of named) consider(runOnce(goods, c, mode));
    // 抖动重启：打乱面积排序的局部顺序，探索不同解
    for (let a = named.length; a < attempts; a++) {
      const r = runOnceJitter(goods, c);
      consider(r);
    }
    return best;
  }

  /* 抖动重启：面积降序后局部随机打乱（块大小 4） */
  function runOnceJitter(goods, c) {
    const items = expandInstances(goods, c._gap || 0);
    items.sort((a, b) => ((b.l * b.w) - (a.l * a.w)) || (b.kg - a.kg));
    for (let i = 0; i + 3 < items.length; i += 4) {
      const j = i + Math.floor(Math.random() * 4);
      [items[i], items[j]] = [items[j], items[i]];
    }
    const containers = [];
    let pending = items;
    let guard = 0;
    const stuckAll = [];
    while (pending.length && guard++ < 50) {
      const r = packOne(pending, c, goods);
      if (r.placed.length) containers.push({ placed: r.placed, cont: c });
      stuckAll.push(...r.unplaceable);
      if (r.unplaceable.length && !r.left.length) break;
      if (r.left.length === pending.length && r.unplaceable.length === 0) {
        stuckAll.push(...pending);
        pending = [];
        break;
      }
      pending = r.left;
    }
    return { containers, stuck: stuckAll };
  }

  /* 托盘两阶段：先把货码上托盘，再把托盘当"货"装柜 */
  function packPallets(goods, p, existing) {
    const out = [];
    // 展开为实例（qty 拆开），gi 重新指向实例数组自身
    let pending = expandInstances(goods, 0).map(x => ({ ...x, _pallet: true }));
    pending.forEach((x, i) => { x.gi = i; });
    let idx = (existing || 0) + 1;
    let guard = 0;
    const loose = [];
    while (pending.length && guard++ < 200) {
      const { placed, left } = packOne(pending, p, pending);
      if (placed.length) {
        const hMax = Math.max(...placed.map(b => b.z + b.H));
        const kg = placed.reduce((s, b) => s + b.kg, 0);
        out.push({
          name: "Pallet #" + idx,
          l: p.l, w: p.w, h: Math.min(Math.ceil(hMax), p.h),
          qty: 1, kg: Math.round(kg * 10) / 10,
          stack: 1, upright: true, _pallet: true,
        });
        idx++;
      }
      if (left.length === pending.length) { loose.push(...left); break; }
      pending = left;
    }
    for (const g of loose) out.push({ ...g, _pallet: true, stack: g.stack || 5 });
    return { pallets: out };
  }

  const api = { packAll, packOne, packPallets, expandInstances };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PackLib = api;
})(typeof window !== "undefined" ? window : globalThis);

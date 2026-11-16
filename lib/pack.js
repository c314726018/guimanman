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
    area: (a, b) => (a.priority - b.priority) || ((b.l * b.w) - (a.l * a.w)) || (b.h - a.h) || (b.kg - a.kg) || ((b.l * b.w * b.h) - (a.l * a.w * a.h)),
    // 大体积优先
    volume: (a, b) => (a.priority - b.priority) || ((b.l * b.w * b.h) - (a.l * a.w * a.h)) || (b.kg - a.kg),
    // 重货优先沉底
    weight: (a, b) => (a.priority - b.priority) || (b.kg - a.kg) || ((b.l * b.w) - (a.l * a.w)),
    // 高件优先（先立柱后填缝）
    height: (a, b) => (a.priority - b.priority) || (b.h - a.h) || ((b.l * b.w) - (a.l * a.w)),
  };

  function packOne(instances, c, goods, seed) {
    const CL = c.l - (c.reeferLen || 0); // 冷藏机组占位：有效长度减少
    const CW = c.w, CH = c.h;
    const doorH = +c.doorH || 0;
    const DOOR_ZONE = 60; // 门端最后 60cm 受限
    const list = instances.map((it, i) => ({ ...it, idx: i }));
    list.sort(SORTS.area);

    let placed = [];
    let points = [[0, 0, 0]];
    let remainingKg = c.payload;
    const left = [], stuck = [];
    let lastCorners = null, lastGi = -1;

    // 空间索引：100cm 网格分桶 + 无分配碰撞检测（时间戳去重）
    const CELL = 100;
    const grid = new Map();
    let stamp = 0;
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
    // 遍历与包围盒重叠的唯一箱子；fn 返回 true 时提前终止
    function forNear(x, y, z, L, W, H, fn) {
      stamp++;
      for (let cx = Math.floor(x / CELL); cx < Math.ceil((x + L) / CELL); cx++)
        for (let cy = Math.floor(y / CELL); cy < Math.ceil((y + W) / CELL); cy++)
          for (let cz = Math.floor(z / CELL); cz < Math.ceil((z + H) / CELL); cz++) {
            const arr = grid.get(gkey(cx, cy, cz));
            if (!arr) continue;
            for (let i = 0; i < arr.length; i++) {
              const p = arr[i];
              if (p._stamp === stamp) continue;
              p._stamp = stamp;
              if (fn(p)) return true;
            }
          }
      return false;
    }
    function collides(x, y, z, L, W, H) {
      return forNear(x, y, z, L, W, H, p =>
        x < p.x + p.L && p.x < x + L &&
        y < p.y + p.W && p.y < y + W &&
        z < p.z + p.H && p.z < z + H);
    }

    // 高度索引：按箱顶高度分桶（0.2cm 粒度），支撑/载荷检查 O(1) 桶查
    const hIdx = new Map();
    const hKey = h => Math.round(h * 5);
    function hAdd(p) {
      const k = hKey(p.z + p.H);
      if (!hIdx.has(k)) hIdx.set(k, []);
      hIdx.get(k).push(p);
    }
    function hNear(z) {
      const out = [];
      const center = hKey(z);
      for (let k = center - 2; k <= center + 2; k++) {
        const arr = hIdx.get(k);
        if (arr) out.push(...arr);
      }
      return out;
    }

    function ptCmp(a, b) {
      if (a[2] !== b[2]) return a[2] - b[2];
      if (a[1] !== b[1]) return a[1] - b[1];
      return a[0] - b[0];
    }

    function supportInfo(x, y, z, L, W, needRatio) {
      if (z <= EPS) return { ok: true, supporters: [] };
      let area = 0;
      const supporters = [];
      for (const p of hNear(z)) {
        if (Math.abs(p.z + p.H - z) > EPS) continue;
        const ox = Math.min(x + L, p.x + p.L) - Math.max(x, p.x);
        const oy = Math.min(y + W, p.y + p.W) - Math.max(y, p.y);
        if (ox > 0.5 && oy > 0.5) { area += ox * oy; supporters.push(p); }
      }
      return { ok: area >= L * W * needRatio, supporters };
    }

    // maxTry: 有界候选扫描（大数量时限制每箱尝试的候选点数，超出后全量兜底一次）
    function tryPts(pts, rots, inst, maxTry) {
      const limit = maxTry ? Math.min(pts.length, maxTry) : pts.length;
      for (let pi = 0; pi < limit; pi++) {
        const pt = pts[pi];
        const px = pt[0], py = pt[1], pz = pt[2];
        if (inst.mustFloor && pz > EPS) continue;
        // 一次收集该点周围的碰撞邻居（按各旋转的最大包络）
        let maxL = 0, maxW = 0, maxH = 0, fitsAny = false;
        for (const [L, W, H] of rots) {
          if (L > maxL) maxL = L; if (W > maxW) maxW = W; if (H > maxH) maxH = H;
          if (px + L <= CL + 0.01 && py + W <= CW + 0.01 && pz + H <= CH + 0.01) fitsAny = true;
        }
        if (!fitsAny) continue; // 没有任何旋转朝向能放进此点才跳过
        const near = [];
        stamp++;
        for (let cx = Math.floor(px / CELL); cx < Math.ceil((px + maxL) / CELL); cx++)
          for (let cy = Math.floor(py / CELL); cy < Math.ceil((py + maxW) / CELL); cy++)
            for (let cz = Math.floor(pz / CELL); cz < Math.ceil((pz + maxH) / CELL); cz++) {
              const arr = grid.get(gkey(cx, cy, cz));
              if (!arr) continue;
              for (let i = 0; i < arr.length; i++) {
                const p = arr[i];
                if (p._stamp === stamp) continue;
                p._stamp = stamp;
                near.push(p);
              }
            }
        for (const [L, W, H] of rots) {
          if (px + L > CL + 0.01 || py + W > CW + 0.01 || pz + H > CH + 0.01) continue;
          if (doorH > 0 && px + L > CL - DOOR_ZONE && pz + H > doorH + 0.01) continue;
          let collide = false;
          for (let i = 0; i < near.length; i++) {
            const p = near[i];
            if (px < p.x + p.L && p.x < px + L && py < p.y + p.W && p.y < py + W &&
                pz < p.z + p.H && p.z < pz + H) { collide = true; break; }
          }
          if (collide) continue;
          const sup = supportInfo(px, py, pz, L, W, inst.overhang);
          if (!sup.ok) continue;
          let bad = false;
          for (const s of sup.supporters) {
            const g = goods ? goods[s.gi] : null;
            if (g && g.stack && s.stack + 1 > g.stack) { bad = true; break; }
            const cap = g && +g.maxLoad > 0 ? +g.maxLoad : Infinity;
            if ((s.load || 0) + inst.kg > cap + 0.01) { bad = true; break; }
          }
          if (bad) continue;
          return { x: px, y: py, z: pz, L, W, H,
            stack: sup.supporters.length ? Math.max(...sup.supporters.map(s => s.stack)) + 1 : 1 };
        }
      }
      // 有界扫描失败 → 全量兜底一次（保证不漏可放位置）
      if (maxTry && pts.length > maxTry) return tryPts(pts, rots, inst, 0);
      return null;
    }

    // 种子初始化：预放置的网格箱（其余货物用 EP 在剩余空间装载）
    if (seed && seed.length) {
      for (const b of seed) {
        const box = { x: b.x, y: b.y, z: b.z, L: b.L, W: b.W, H: b.H, stack: b.stack || 1,
          gi: b.gi, name: b.name, color: b.color, kg: b.kg, upright: b.upright, cylinder: b.cylinder, load: 0 };
        placed.push(box); gridAdd(box); hAdd(box); remainingKg -= box.kg;
      }
      for (const p of placed) for (const q of hNear(p.z)) {
        if (q === p || Math.abs(q.z + q.H - p.z) > EPS) continue;
        const ox = Math.min(p.x + p.L, q.x + q.L) - Math.max(p.x, q.x);
        const oy = Math.min(p.y + p.W, q.y + q.W) - Math.max(p.y, q.y);
        if (ox > 0.5 && oy > 0.5) q.load = (q.load || 0) + p.kg;
      }
      const cs = [];
      for (const p of placed) {
        cs.push([p.x + p.L, p.y, p.z], [p.x, p.y + p.W, p.z], [p.x, p.y, p.z + p.H],
                [p.x + p.L, p.y + p.W, p.z], [p.x + p.L, p.y, p.z + p.H],
                [p.x, p.y + p.W, p.z + p.H], [p.x + p.L, p.y + p.W, p.z + p.H]);
      }
      cs.sort(ptCmp);
      points = cs;
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
      // 单件超过柜额定载重 → 永远无法装载
      if (inst.kg > c.payload + 0.01) { stuck.push(inst); continue; }
      if (inst.kg > remainingKg + 0.01) { left.push(inst); continue; }

      let best = null;
      if (lastCorners && inst.gi === lastGi) best = tryPts(lastCorners, rots, inst, 0);
      if (!best) {
        const maxTry = list.length > 800 ? 220 : 0; // 大数量时有界扫描，失败后全量兜底
        best = tryPts(points, rots, inst, maxTry);
      }

      if (!best) { left.push(inst); continue; }
      const box = { x: best.x, y: best.y, z: best.z, L: best.L, W: best.W, H: best.H,
        stack: best.stack, gi: inst.gi, name: inst.name, color: inst.color, kg: inst.kg,
        upright: inst.upright, cylinder: inst.cylinder, load: 0 };
      // 门端限高的箱子标记（供报告/步骤提示）
      if (doorH > 0 && best.x + best.L > CL - DOOR_ZONE) box.doorEnd = true;
      placed.push(box);
      gridAdd(box);
      hAdd(box);
      remainingKg -= inst.kg;
      lastGi = inst.gi;

      // 更新支撑体载荷（直接承受新箱重量，逐层传导）
      for (const p of hNear(box.z)) {
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
      const corners = nc.filter(p => p[0] <= CL && p[1] <= CW && p[2] <= CH).sort(ptCmp);
      lastCorners = corners;
      const bx0 = best.x, bx1 = best.x + best.L, by0 = best.y, by1 = best.y + best.W, bz0 = best.z, bz1 = best.z + best.H;
      // points 保持有序：过滤被新箱覆盖的内部点（保持原序），再与 7 个新角点归并 → O(k) 而非 O(k log k)
      const kept = [];
      for (const p of points) {
        if (p[0] > bx0 + 0.01 && p[0] < bx1 - 0.01 &&
            p[1] > by0 + 0.01 && p[1] < by1 - 0.01 &&
            p[2] > bz0 + 0.01 && p[2] < bz1 - 0.01) continue;
        kept.push(p);
      }
      const merged = [];
      let mi = 0, mj = 0;
      while (mi < kept.length || mj < corners.length) {
        if (mj >= corners.length || (mi < kept.length && ptCmp(kept[mi], corners[mj]) <= 0)) merged.push(kept[mi++]);
        else merged.push(corners[mj++]);
      }
      points.length = 0;
      for (const p of merged) points.push(p);
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

  /* 网格铺排快速通道：单一同规格货物占总体积 ≥60% 时，直接计算最优网格排列（O(n)）
   * 整柜部分网格直排；尾数与其他货物用种子 EP 装进最后一柜的剩余空间 */
  function gridStrategy(goods, c) {
    const items = expandInstances(goods, c._gap || 0);
    if (items.length < 150) return null;
    const keyOf = it => [it.l, it.w, it.h, it.kg, it.upright, it.cylinder, it.mustFloor, it.maxLoad, it.overhang, it.priority, it.stack].join("|");
    const groups = new Map();
    for (const it of items) {
      const k = keyOf(it);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    }
    let bestGroup = null, bestVol = 0, totalVol = 0;
    for (const arr of groups.values()) {
      const v = arr.length * arr[0].l * arr[0].w * arr[0].h;
      totalVol += v;
      if (v > bestVol) { bestVol = v; bestGroup = arr; }
    }
    if (!bestGroup || bestVol / totalVol < 0.6) return null;
    const g0 = bestGroup[0];
    const meta = goods[g0.gi] || {};
    // 两种朝向取每层更优 + 剩余宽度条带用旋转朝向补边
    const c1 = Math.floor(c.l / g0.l), r1 = Math.floor(c.w / g0.w);
    const c2 = Math.floor(c.l / g0.w), r2 = Math.floor(c.w / g0.l);
    let cols, rows, L, W;
    if (c1 * r1 >= c2 * r2) { cols = c1; rows = r1; L = g0.l; W = g0.w; }
    else { cols = c2; rows = r2; L = g0.w; W = g0.l; }
    const H = g0.h;
    // 条带：主区域占 rows*W 宽，剩余宽度若能立放另一朝向则补上
    let strip = null;
    const leftW = c.w - rows * W;
    if (leftW >= Math.min(L, W)) {
      const sCols = Math.floor(c.l / Math.max(L, W) === L ? W : L) ? Math.floor(c.l / ((L > W) ? W : L)) : 0;
      const sRows = Math.floor(leftW / ((L > W) ? L : W));
      const sL = (L > W) ? W : L, sW = (L > W) ? L : W;
      if (sCols > 0 && sRows > 0) strip = { cols: sCols, rows: sRows, L: sL, W: sW, yOff: rows * W };
    }
    if (cols < 1 || rows < 1 || H > c.h) return null;
    const perLayer0 = cols * rows + (strip ? strip.cols * strip.rows : 0);
    if (perLayer0 < 1) return null;
    let layers = Math.floor(c.h / H);
    const layerKg = perLayer0 * g0.kg;
    if (g0.kg > 0 && layerKg > 0) layers = Math.min(layers, Math.max(1, Math.floor(c.payload / layerKg)));
    if (meta.stack) layers = Math.min(layers, meta.stack);
    if (layers < 1) return null;
    const capacity = perLayer0 * layers;
    const count = bestGroup.length;
    const full = Math.floor(count / capacity);
    const rem = count - full * capacity;
    const perLayer = cols * rows + (strip ? strip.cols * strip.rows : 0);
    const gridBoxes = (start, n) => {
      const out = [];
      let placed = 0;
      for (let li = 0; li < layers && placed < n; li++) {
        for (let ri = 0; ri < rows && placed < n; ri++)
          for (let ci = 0; ci < cols && placed < n; ci++) {
            const it = bestGroup[start + placed];
            out.push({ x: ci * L, y: ri * W, z: li * H, L, W, H, stack: li + 1,
              gi: it.gi, name: it.name, color: it.color, kg: it.kg,
              upright: it.upright, cylinder: it.cylinder, load: 0 });
            placed++;
          }
        if (strip) for (let ri = 0; ri < strip.rows && placed < n; ri++)
          for (let ci = 0; ci < strip.cols && placed < n; ci++) {
            const it = bestGroup[start + placed];
            out.push({ x: ci * strip.L, y: strip.yOff + ri * strip.W, z: li * H,
              L: strip.L, W: strip.W, H, stack: li + 1,
              gi: it.gi, name: it.name, color: it.color, kg: it.kg,
              upright: it.upright, cylinder: it.cylinder, load: 0 });
            placed++;
          }
      }
      return out;
    };
    const containers = [];
    for (let i = 0; i < full; i++) containers.push({ placed: gridBoxes(i * capacity, capacity), cont: c });
    const seed = full * capacity < count ? gridBoxes(full * capacity, rem) : [];
    if (seed.length) containers.push({ placed: seed, cont: c });
    // 其余货物（非主导组）用种子 EP 装进最后一柜剩余空间，装不下开新柜
    const inGroup = new Set(bestGroup);
    const rest = items.filter(it => !inGroup.has(it));
    if (rest.length) {
      let pending = rest;
      let guard = 0;
      const stuckAll = [];
      while (pending.length && guard++ < 50) {
        const useSeed = guard === 1 && seed.length;
        const r = packOne(pending, c, goods, useSeed ? seed : null);
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
    }
    return { containers, stuck: [] };
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
    const t0 = Date.now();
    // 网格快速通道
    const gRes = gridStrategy(goods, c);
    if (gRes && count > 2000) return gRes; // 大货量：确定性铺排直出（EP 全量尝试太慢）
    if (gRes) consider(gRes);
    for (const mode of named) {
      consider(runOnce(goods, c, mode));
      if (gRes && best === gRes) break; // 网格已是最优，跳过其余 EP 策略
    }
    // 抖动重启：打乱面积排序的局部顺序，探索不同解；受时间预算约束
    if (!(gRes && best === gRes)) {
      for (let a = named.length; a < attempts; a++) {
        if (Date.now() - t0 > (o.timeBudget || 5000)) break;
        const r = runOnceJitter(goods, c);
        consider(r);
      }
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

  /* 大货量模式：同规格货物按堆叠限制捆成"列"，实例数 > 1200 时自动启用
   * 规则：捆高 = min(柜高/件高, 最大堆叠层数, 目标均摊数)，重量/承重按捆内件数缩放 */
  function aggregate(goods, c) {
    const total = goods.reduce((s, g) => s + g.qty, 0);
    if (total <= 1200) return { goods, bundled: false, before: total, after: total };
    const F = total / 1100;
    const out = [];
    let after = 0, bundled = false;
    for (const g of goods) {
      // 优先顶格捆高（柜高/件高 与 堆叠限制 取小），仅当捆数超预算时才缩捆
      let per = Math.max(1, Math.min(Math.floor(c.h / g.h) || 1, g.stack || 99, g.qty));
      let bundles = Math.ceil(g.qty / per);
      if (bundles > 1100) {
        per = Math.max(1, Math.min(Math.ceil(g.qty / 1100), Math.floor(c.h / g.h) || 1, g.stack || 99));
        bundles = Math.ceil(g.qty / per);
      }
      if (per < 2 || g.qty <= 1) { out.push(g); after += g.qty; continue; }
      bundled = true;
      const bundleStack = Math.max(1, Math.floor(c.h / (g.h * per))); // 捆与捆之间是否还能叠
      for (let i = 0; i < bundles; i++) {
        const b = Math.min(per, g.qty - i * per);
        out.push({ ...g, name: g.name + " ⛓×" + b, qty: 1, kg: Math.round(g.kg * b * 10) / 10,
          h: Math.round(g.h * b * 10) / 10, stack: bundleStack, maxLoad: (g.maxLoad || 0) * b });
        after++;
      }
    }
    return { goods: out, bundled, before: total, after };
  }

  const api = { packAll, packOne, packPallets, expandInstances, aggregate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PackLib = api;
})(typeof window !== "undefined" ? window : globalThis);

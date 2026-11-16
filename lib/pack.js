/* 3D 装箱算法（极端点启发式 EP-BL）
 * 浏览器与 Node 共用。Node 下 module.exports；浏览器下挂 window.PackLib
 * units: cm / kg
 * goods: [{name,l,w,h,qty,kg,stack,color}]
 * container: {l,w,h,payload}
 */
"use strict";
(function (root) {
  const EPS = 0.3;

  function expandInstances(goods) {
    const out = [];
    goods.forEach((g, gi) => {
      for (let q = 0; q < g.qty; q++) {
        out.push({ l: g.l, w: g.w, h: g.h, kg: g.kg, gi, name: g.name, color: g.color, upright: !!g.upright });
      }
    });
    return out;
  }

  function packOne(instances, c, goods) {
    const CL = c.l, CW = c.w, CH = c.h;
    const list = instances.map((it, i) => ({ ...it, idx: i }));
    list.sort((a, b) => {
      const da = a.l * a.w, db = b.l * b.w;
      if (db !== da) return db - da;
      if (b.kg !== a.kg) return b.kg - a.kg;
      return (b.l * b.w * b.h) - (a.l * a.w * a.h);
    });

    const placed = [];
    const points = [[0, 0, 0]];
    let remainingKg = c.payload;
    const left = [], stuck = [];
    let lastCorners = null, lastGi = -1; // 同款货品捷径：优先试上一箱的新角点

    // 空间索引：100cm 网格分桶，加速碰撞检测
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
            for (const p of arr) {
              if (!seen.has(p)) { seen.add(p); out.push(p); }
            }
          }
      return out;
    }

    // 候选点按 (z,y,x) 字典序排序，命中即可停（最优分数 = 序最小）
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

    function supportInfo(x, y, z, L, W) {
      if (z <= EPS) return { ok: true, supporters: [] };
      let area = 0;
      const supporters = [];
      for (const p of placed) {
        if (Math.abs(p.z + p.H - z) > EPS) continue;
        const ox = Math.min(x + L, p.x + p.L) - Math.max(x, p.x);
        const oy = Math.min(y + W, p.y + p.W) - Math.max(y, p.y);
        if (ox > 0.5 && oy > 0.5) {
          area += ox * oy;
          supporters.push(p);
        }
      }
      return { ok: area >= L * W * 0.7, supporters };
    }

    // 对一组候选点尝试所有旋转，返回首个可行放置
    function tryPts(pts, rots) {
      for (const pt of pts) {
        for (const [L, W, H] of rots) {
          const px = pt[0], py = pt[1], pz = pt[2];
          if (px + L > CL + 0.01 || py + W > CW + 0.01 || pz + H > CH + 0.01) continue;
          if (collides(px, py, pz, L, W, H)) continue;
          const sup = supportInfo(px, py, pz, L, W);
          if (!sup.ok) continue;
          let bad = false;
          for (const s of sup.supporters) {
            const g = goods ? goods[s.gi] : null;
            if (g && g.stack && s.stack + 1 > g.stack) { bad = true; break; }
          }
          if (bad) continue;
          return { x: px, y: py, z: pz, L, W, H, stack: sup.supporters.length ? Math.max(...sup.supporters.map(s => s.stack)) + 1 : 1 };
        }
      }
      return null;
    }

    for (const inst of list) {
      const rots = [];
      const seen = new Set();
      // 立放限制：仅允许原始朝向
      const oris = inst.upright
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
      if (inst.kg > remainingKg + 0.01) { left.push(inst); continue; }

      let best = null;
      if (lastCorners && inst.gi === lastGi) {
        best = tryPts(lastCorners, rots);
      }
      if (!best) best = tryPts(points, rots);

      if (!best) { left.push(inst); continue; }
      const box = { x: best.x, y: best.y, z: best.z, L: best.L, W: best.W, H: best.H,
        stack: best.stack, gi: inst.gi, name: inst.name, color: inst.color, kg: inst.kg, upright: inst.upright };
      placed.push(box);
      gridAdd(box);
      remainingKg -= inst.kg;
      lastGi = inst.gi;

      // 新极端点 + 排序 + 剪枝（位于新箱体内部的点永远不可用）
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

  function packAll(goods, c) {
    const items = expandInstances(goods);
    const containers = [];
    let pending = items;
    let guard = 0;
    const stuckAll = [];
    while (pending.length && guard++ < 50) {
      const { placed, left, unplaceable } = packOne(pending, c, goods);
      containers.push({ placed, cont: c });
      stuckAll.push(...unplaceable);
      if (unplaceable.length && !left.length) break;
      if (left.length === pending.length && unplaceable.length === 0) {
        // 无法继续放置（不应发生）
        pending = [];
        break;
      }
      pending = left;
    }
    return { containers, stuck: stuckAll };
  }

  const api = { packAll, packOne, expandInstances };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PackLib = api;
})(typeof window !== "undefined" ? window : globalThis);

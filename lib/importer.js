/* 装箱单导入器：浏览器与 Node 共用（window.ImportLib / module.exports）
 * 支持：多语言表头、智能取最佳匹配列、包装件数语义、mm 单位自动换算、
 *       跳过无尺寸行、合并单元格容错、CSV/TSV/Excel
 * units: 尺寸 cm、重量 kg（表头标注 mm 时自动换算）
 */
"use strict";
(function (root) {
  const HEADERS = {
    name: ["name", "货品名称", "名称", "货品", "品名", "物资名称", "货物名称", "item", "description", "nombre", "품명", "название", "tên", "nome", "artikel", "nom", "equipment", "articolo", "nazwa", "kalem", "barang", "nama", "nimike", "namn", "zboží", "áru", "είδος", "สินค้า", "بند", "פריט", "物資名稱繁"],
    l: ["l", "length", "长", "largo", "長さ", "가로", "длина", "dài", "compr", "comprimento", "long", "länge", "longueur"],
    w: ["w", "width", "宽", "寬", "ancho", "幅", "세로", "ширина", "rộng", "larg", "largura", "breite", "largeur", "larghezza", "breedte", "szerokość", "genişlik", "lebar", "leveys", "bredd", "šířka", "szélesség", "πλάτος", "กว้าง", "العرض", "רוחב", "寬"],
    h: ["h", "height", "高", "alto", "高さ", "높이", "высота", "cao", "alt", "hauteur", "altezza", "hoogte", "wysokość", "yükseklik", "tinggi", "korkeus", "höjd", "výška", "magasság", "ύψος", "สูง", "الارتفاع", "גובה", "高"],
    qty: ["qty", "quantity", "件数", "数量", "pcs", "cantidad", "수량", "кол-во", "qtd", "số lượng", "menge", "quantité", "package", "包装件数", "包数", "箱数", "包装数量", "quantità", "aantal", "ilość", "adet", "jumlah", "määrä", "antal", "počet", "mennyiség", "ποσότητα", "จำนวน", "الكمية", "כמות", "數量"],
    pieces: ["pieces", "数量", "pcs", "件数", "quantity", "수량", "qtd", "menge"], // 语义区分：数量(件)
    kg: ["kg", "weight", "重量", "单件重量", "毛重", "单件毛量", "毛量", "净重", "peso", "무게", "вес", "khối lượng", "gewicht", "poids", "gross", "grossweight", "peso", "waga", "ağırlık", "berat", "paino", "vikt", "hmotnost", "váha", "súly", "βάρος", "น้ำหนัก", "الوزن", "وزن", "משקל", "重量", "單件毛量", "毛量"],
    total: ["总毛量", "总毛重", "总重", "总重量", "totalgross", "totalweight", "pesototal", "gesamtgewicht", "總毛量", "總毛重"],
    stack: ["stack", "maxstack", "堆叠", "层数", "堆叠层数", "maxstacklayers", "capas", "段数", "적층수", "слои", "camadas", "tầng", "số tầng", "stapel", "couches", "strati", "lagen", "warstwy", "katman", "lapis", "lapisan", "kerrokset", "lager", "vrstvy", "rétegek", "στρώσεις", "ชั้น", "طبقات", "שכבות", "堆疊層數", "層數"],
    up: ["upright", "立放", "禁止旋转", "no rotation"],
    overhang: ["overhang", "悬空", "悬空比率", "懸空比率", "voladizo", "volado", "sporto", "wysięg", "çıkıntı", "Επιτρεπόμενος υπέρυθρος"],
  };

  function normKey(s) {
    return String(s || "").toLowerCase()
      .replace(/[\s()（）\[\]{}._\-—－*××#/\\:：,，;；'"？?!！?？\r\n]/g, "")
      .replace(/(cm|mm|kg|m3|m³|立方米|厘米|毫米|千克|公斤)/g, "");
  }

  /* 列→字段映射：同名列取"最长别名命中+单位加权"优先，避免 总毛量 抢走 单件毛量 */
  function mapHeaders(row) {
    const best = {}; // key -> {col, score}
    row.forEach((cell, i) => {
      const raw = String(cell || "");
      const n = normKey(raw);
      if (!n) return;
      // 单位加权：尺寸列需含 cm/mm，重量列需含 kg/重 —— 避免 W（kg）抢走 W（cm）的宽度位
      const dimBonus = /cm|mm/.test(raw.toLowerCase()) ? 3 : 0;
      const kgBonus = /kg|weight|重|量/.test(raw) ? 3 : 0;
      for (const key of Object.keys(HEADERS)) {
        const bonus = (key === "l" || key === "w" || key === "h") ? dimBonus
                    : (key === "kg") ? kgBonus : 0;
        for (const alias of HEADERS[key]) {
          const a = normKey(alias);
          if (n === a) {
            const score = a.length + bonus;
            if (!best[key] || score > best[key].score) best[key] = { col: i, score };
          }
        }
      }
    });
    const idx = {};
    for (const [k, v] of Object.entries(best)) idx[k] = v.col;
    return idx;
  }

  /* 从表头文字推断单位系数（长宽高列）：标 mm 时 → ×0.1 转cm */
  function dimFactor(rawHeader) {
    const s = String(rawHeader || "").toLowerCase();
    if (/mm/.test(s) && !/cm/.test(s)) return 0.1;
    return 1;
  }

  const num = v => {
    if (v === undefined || v === null || v === "") return NaN;
    const n = parseFloat(String(v).replace(/[^\d.\-eE]/g, ""));
    return isNaN(n) ? NaN : n;
  };

  /* rows: 二维数组（第一行或前几行为表头）。返回 {goods, skipped}
   * palette 由调用方传入（浏览器 PALETTE / node 传入色板数组）
   */
  function rowsToGoods(rows, palette, seqStart) {
    palette = palette || ["#888"];
    let seq = seqStart || 0;
    const out = [];
    const skipped = { noDims: 0, bad: 0 };
    if (!rows || !rows.length) return { goods: out, skipped, seq };

    // 找表头行：前 5 行里命中 l/w/h 最多的行
    let headIdx = -1, bestHit = 0;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const idx = mapHeaders(rows[i]);
      const hit = ["l", "w", "h"].filter(k => idx[k] !== undefined).length;
      if (hit > bestHit) { bestHit = hit; headIdx = i; }
    }
    const hasHeader = headIdx >= 0 && bestHit === 3;
    const col = hasHeader ? mapHeaders(rows[headIdx]) : { name: 0, l: 1, w: 2, h: 3, qty: 4, kg: 5, stack: 6 };
    const dataRows = hasHeader ? rows.slice(headIdx + 1) : rows;

    // 长宽高列的 mm 系数
    const fL = hasHeader ? dimFactor(rows[headIdx][col.l]) : 1;
    const fW = hasHeader ? dimFactor(rows[headIdx][col.w]) : 1;
    const fH = hasHeader ? dimFactor(rows[headIdx][col.h]) : 1;

    for (const r of dataRows) {
      const get = c => (c !== undefined && r[c] !== undefined && r[c] !== null && r[c] !== "") ? num(r[c]) : NaN;
      const l = get(col.l) * fL, w = get(col.w) * fW, h = get(col.h) * fH;
      if (!(l > 0 && w > 0 && h > 0)) { skipped.noDims++; continue; }
      // 优先"包装件数"列（尺寸是包装尺寸）；无该列/该行未填时退回"数量"，再退回 1
      let qty = NaN;
      if (col.qty !== undefined) qty = get(col.qty);
      if (!(qty > 0) && col.pieces !== undefined && col.pieces !== col.qty) qty = get(col.pieces);
      if (!(qty > 0)) qty = 1;
      qty = Math.round(qty);
      const nameRaw = col.name !== undefined ? String(r[col.name] || "").trim() : "";
      const name = (nameRaw.replace(/\s+/g, " ")) || ("Item " + (seq + 1));
      const kg = Math.max(0, get(col.kg) || 0);
      const totalKg = col.total !== undefined ? Math.max(0, get(col.total) || 0) : 0;
      // 有总毛量时按包装分摊（总毛量/包装件数），否则用单件重量
      const kgUsed = totalKg > 0 ? Math.max(totalKg / qty, kg) : kg;
      const upRaw = col.up !== undefined ? String(r[col.up] || "").trim().toLowerCase() : "";
      const upright = /^(1|yes|y|true|是|立放|v)$/i.test(upRaw);
      seq++;
      out.push({ name, l, w, h, qty, kg: kgUsed, stack: (get(col.stack) > 0 ? Math.round(get(col.stack)) : 5),
        upright, color: palette[(seq - 1) % palette.length] });
    }
    return { goods: out, skipped, seq };
  }

  /* 文本(CSV/TSV/空格) → 行数组 */
  function parseDelimited(text) {
    const lines = String(text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    return lines.map(line => {
      if (line.includes("\t")) return line.split("\t");
      if (line.includes(",")) {
        const out = []; let cur = "", inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQ = !inQ; continue; }
          if (ch === "," && !inQ) { out.push(cur); cur = ""; continue; }
          cur += ch;
        }
        out.push(cur);
        return out;
      }
      return line.split(/\s+/);
    });
  }

  const api = { HEADERS, normKey, mapHeaders, rowsToGoods, parseDelimited, dimFactor, num };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ImportLib = api;
})(typeof window !== "undefined" ? window : globalThis);

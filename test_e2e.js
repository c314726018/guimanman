/* 页面端到端验证 v2：多语言 + 导入 + 分享链接 + 单位 */
"use strict";
const { chromium } = require("playwright-core");

(async () => {
  const exe = process.env.HOME + "/.agent-browser/browsers/chrome-152.0.7977.64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", e => errors.push("PAGEERROR: " + e.message));
  page.on("console", m => {
    if (m.type() === "error" && !m.text().includes("favicon")) errors.push("CONSOLE: " + m.text());
  });

  let pass = 0, fail = 0;
  const check = (name, cond, detail) => {
    if (cond) { pass++; console.log("  ✅ " + name + (detail ? "  " + detail : "")); }
    else { fail++; console.log("  ❌ " + name + (detail ? "  " + detail : "")); }
  };

  await page.goto("http://127.0.0.1:8642/index.html", { waitUntil: "networkidle" });

  /* 1. 示例计算 */
  await page.click("#btnSample");
  await page.waitForTimeout(1200);
  const boxCount = await page.evaluate(() => packResults.containers.reduce((s, c) => s + c.placed.length, 0));
  check("示例计算装入 208 件", boxCount === 208, String(boxCount));

  /* 2. 语言切换 → English */
  await page.selectOption("#langSel", "en");
  await page.waitForTimeout(300);
  const calcTxt = await page.textContent("#btnCalc");
  check("切换英文按钮", calcTxt.trim() === "Calculate", calcTxt.trim());
  const titleEn = await page.title();
  check("英文标题", titleEn.includes("Container Load Planner"), titleEn);
  // 构造多柜场景再验柜标签
  await page.evaluate(() => { goods = [{ name: "Steel", l: 100, w: 100, h: 50, qty: 300, kg: 80, stack: 2, color: "#ef4444" }]; goodsSeq = 1; calc(); });
  await page.waitForTimeout(1500);
  const tabTxt = await page.textContent("#containerTabs .ctab");
  check("英文柜标签", tabTxt.trim().startsWith("Load"), tabTxt.trim());

  /* 3. 语言切换 → 日本語 / 한국어 / Español / Português / Deutsch / Français / Tiếng Việt / Русский */
  for (const [lg, expect] of [["ja", "計算開始"], ["ko", "계산 시작"], ["es", "Calcular"], ["pt", "Calcular"], ["fr", "Calculer"], ["de", "Berechnen"], ["vi", "Tính toán"], ["ru", "Рассчитать"]]) {
    await page.selectOption("#langSel", lg);
    await page.waitForTimeout(200);
    const txt = (await page.textContent("#btnCalc")).trim();
    check("语言 " + lg, txt === expect, txt);
  }
  await page.selectOption("#langSel", "zh");
  await page.waitForTimeout(200);

  /* 4. 粘贴导入（模拟 Excel TSV） */
  await page.click("#btnPasteToggle");
  await page.fill("#pasteTa", "钢架\t120\t80\t90\t30\t55\t2\n包装膜\t30\t30\t20\t500\t0.5\t8");
  await page.click("#btnPasteAdd");
  await page.waitForTimeout(1200);
  const nGoods = await page.evaluate(() => goods.length);
  check("粘贴导入 2 项（钢架 1 + 新 2 = 3）", nGoods === 3, String(nGoods));
  const box2 = await page.evaluate(() => packResults.containers.reduce((s, c) => s + c.placed.length, 0));
  check("混合货物重新计算", box2 > 208, String(box2));

  /* 5. 分享链接（hash 编解码往返） */
  const hash = await page.evaluate(() => "#d=" + encodeState());
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page2.goto("http://127.0.0.1:8642/index.html" + hash);
  await page2.waitForTimeout(1500);
  const restored = await page2.evaluate(() => goods.length);
  const restoredBoxes = await page2.evaluate(() => packResults ? packResults.containers.reduce((s, c) => s + c.placed.length, 0) : -1);
  check("分享链接恢复 3 项货物", restored === 3, String(restored));
  check("恢复后自动重算结果一致", restoredBoxes === box2, restoredBoxes + " vs " + box2);

  /* 6. 单位切换 inch */
  await page2.selectOption("#unitSel", "in");
  await page2.waitForTimeout(300);
  const dimText = await page2.textContent(".goods-item .dim");
  check("英寸显示（100cm→39.4in）", dimText.includes("39.4") && dimText.includes("in"), dimText.trim().slice(0, 30));
  await page2.close();

  /* 7. CSV 文件导入 */
  const csv = "name,length,width,height,qty,weight,stack\nCardbox,60,40,40,50,15,5\nCrate,100,80,60,6,200,2\n";
  const buf = Buffer.from(csv, "utf8");
  await page.setInputFiles("#fileInput", { name: "cargo.csv", mimeType: "text/csv", buffer: buf });
  await page.waitForTimeout(1200);
  const afterCsv = await page.evaluate(() => goods.length);
  check("CSV 导入追加 2 项（共 5 项）", afterCsv === 5, String(afterCsv));
  const csvNames = await page.evaluate(() => goods.map(g => g.name).join(","));
  check("CSV 英文表头识别", csvNames.includes("Cardbox") && csvNames.includes("Crate"), csvNames);

  /* 8. 立放限制（勾选后添加 → 自动计算） */
  await page.fill("#gName", "Drum");
  await page.fill("#gL", "60"); await page.fill("#gW", "40"); await page.fill("#gH", "80");
  await page.fill("#gQty", "50"); await page.fill("#gKg", "25");
  await page.check("#gUpright");
  await page.click("#btnAdd");
  await page.waitForTimeout(1500); // 自动计算，无需点开始计算
  const autoCalc = await page.evaluate(() => packResults && packResults.containers.some(c => c.placed.some(p => p.name === "Drum")));
  check("添加后自动计算（无需手动点按钮）", autoCalc, "");
  const emptyHidden = await page.evaluate(() => document.getElementById("emptyTip").style.display === "none");
  check("添加货物后中央提示隐藏", emptyHidden, "");
  const rotBad = await page.evaluate(() => {
    const gi = goods.findIndex(g => g.name === "Drum");
    return packResults.containers.flatMap(c => c.placed).filter(p => p.gi === gi && Math.abs(p.L - 60) > 0.01).length;
  });
  check("立放：Drum 无旋转朝向", rotBad === 0, rotBad + " 件旋转");
  const upTag = await page.textContent(".goods-item:last-child .dim");
  check("清单显示立放标记", upTag.includes("立放") || upTag.includes("⬆"), "");

  /* 9. 装载步骤面板 */
  await page.click("#btnSteps");
  await page.waitForTimeout(300);
  const stepRows = await page.locator("#stepsBody .step-row").count();
  check("步骤面板有内容", stepRows > 0, stepRows + " 步");
  await page.click("#stepsClose");

  /* 10. 偏载分布条 */
  const hasBalance = await page.locator("#results .balance").count();
  check("偏载分布条渲染", hasBalance === 1, "");

  /* 11. 自定义柜型 */
  await page.selectOption("#containerSel", "custom");
  await page.waitForTimeout(300);
  const cbOpen = await page.evaluate(() => document.getElementById("customBox").classList.contains("open"));
  check("自定义柜型输入框展开", cbOpen, "");
  await page.evaluate(() => {
    document.getElementById("cuL").value = "400"; document.getElementById("cuW").value = "200";
    document.getElementById("cuH").value = "200"; document.getElementById("cuP").value = "10000";
    document.getElementById("cuL").dispatchEvent(new Event("input"));
    document.getElementById("cuW").dispatchEvent(new Event("input"));
    document.getElementById("cuH").dispatchEvent(new Event("input"));
    document.getElementById("cuP").dispatchEvent(new Event("input"));
  });
  await page.click("#btnCalc");
  await page.waitForTimeout(1500);
  const inBounds = await page.evaluate(() => {
    const placed = packResults.containers.flatMap(c => c.placed);
    return placed.every(p => p.x + p.L <= 400.5 && p.y + p.W <= 200.5 && p.z + p.H <= 200.5);
  });
  check("自定义柜 400×200×200 内全部合规", inBounds, "");

  /* 12. PDF 导出（stub window.open 验证调用） */
  await page.evaluate(() => { window.__pdfOpened = false; window.open = () => { window.__pdfOpened = true; return { document: { write() {}, close() {} }, print() {} }; }; });
  await page.click("#btnPdf");
  await page.waitForTimeout(2000);
  const pdfOpened = await page.evaluate(() => window.__pdfOpened);
  check("PDF 报告生成并打开", pdfOpened, "");
  await page.evaluate(() => localStorage.removeItem("zc_company"));

  /* 13. ?lang= 参数（SEO 落地页跳转） */
  const page3 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page3.goto("http://127.0.0.1:8642/index.html?lang=en");
  await page3.waitForTimeout(800);
  const langBtn = (await page3.textContent("#btnCalc")).trim();
  check("?lang=en 生效", langBtn === "Calculate", langBtn);
  await page3.close();

  /* 14. 手机端视口无横向溢出 */
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mob.goto("http://127.0.0.1:8642/index.html", { waitUntil: "networkidle" });
  const overflow = await mob.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  check("手机端无横向溢出", overflow <= 2, "溢出 " + overflow + "px");
  const mobCanvas = await mob.locator(".canvas-wrap canvas").count();
  check("手机端 3D 画布可见", mobCanvas === 1, "");
  await mob.screenshot({ path: "e2e_mobile.png" });
  await mob.close();

  await page.screenshot({ path: "e2e_proof.png", fullPage: false });
  console.log("截图: e2e_proof.png");
  console.log("\n" + (fail === 0 ? "✅ 通过 " + pass + " 项" : "❌ 通过 " + pass + "，失败 " + fail));
  console.log(errors.length ? "❌ JS 错误:\n" + errors.join("\n") : "✅ 无 JS 运行时错误");
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error("E2E 失败:", e.message); process.exit(1); });

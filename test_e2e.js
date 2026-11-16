/* 页面端到端验证 v2：多语言 + 导入 + 分享链接 + 单位 */
"use strict";
const pw = require("playwright-core");
const chromium = (process.env.BROWSER === "webkit") ? pw.webkit : pw.chromium;

(async () => {
  const exe = process.env.HOME + "/.agent-browser/browsers/chrome-152.0.7977.64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
  const browser = await chromium.launch({ headless: true, args: process.env.BROWSER === "webkit" ? ["--no-sandbox"] : [], executablePath: process.env.BROWSER === "webkit" ? undefined : exe });
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

  /* 3b. 新增 15 语言抽查（含 RTL） */
  for (const [lg, expect, rtl] of [["zhTW", "開始計算"], ["ar", "احسب", true], ["he", "חשב", true], ["tr", "Hesapla"], ["pl", "Oblicz"], ["th", "คำนวณ"]]) {
    await page.selectOption("#langSel", lg);
    await page.waitForTimeout(200);
    const txt = (await page.textContent("#btnCalc")).trim();
    check("语言 " + lg, txt === expect, txt);
    if (rtl) {
      const dir = await page.evaluate(() => document.documentElement.dir);
      check("RTL 方向 " + lg, dir === "rtl", dir);
    }
  }
  await page.selectOption("#langSel", "zh");
  await page.waitForTimeout(200);

  /* 3c. v2 分享往返：新字段（承重/优先级/必须底层/间隙）保真 */
  await page.evaluate(() => {
    goods = [{ name: "FragileBox", l: 100, w: 80, h: 60, qty: 10, kg: 90, stack: 3,
      upright: false, maxLoad: 120, priority: 2, mustFloor: true, cylinder: false, overhang: 0.9, color: "#fff" }];
    goodsSeq = 1;
    document.getElementById("advGap").value = "4";
  });
  const hashV2 = await page.evaluate(() => "#d=" + encodeState());
  const page4 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page4.goto("http://127.0.0.1:8642/index.html" + hashV2);
  await page4.waitForTimeout(1500);
  const v2 = await page4.evaluate(() => {
    const g = goods[0];
    return { n: g.name, maxLoad: g.maxLoad, priority: g.priority, mustFloor: g.mustFloor,
             gap: +document.getElementById("advGap").value, placedL: packResults ? packResults.containers[0].placed[0].L : -1 };
  });
  check("v2 分享：maxLoad 恢复 120", v2.maxLoad === 120, JSON.stringify(v2));
  check("v2 分享：priority 2 / mustFloor / gap 4", v2.priority === 2 && v2.mustFloor === true && v2.gap === 4, "");
  check("v2 分享：间隙生效（104）", Math.abs(v2.placedL - 104) < 0.01, String(v2.placedL));
  await page4.close();

  /* 3d. sitemap 与 robots 本地存在 */
  const sm = require("fs").existsSync("seo/sitemap.xml"), rb = require("fs").existsSync("seo/robots.txt");
  check("sitemap.xml + robots.txt 已生成", sm && rb, "");

  /* 3e. 粘贴文件名 → 智能指引；拖放文件 → 导入 */
  await page.click("#btnPasteToggle");
  await page.fill("#pasteTa", "Packing List装箱单-B-UG - EEW20260207.xlsx");
  await page.click("#btnPasteAdd");
  await page.waitForTimeout(300);
  const guideToast = await page.textContent("#toast");
  check("粘贴文件名给出指引", /Excel|导入/.test(guideToast), guideToast.trim().slice(0, 30));
  await page.fill("#pasteTa", "");
  // 拖放 CSV 文件（模拟 drop 事件）
  const dropOk = await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(["钢架\t120\t80\t90\t5\t55\t2"], "drop.csv", { type: "text/csv" }));
    const ev = new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  await page.waitForTimeout(1200);
  const dropCount = await page.evaluate(() => goods.length);
  check("拖放文件导入", dropOk && dropCount >= 1, dropCount + " 项");
  await page.evaluate(() => { goods = []; renderGoodsList(); });
  await page.waitForTimeout(800);

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
  await page.evaluate(() => { document.getElementById("advGap").value = "0"; document.getElementById("advGap").dispatchEvent(new Event("input")); });
  await page.waitForTimeout(1200);
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

  /* 11b. 摆放间隙 */
  await page.evaluate(() => { document.getElementById("advGap").value = "5"; document.getElementById("advGap").dispatchEvent(new Event("input")); });
  await page.waitForTimeout(1500);
  const gapBox = await page.evaluate(() => {
    const placed = packResults.containers.flatMap(c => c.placed);
    const g = goods.find(x => x.name === "Cardbox");
    const p = placed.find(x => x.gi === goods.indexOf(g));
    return p ? p.L + p.W + p.H : -1;
  });
  check("间隙 5cm 生效（三轴和 155）", Math.abs(gapBox - 155) < 0.01, String(gapBox));
  await page.evaluate(() => { document.getElementById("advGap").value = "0"; document.getElementById("advGap").dispatchEvent(new Event("input")); });
  await page.waitForTimeout(1200);

  /* 11c. 打托模式 */
  await page.click("#palletChk");
  await page.waitForTimeout(1500);
  const pallets = await page.evaluate(() => packResults.containers.flatMap(c => c.placed).filter(p => /Pallet/.test(p.name)).length);
  check("打托模式生效（出现 Pallet 项）", pallets > 0, pallets + " 托");
  await page.click("#palletChk");
  await page.waitForTimeout(1200);

  /* 11d. 本地方案库 */
  page.on("dialog", d => d.accept("TestPlan"));
  await page.click("#btnSavePlan");
  await page.waitForTimeout(500);
  const planN = await page.evaluate(() => JSON.parse(localStorage.getItem("zc_plans") || "[]").length);
  check("方案已保存到本地", planN === 1, String(planN));
  await page.reload({ waitUntil: "networkidle" });
  const planOpts = await page.locator("#planSel option").count();
  check("刷新后方案库仍在", planOpts >= 1, String(planOpts));
  await page.selectOption("#planSel", "0");
  await page.waitForTimeout(1500);
  const loaded = await page.evaluate(() => goods.length);
  check("方案载入恢复货物", loaded === 6, String(loaded));
  await page.evaluate(() => localStorage.removeItem("zc_plans"));

  /* 11d2. 公告条：显示 → 关闭 → 刷新不再出现 */
  const annShow = await page.evaluate(() => document.getElementById("annBar").classList.contains("show"));
  check("公告条显示", annShow, "");
  await page.click("#annClose");
  await page.waitForTimeout(200);
  const annHidden = await page.evaluate(() => !document.getElementById("annBar").classList.contains("show"));
  check("公告条关闭", annHidden, "");
  const annPersist = await page.evaluate(() => localStorage.getItem("zc_ann_v7-20261116") === "1");
  check("关闭状态记忆", annPersist, "");
  await page.evaluate(() => localStorage.removeItem("zc_ann_v7-20261116"));

  /* 11e. ULD 预设 + 编辑模式 + 报告选择器 */
  const uldOpt = await page.evaluate(() => [...document.getElementById("containerSel").options].some(o => o.value === "ULD-LD3"));
  check("ULD LD3/PMC 预设存在", uldOpt, "");
  await page.evaluate(() => { document.getElementById("containerSel").value = "ULD-LD3"; document.getElementById("containerSel").dispatchEvent(new Event("change")); });
  await page.waitForTimeout(1500);
  const uldIn = await page.evaluate(() => {
    const placed = packResults.containers.flatMap(c => c.placed);
    return placed.length > 0 && placed.every(p => p.x + p.L <= 201.5 && p.y + p.W <= 153.5 && p.z + p.H <= 160.5);
  });
  check("ULD LD3 内全部合规", uldIn, "");
  await page.evaluate(() => { document.getElementById("containerSel").value = "40HC"; document.getElementById("containerSel").dispatchEvent(new Event("change")); });
  await page.waitForTimeout(1200);
  await page.click("#btnEdit");
  await page.waitForTimeout(300);
  const ctrl = await page.evaluate(() => !controls.enabled);
  check("编辑模式开启（轨道控制暂停）", ctrl, "");
  const editActive = await page.evaluate(() => document.getElementById("btnEdit").classList.contains("active-edit"));
  check("编辑按钮高亮", editActive, "");
  await page.click("#btnEdit");
  await page.click("#btnPdf");
  await page.waitForTimeout(200);
  const rselOpts = await page.locator("#selReportLang option").count();
  check("报告语言选择器（Auto+25）", rselOpts >= 26, String(rselOpts));
  await page.selectOption("#selReportTpl", "det");
  await page.click("#btnPdf"); // 关闭弹层

  /* 11f. 拖拽撤销 + 手机端菜单 */
  await page.click("#btnEdit");
  await page.waitForTimeout(300);
  const undoRes = await page.evaluate(() => {
    const b = packResults.containers[0].placed[0];
    const orig = b.x;
    undoStack.push({ box: b, x: orig, y: b.y });
    b.x = orig + 50;
    undoDrag();
    return { back: b.x === orig, stackLen: undoStack.length };
  });
  check("拖拽撤销恢复原位", undoRes.back, JSON.stringify(undoRes));
  await page.click("#btnEdit");
  const undoBtnHidden = await page.evaluate(() => document.getElementById("btnUndo").style.display === "none");
  check("退出编辑后撤销按钮隐藏", undoBtnHidden, "");
  // 手机端菜单
  const mobMenu = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobMenu.goto("http://127.0.0.1:8642/index.html", { waitUntil: "networkidle" });
  const moreVisible = await mobMenu.evaluate(() => getComputedStyle(document.getElementById("btnMore")).display !== "none");
  check("手机端 ⚙ 按钮可见", moreVisible, "");
  await mobMenu.click("#btnMore");
  await mobMenu.waitForTimeout(200);
  const menuOpen = await mobMenu.evaluate(() => {
    const m = document.getElementById("moreMenu");
    return m.classList.contains("open") && m.querySelectorAll("button").length >= 7;
  });
  check("手机端菜单展开（≥7 项）", menuOpen, "");
  const menuCovers = await mobMenu.evaluate(() => {
    const b = document.getElementById("btnSteps");
    return b.offsetHeight > 0; // 菜单内的步骤按钮可见
  });
  check("菜单含装载步骤/PDF", menuCovers, "");
  await mobMenu.close();

  /* 12. PDF 导出（stub window.open 验证调用） */
  await page.evaluate(() => { window.__pdfOpened = false; window.open = () => { window.__pdfOpened = true; return { document: { write() {}, close() {} }, print() {} }; }; });
  await page.click("#btnPdf");
  await page.waitForTimeout(300);
  const popOpen = await page.evaluate(() => document.getElementById("pdfPop").classList.contains("open"));
  check("PDF 设置弹层展开", popOpen, "");
  const rselOpts2 = await page.locator("#selReportLang option").count();
  check("报告语言选择器在弹层内（Auto+25）", rselOpts2 >= 26, String(rselOpts2));
  await page.click("#btnGenPdf");
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

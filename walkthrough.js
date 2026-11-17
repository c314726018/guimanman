/* 浏览器级全站走查（发布前固定流程）
 * 用法: node walkthrough.js local|live
 * 内容: 逐页真实渲染 + 资源加载监控 + JS 错误捕获 + 截图目检
 *       + 全站链接 HTTP 校验 + 代表页全链接点击 + 应用交互冒烟
 */
"use strict";
const pw = require("playwright-core");
const chromium = (process.env.BROWSER === "webkit") ? pw.webkit : pw.chromium;
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const EXE = process.env.HOME + "/.agent-browser/browsers/chrome-152.0.7977.64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const SEO_LANGS = ["en","es","pt","de","fr","vi","ja","ko","ru","zhTW","it","nl","pl","tr","id","ms","fi","sv","cs","hu","el","th","ar","he"];
const OUT = path.join(__dirname, "walkthrough");
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0, warns = 0;
const issues = [];
function check(name, cond, detail, warnOnly) {
  if (cond) { pass++; console.log("  ✅ " + name + (detail ? "  " + detail : "")); }
  else if (warnOnly) { warns++; console.log("  ⚠️ " + name + "  " + (detail || "")); }
  else { fail++; issues.push(name + " " + (detail || "")); console.log("  ❌ " + name + "  " + (detail || "")); }
}

async function walkPage(page, url, name, base) {
  const errors = [], badRes = [], failed = [];
  page.on("pageerror", e => errors.push(e.message.slice(0, 150)));
  page.on("console", m => { if (m.type() === "error" && !/favicon|net::ERR_ABORTED/.test(m.text())) errors.push(m.text().slice(0, 150)); });
  page.on("response", r => { if (r.url().startsWith(base) && r.status() >= 400) badRes.push(r.status() + " " + r.url().replace(base, "")); });
  page.on("requestfailed", r => { if (r.url().startsWith(base)) failed.push(r.url().replace(base, "")); });
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, name + ".png") });
  await checkOverlaps(page, name, url.includes("/seo/") ? 260 : undefined);
  return { errors, badRes, failed };
}

/* 布局重叠检测器：扫描顶级 UI 面板互相遮挡（顶栏重复/图例爆表类 bug 的自动捕获） */
const UI_PANELS = ["header", "#annBar", ".sidebar", ".results", "#stepsPanel", "#legend",
  "#editTools", "#toast", "#containerTabs", "#pdfPop", "#moreMenu", ".empty-tip",
  "article", "footer"];
function overlapCheckSrc() {
  return () => {
    const els = UI_PANELS_SRC.map(s2 => {
      const el = document.querySelector(s2);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const vis = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      return vis && r.width > 10 && r.height > 10 ? { s: s2, el, r } : null;
    }).filter(Boolean);
    const out = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const A = els[i], B = els[j];
      if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
      const ox = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
      const oy = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
      if (ox <= 0 || oy <= 0) continue;
      const smaller = Math.min(A.r.width * A.r.height, B.r.width * B.r.height);
      const ratio = (ox * oy) / smaller * 100;
      if (ratio > 15) out.push(A.s + "×" + B.s + " " + Math.round(ratio) + "%");
    }
    const hdr = document.querySelector("header");
    return { overlaps: out, headerH: hdr ? Math.round(hdr.getBoundingClientRect().height) : 0, vw: innerWidth };
  };
}
const UI_PANELS_SRC = JSON.stringify(UI_PANELS);
async function checkOverlaps(page, name, maxHeaderH) {
  maxHeaderH = maxHeaderH || (name.startsWith("SEO") || name.startsWith("手机") ? 260 : 170);
  const rr = await page.evaluate(function (UI_PANELS_SRC) {
    const els = UI_PANELS_SRC.map(s2 => {
      const el = document.querySelector(s2);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const vis = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      return vis && r.width > 10 && r.height > 10 ? { s: s2, el, r } : null;
    }).filter(Boolean);
    const out = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const A = els[i], B = els[j];
      if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
      const ox = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
      const oy = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
      if (ox <= 0 || oy <= 0) continue;
      const smaller = Math.min(A.r.width * A.r.height, B.r.width * B.r.height);
      const ratio = (ox * oy) / smaller * 100;
      if (ratio > 15) out.push(A.s + "\u00d7" + B.s + " " + Math.round(ratio) + "%");
    }
    const hdr = document.querySelector("header");
    return { overlaps: out, headerH: hdr ? Math.round(hdr.getBoundingClientRect().height) : 0, vw: innerWidth };
  }, UI_PANELS);
  for (const o of rr.overlaps) {
    const pct = parseInt(o.match(/(\d+)%$/)[1]);
    if (pct > 60) {
      fail++; issues.push("视觉重叠[" + name + "] " + o);
      console.log("  \u274c 视觉重叠[" + name + "] " + o);
    } else { warns++; console.log("  \u26a0\ufe0f 视觉重叠[" + name + "] " + o); }
  }
  if (rr.vw > 900 && rr.headerH > maxHeaderH) {
    fail++; issues.push("顶栏异常[" + name + "] 高度 " + rr.headerH + "px");
    console.log("  \u274c 顶栏异常[" + name + "] 高度 " + rr.headerH + "px");
  } else if (rr.vw <= 900 && rr.headerH > maxHeaderH - 20) {
    warns++; console.log("  \u26a0\ufe0f 顶栏偏高[" + name + "] " + rr.headerH + "px");
  }
}

async function collectLinks(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("a[href]")]
      .map(a => ({ href: a.href, text: (a.textContent || "").trim().slice(0, 20) }))
      .filter(l => !l.href.startsWith("javascript")));
}

(async () => {
  const mode = process.argv[2] || "local";
  let server = null;
  let base;
  if (mode === "live") {
    base = "https://c314726018.github.io/guimanman";
  } else {
    server = spawn("python3", ["-m", "http.server", "8643", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" });
    await new Promise(r => setTimeout(r, 1200));
    base = "http://127.0.0.1:8643";
  }

  const browser = await chromium.launch({ headless: true, args: process.env.BROWSER === "webkit" ? ["--no-sandbox"] : [], executablePath: process.env.BROWSER === "webkit" ? undefined : EXE });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const waitCalc = async () => {
    try { await page.waitForFunction(() => window.__calcRunning === false, null, { timeout: 30000 }); } catch (e) {}
    await page.waitForTimeout(150);
  };
  const allLinks = new Set();

  console.log(`\n===== 全站走查（${mode}）=====\n—— 逐页渲染（25 页）——`);

  // 主应用
  {
    const r = await walkPage(page, base + "/", "app-desktop", base);
    check("主应用渲染无 JS 错误", r.errors.length === 0, r.errors.join(";") || "");
    check("主应用资源加载正常", r.badRes.length === 0 && r.failed.length === 0, (r.badRes.concat(r.failed)).join(",") || "");
    // 交互冒烟
    await page.click("#btnSample");
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ({
      pr: !!packResults, boxes: packResults ? packResults.containers.reduce((s, c) => s + c.placed.length, 0) : 0,
      chips: document.querySelectorAll("#results .chip").length }));
    check("示例计算完成（208 件）", st.pr && st.boxes === 208 && st.chips >= 4, JSON.stringify(st));
    await page.click("#btnSteps"); await page.waitForTimeout(300);
    check("步骤面板打开", await page.evaluate(() => document.getElementById("stepsPanel").classList.contains("open")), "");
    await page.click("#stepsClose");
    await page.click("#btnEdit"); await page.waitForTimeout(200);
    check("编辑模式切换", await page.evaluate(() => editMode === true), "");
    await page.click("#btnEdit"); await page.waitForTimeout(200);
    await page.evaluate(() => { document.getElementById("containerSel").value = "ULD-LD3"; document.getElementById("containerSel").dispatchEvent(new Event("change")); });
    await page.waitForTimeout(1200);
    check("ULD 切换正常", await page.evaluate(() => packResults.containers.every(c => c.placed.every(p => p.x + p.L <= 202 && p.y + p.W <= 154 && p.z + p.H <= 161))), "");
    await page.evaluate(() => { document.getElementById("containerSel").value = "40HC"; document.getElementById("containerSel").dispatchEvent(new Event("change")); });
    await page.waitForTimeout(1000);
    // 大货量图例回归：成捆模式下图例不得铺满画布
    await page.evaluate(() => {
      goods = [
        { name: "背胶型橡塑铝箔隔热棉", l: 60, w: 30, h: 30, qty: 3812, kg: 2.45, stack: 20, color: "#3b82f6" },
        { name: "背胶型橡塑铝箔隔热棉 B", l: 60, w: 30, h: 30, qty: 1028, kg: 2.45, stack: 20, color: "#f59e0b" },
      ];
      goodsSeq = 2;
      renderGoodsList();
      calc(true);
    });
    await waitCalc();
    await page.waitForTimeout(400);
    const legendRows = await page.evaluate(() => document.querySelectorAll("#legend div").length);
    check("大货量图例 ≤ 7 行（回归守卫）", legendRows <= 7, legendRows + " 行");
    await checkOverlaps(page, "大货量图例");
    await page.evaluate(() => { goods = []; renderGoodsList(); });
    // 链接收集
    (await collectLinks(page)).forEach(l => allLinks.add(l.href));
    // 手机端
    const mob = await ctx.newPage();
    await mob.setViewportSize({ width: 390, height: 844 });
    await mob.goto(base + "/", { waitUntil: "networkidle" });
    await checkOverlaps(mob, "手机端默认态");
    await mob.click("#btnMore"); await mob.waitForTimeout(250);
    check("手机端 ⚙ 菜单展开", await mob.evaluate(() => document.getElementById("moreMenu").classList.contains("open")), "");
    await mob.screenshot({ path: path.join(OUT, "app-mobile-menu.png") });
    await mob.close();
    console.log("  📸 app-desktop.png / app-mobile-menu.png");
  }

  // 24 个 SEO 页
  for (const l of SEO_LANGS) {
    const r = await walkPage(page, base + "/seo/" + l + ".html", "seo-" + l, base);
    const name = "SEO " + l;
    check(name + " 无 JS 错误", r.errors.length === 0, r.errors.join(";") || "");
    check(name + " 资源正常", r.badRes.length === 0 && r.failed.length === 0, (r.badRes.concat(r.failed)).join(",") || "");
    const h1 = await page.textContent("h1").catch(() => "");
    check(name + " 有 H1", h1 && h1.trim().length > 0, h1.trim().slice(0, 30));
    const cta = await page.getAttribute(".cta", "href").catch(() => null);
    check(name + " CTA 存在", !!cta, cta || "");
    (await collectLinks(page)).forEach(l2 => allLinks.add(l2.href));
    await checkOverlaps(page, "SEO " + l);
    console.log("  📸 seo-" + l + ".png");
  }

  // 全站链接 HTTP 校验
  console.log("\n—— 全站链接 HTTP 校验（" + allLinks.size + " 个唯一链接）——");
  let linkBad = 0, linkOk = 0;
  for (const href of allLinks) {
    let u = href;
    if (u.startsWith("/") && mode === "live") u = "https://c314726018.github.io" + u;
    if (u.startsWith("/") && mode !== "live") u = base + u;
    try {
      const resp = await page.request.get(u, { maxRedirects: 3 }).catch(e => ({ status: -1, err: e.message.slice(0, 60) }));
      const st = typeof resp.status === "function" ? resp.status() : resp.status;
      const external = !u.startsWith(base);
      if (st >= 0 && st < 400) linkOk++;
      else if (external) { warns++; console.log("  ⚠️ 外链超时（非阻断）" + u); }
      else { linkBad++; issues.push("链接 " + st + " " + u + " " + (resp.err || "")); console.log("  ❌ 链接 " + st + " " + u + " " + (resp.err || "")); }
    } catch (e) { linkBad++; console.log("  ❌ 链接异常 " + u + " " + e.message.slice(0, 60)); }
  }
  check("全部链接可达 (" + linkOk + "/" + allLinks.size + ")", linkBad === 0, linkBad + " 个失败");

  // 代表页全链接点击（主站：逐个真实点击并返回）
  console.log("\n—— 主站链接真实点击 ——");
  await page.goto(base + "/", { waitUntil: "networkidle" });
  const links = await collectLinks(page);
  const clicked = new Set();
  let clickBad = 0, clickOk = 0;
  for (const l of links) {
    let u = l.href;
    if (u.startsWith("/") && mode === "live") u = "https://c314726018.github.io" + u;
    if (u.startsWith("/") && mode !== "live") u = base + u;
    // 本地模式：指向线上的链接映射回本地，避免外网波动干扰走查
    if (mode !== "live") u = u.replace("https://c314726018.github.io/guimanman", base);
    if (clicked.has(u)) continue;
    clicked.add(u);
    try {
      await page.goto(u, { waitUntil: "domcontentloaded", timeout: 30000 });
      clickOk++;
      await page.goBack({ waitUntil: "domcontentloaded" });
    } catch (e) {
      if (!u.startsWith(base)) { warns++; console.log("  ⚠️ 外链点击超时（非阻断）" + u); await page.goto(base + "/", { waitUntil: "domcontentloaded" }); continue; }
      clickBad++; console.log("  ❌ 点击失败 " + u); await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    }
  }
  check("主站全部链接真实点击通过 (" + clickOk + ")", clickBad === 0, clickBad + " 个失败");

  // 代表 SEO 页全链接真实点击（en 页：24 个语言链接 + CTA + 中文）
  console.log("\n—— SEO en 页链接真实点击 ——");
  await page.goto(base + "/seo/en.html", { waitUntil: "networkidle" });
  const seoLinks = await collectLinks(page);
  const doneSet = new Set();
  let seoBad = 0, seoOk = 0;
  for (const l of seoLinks) {
    let u = l.href;
    if (u.startsWith("/") && mode === "live") u = "https://c314726018.github.io" + u;
    if (u.startsWith("/") && mode !== "live") u = base + u;
    if (doneSet.has(u)) continue;
    doneSet.add(u);
    try {
      await page.goto(u, { waitUntil: "domcontentloaded", timeout: 30000 });
      seoOk++;
      await page.goto(base + "/seo/en.html", { waitUntil: "domcontentloaded" });
    } catch (e) { seoBad++; console.log("  ❌ 点击失败 " + u); await page.goto(base + "/seo/en.html", { waitUntil: "domcontentloaded" }); }
  }
  check("SEO en 页全部链接真实点击通过 (" + seoOk + ")", seoBad === 0, seoBad + " 个失败");

  // 旧链接跳转（仅线上）
  if (mode === "live") {
    const resp = await page.request.get("https://c314726018.github.io/container-load-planner/");
    check("旧链接跳转页 200", resp.status() === 200, String(resp.status()));
  }

  await browser.close();
  if (server) server.kill();

  console.log("\n===== 走查汇总 =====");
  console.log(`✅ 通过 ${pass} ｜ ⚠️ 提醒 ${warns} ｜ ❌ 失败 ${fail}`);
  if (issues.length) console.log("问题清单:\n" + issues.map(i => "  - " + i).join("\n"));
  console.log(fail === 0 ? "🟢 全站走查通过，可以发布" : "🔴 存在问题，修复后再发布");
  fs.writeFileSync(path.join(OUT, "report-" + mode + ".txt"), `walkthrough ${mode} ${new Date().toISOString()} pass=${pass} warn=${warns} fail=${fail}\n` + issues.join("\n"));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("走查脚本异常:", e.message); process.exit(1); });

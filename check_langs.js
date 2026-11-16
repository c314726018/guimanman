/* 25 语言全切换压测：每种语言切换后捕获 JS 错误 + 验证关键 UI 元素有文本 */
"use strict";
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/.agent-browser/browsers/chrome-152.0.7977.64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const BASE = process.argv[2] || "http://127.0.0.1:8643";
const RTL = ["ar", "he"];

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message.slice(0, 120)));
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 45000 });
  await page.click("#btnSample");
  await page.waitForTimeout(1200);

  let pass = 0, fail = 0;
  for (const lg of ["zh","en","es","pt","de","fr","vi","ja","ko","ru","zhTW","it","nl","pl","tr","id","ms","fi","sv","cs","hu","el","th","ar","he"]) {
    await page.selectOption("#langSel", lg);
    await page.waitForTimeout(250);
    const st = await page.evaluate((lg) => {
      const R = I18N[lg];
      const txt = (id) => { const el = document.getElementById(id); return el ? el.textContent.trim() : "<null>"; };
      return {
        calc: txt("btnCalc"), steps: txt("btnSteps"), title: document.title,
        dir: document.documentElement.dir,
        calcOk: txt("btnCalc") === R.calc, stepsOk: txt("btnSteps") === R.steps,
        h1ok: txt("hTitle").includes(R.app), titleOk: document.title === R.title,
        chips: document.querySelectorAll("#results .chip").length,
      };
    }, lg);
    const ok = st.calcOk && st.stepsOk && st.h1ok && st.titleOk && st.chips > 0;
    const rtlOk = RTL.includes(lg) ? st.dir === "rtl" : st.dir === "ltr";
    if (ok && rtlOk && errors.length === 0) { pass++; console.log("  ✅ " + lg); }
    else { fail++; console.log("  ❌ " + lg + " " + JSON.stringify(st) + " rtl=" + st.dir + " err=" + errors.join(";").slice(0, 80)); errors.length = 0; }
  }
  console.log(fail === 0 ? "✅ 25 语言全切换压测通过 " + pass + "/25" : "❌ 失败 " + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("异常:", e.message); process.exit(1); });

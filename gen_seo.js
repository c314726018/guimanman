/* SEO 落地页生成器：node gen_seo.js 生成 seo/*.html */
"use strict";
const fs = require("fs");
const path = require("path");

const BASE = ""; // 部署时填域名，如 https://loadplanner.example
const APP = "../index.html";

const PAGES = [
  {
    lang: "en", file: "en.html",
    title: "Free Container Load Planner — 3D Loading Calculator for Sea Freight",
    desc: "Free online 3D container loading calculator. Plan cargo placement in 20GP/40GP/40HC/45HC containers, stacking rules, weight distribution, Excel import and shareable load plans.",
    h1: "Container Load Planner",
    sub: "Plan how your cargo fits a sea container — 3D visualization, stacking rules and weight balance. Free to use, no sign-up.",
    cta: "Open the Load Planner — it's free",
    features: [
      ["3D load visualization", "Rotate and zoom the plan; every item is color-coded so warehouse staff can follow it."],
      ["Stacking rules", "Set max stack layers per item — lithium batteries, fragile or crushable goods handled correctly."],
      ["Keep upright", "Lock items that must not be rotated (liquids, electronics, machinery)."],
      ["Weight distribution", "Front/rear and left/right balance check to avoid lopsided containers."],
      ["Excel & CSV import", "Paste your packing list or import a spreadsheet — multi-language column headers recognized."],
      ["Shareable plans", "Send a link to colleagues; they open the exact same plan, no account needed."],
    ],
    faq: [
      ["Is it really free?", "Yes. All features are free to use in the current version."],
      ["Which containers are supported?", "20GP, 40GP, 40HC, 45HC standard internal dimensions, plus fully custom cargo spaces."],
      ["Do I need to install anything?", "No. It runs in your browser on desktop and mobile."],
    ],
  },
  {
    lang: "es", file: "es.html",
    title: "Planificador de Carga de Contenedores Gratis — Calculadora 3D",
    desc: "Calculadora gratuita de carga de contenedores 3D. Planifique la colocación de carga en contenedores 20GP/40GP/40HC/45HC con reglas de apilado, distribución de peso e importación de Excel.",
    h1: "Planificador de Carga de Contenedores",
    sub: "Planifique cómo se ajusta su carga al contenedor — visualización 3D, reglas de apilado y equilibrio de peso. Gratis, sin registro.",
    cta: "Abrir el planificador — es gratis",
    features: [
      ["Visualización 3D", "Rote y acerque el plan; cada artículo tiene su color para que el almacén siga el plan."],
      ["Reglas de apilado", "Capas máximas por artículo — baterías de litio y mercancía frágil bien gestionadas."],
      ["Mantener vertical", "Fije artículos que no deben rotarse (líquidos, electrónica, maquinaria)."],
      ["Distribución de peso", "Verificación de equilibrio frente/atrás e izquierda/derecha."],
      ["Importar Excel y CSV", "Pegue su lista de empaque o importe una hoja de cálculo."],
      ["Planes compartibles", "Envíe un enlace a colegas; abren exactamente el mismo plan."],
    ],
    faq: [
      ["¿Es realmente gratis?", "Sí. Todas las funciones son gratuitas en la versión actual."],
      ["¿Qué contenedores están soportados?", "20GP, 40GP, 40HC y 45HC con dimensiones internas estándar, más espacios personalizados."],
      ["¿Necesito instalar algo?", "No. Funciona en su navegador, en escritorio y móvil."],
    ],
  },
  {
    lang: "ja", file: "ja.html",
    title: "コンテナ積載計算 無料 — 3D積載シミュレーション",
    desc: "無料のオンライン3Dコンテナ積載計算。20GP/40GP/40HC/45HCへの積み付け計画、積載段数ルール、重量配分、Excel取込、共有リンクに対応。",
    h1: "コンテナ積載計算ツール",
    sub: "コンテナへの積み付けを3Dで可視化 — 積載段数ルール、重量配分チェック。無料・登録不要。",
    cta: "計算ツールを開く（無料）",
    features: [
      ["3D可視化", "回転・ズーム可能。品目ごとに色分けし、倉庫作業員が従いやすい。"],
      ["積載段数ルール", "品目ごとに最大段数を設定 — リチウムイオン電池や壊れ物も正しく処理。"],
      ["回転禁止", "倒してはいけない品目（液体・電子機器・機械）を固定。"],
      ["重量配分", "前後・左右の偏荷重チェックで片寄りを防止。"],
      ["Excel・CSV取込", "パッキングリストを貼り付けまたはファイル取込。多言語ヘッダー対応。"],
      ["共有リンク", "リンクを送るだけで同じ計画を開けます。アカウント不要。"],
    ],
    faq: [
      ["本当に無料ですか？", "はい。現在のバージョンは全機能無料です。"],
      ["対応コンテナは？", "20GP・40GP・40HC・45HCの標準内寸、plus カスタムサイズにも対応。"],
      ["インストールは必要？", "不要です。ブラウザで動作します（PC・モバイル両対応）。"],
    ],
  },
  {
    lang: "ko", file: "ko.html",
    title: "무료 컨테이너 적재 계산기 — 3D 최적화",
    desc: "무료 온라인 3D 컨테이너 적재 계산기. 20GP/40GP/40HC/45HC 적재 계획, 적층 규칙, 중량 분포, Excel 가져오기, 공유 링크 지원.",
    h1: "컨테이너 적재 계산기",
    sub: "컨테이너에 화물이 어떻게 들어가는지 3D로 확인 — 적층 규칙, 중량 균형 체크. 무료, 가입 불필요.",
    cta: "계산기 열기（무료）",
    features: [
      ["3D 시각화", "회전·확대 가능. 품목별 색상으로 창고 작업자가 따라하기 쉽습니다."],
      ["적층 규칙", "품목별 최대 적층수 설정 — 리튬전지, 파손 위험 화물 안전 처리."],
      ["회전 금지", "눕히면 안 되는 품목(액체, 전자제품, 기계) 고정."],
      ["중량 분포", "전후·좌우 편중 체크로 한쪽 쏠림 방지."],
      ["Excel·CSV 가져오기", "포장 목록을 붙여넣거나 파일 가져오기. 다국어 헤더 인식."],
      ["공유 링크", "링크만 보내면 동료가 동일한 계획을 열 수 있습니다."],
    ],
    faq: [
      ["정말 무료인가요?", "네. 현재 버전의 모든 기능이 무료입니다."],
      ["지원 컨테이너는?", "20GP, 40GP, 40HC, 45HC 표준 내부 치수 및 사용자 지정 크기."],
      ["설치가 필요한가요?", "아니요. 브라우저에서 바로 실행됩니다(데스크톱·모바일)."],
    ],
  },
  {
    lang: "ru", file: "ru.html",
    title: "Бесплатный калькулятор загрузки контейнеров — 3D",
    desc: "Бесплатный онлайн 3D-калькулятор загрузки контейнеров. Планирование размещения грузов в 20GP/40GP/40HC/45HC, правила штабелирования, распределение веса, импорт Excel.",
    h1: "Калькулятор загрузки контейнеров",
    sub: "Планируйте размещение груза в контейнере — 3D-визуализация, правила штабелирования и баланс веса. Бесплатно, без регистрации.",
    cta: "Открыть калькулятор — бесплатно",
    features: [
      ["3D-визуализация", "Вращайте и приближайте план; каждый груз своим цветом."],
      ["Правила штабелирования", "Макс. число слоёв для каждого груза — литий-батареи и хрупкие товары."],
      ["Без поворота", "Фиксируйте грузы, которые нельзя ставить на бок."],
      ["Распределение веса", "Проверка баланса перед/зад и лево/право."],
      ["Импорт Excel и CSV", "Вставьте список или импортируйте таблицу — многоязычные заголовки."],
      ["Общий доступ", "Отправьте ссылку — коллеги откроют тот же план."],
    ],
    faq: [
      ["Это действительно бесплатно?", "Да. Все функции текущей версии бесплатны."],
      ["Какие контейнеры поддерживаются?", "20GP, 40GP, 40HC, 45HC со стандартными внутренними размерами, плюс свои размеры."],
      ["Нужно что-то устанавливать?", "Нет. Работает в браузере на компьютере и телефоне."],
    ],
  },
];

const style = `body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;margin:0;color:#1a1a1a;line-height:1.7}
header{background:#1e293b;color:#fff;padding:28px 20px;text-align:center}
header h1{font-size:26px;margin:0 0 8px}header p{color:#94a3b8;max-width:640px;margin:8px auto}
.wrap{max-width:880px;margin:0 auto;padding:32px 20px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.card{background:#fff;border:1px solid #e2e5ea;border-radius:10px;padding:18px}
.card b{color:#1d4ed8}.card p{font-size:14px;color:#475569;margin:6px 0 0}
.cta{display:block;width:max-content;margin:32px auto;background:#2563eb;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600}
.faq div{background:#f6f8fb;border-radius:8px;padding:14px 18px;margin:10px 0}
.faq b{display:block;margin-bottom:4px}
footer{text-align:center;color:#94a3b8;font-size:13px;padding:24px}
.langs{font-size:12px;margin-top:10px}.langs a{color:#93c5fd;margin:0 6px;text-decoration:none}
@media(max-width:600px){header h1{font-size:20px}}`;

let hreflang = PAGES.map(p => `<link rel="alternate" hreflang="${p.lang}" href="${BASE}/${p.file}">`).join("\n");
hreflang += `\n<link rel="alternate" hreflang="zh" href="${BASE}/../index.html">`;

for (const p of PAGES) {
  const html = `<!DOCTYPE html>
<html lang="${p.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${p.title}</title>
<meta name="description" content="${p.desc}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E📦%3C/text%3E%3C/svg%3E">
${hreflang}
<style>${style}</style>
</head>
<body>
<header>
  <h1>📦 ${p.h1}</h1>
  <p>${p.sub}</p>
  <div class="langs">${PAGES.map(x => `<a href="${x.file}" hreflang="${x.lang}">${x.lang.toUpperCase()}</a>`).join("")} · <a href="../index.html">中文</a></div>
</header>
<div class="wrap">
  <div class="grid">
    ${p.features.map(([b, d]) => `<div class="card"><b>${b}</b><p>${d}</p></div>`).join("\n    ")}
  </div>
  <a class="cta" href="${APP}?lang=${p.lang}">${p.cta} →</a>
  <h2>FAQ</h2>
  <div class="faq">
    ${p.faq.map(([q, a]) => `<div><b>${q}</b>${a}</div>`).join("\n    ")}
  </div>
</div>
<footer>📦 ${p.h1} — Free Container Load Planning Tool</footer>
</body>
</html>`;
  fs.writeFileSync(path.join(__dirname, "seo", p.file), html);
  console.log("生成 seo/" + p.file);
}
console.log("完成");

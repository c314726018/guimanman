/* SEO 落地页生成器：node gen_seo.js 生成 seo/*.html */
"use strict";
const fs = require("fs");
const path = require("path");

const BASE = "https://c314726018.github.io/guimanman"; // 绑定自定义域名后改为正式域名
const BRAND = "GuiManMan"; // 柜满满
const RTL_LANGS = ["ar", "he"];
const EXTRA_PAGES = require("./seo-extra.js");
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
  {
    lang: "vi", file: "vi.html",
    title: "Tính toán xếp container miễn phí — 3D",
    desc: "Công cụ tính xếp container 3D miễn phí trực tuyến. Lên kế hoạch xếp hàng vào container 20GP/40GP/40HC/45HC, quy tắc xếp tầng, phân bố trọng lượng, nhập Excel, liên kết chia sẻ.",
    h1: "Công cụ xếp container",
    sub: "Lên kế hoạch xếp hàng vào container với hình ảnh 3D — quy tắc xếp tầng, cân bằng trọng lượng. Miễn phí, không cần đăng ký.",
    cta: "Mở công cụ tính toán — miễn phí",
    features: [
      ["Hình ảnh 3D", "Xoay và phóng to phương án; mỗi mặt hàng một màu để nhân viên kho dễ làm theo."],
      ["Quy tắc xếp tầng", "Số tầng tối đa cho từng mặt hàng — pin lithium, hàng dễ vỡ được xử lý đúng."],
      ["Cấm xoay", "Khai báo mặt hàng không được đặt nằm (chất lỏng, đồ điện tử, máy móc)."],
      ["Phân bố trọng lượng", "Kiểm tra cân bằng trước/sau và trái/phải, tránh container lệch tải."],
      ["Nhập Excel và CSV", "Dán danh sách đóng gói hoặc nhập tệp — nhận diện tiêu đề nhiều ngôn ngữ."],
      ["Chia sẻ phương án", "Gửi liên kết cho đồng nghiệp; họ mở đúng phương án đó, không cần tài khoản."],
    ],
    faq: [
      ["Có thực sự miễn phí không?", "Có. Mọi tính năng của phiên bản hiện tại đều miễn phí."],
      ["Hỗ trợ những loại container nào?", "20GP, 40GP, 40HC, 45HC theo kích thước trong chuẩn, cộng thêm kích thước tùy chọn."],
      ["Có cần cài đặt gì không?", "Không. Chạy trực tiếp trong trình duyệt trên máy tính và điện thoại."],
    ],
  },
  {
    lang: "pt", file: "pt.html",
    title: "Calculadora Gratuita de Carga de Contêineres — 3D",
    desc: "Calculadora online gratuita de carga de contêineres em 3D. Planeje a carga em contêineres 20GP/40GP/40HC/45HC, regras de empilhamento, distribuição de peso, importação de Excel.",
    h1: "Planejador de carga de contêineres",
    sub: "Planeje como sua carga cabe no contêiner — visualização 3D, regras de empilhamento e equilíbrio de peso. Grátis, sem cadastro.",
    cta: "Abrir o planejador — é grátis",
    features: [
      ["Visualização 3D", "Gire e amplie o plano; cada item com sua cor para o armazém seguir."],
      ["Regras de empilhamento", "Camadas máximas por item — baterias de lítio e cargas frágeis tratadas corretamente."],
      ["Manter vertical", "Fixe itens que não podem ser rotacionados (líquidos, eletrônicos, máquinas)."],
      ["Distribuição de peso", "Verificação de equilíbrio frente/trás e esquerda/direita."],
      ["Importar Excel e CSV", "Cole sua lista de embalagem ou importe uma planilha."],
      ["Planos compartilháveis", "Envie um link; colegas abrem exatamente o mesmo plano."],
    ],
    faq: [
      ["É realmente grátis?", "Sim. Todos os recursos da versão atual são gratuitos."],
      ["Quais contêineres são suportados?", "20GP, 40GP, 40HC, 45HC com dimensões internas padrão, mais tamanhos personalizados."],
      ["Preciso instalar algo?", "Não. Funciona no navegador, no computador e no celular."],
    ],
  },
  {
    lang: "de", file: "de.html",
    title: "Kostenloser Container-Ladungsplaner — 3D-Rechner",
    desc: "Kostenloser Online-3D-Container-Ladungsrechner. Ladungsplanung für 20GP/40GP/40HC/45HC, Stapelregeln, Gewichtsverteilung, Excel-Import und teilbare Ladungspläne.",
    h1: "Container-Ladungsplaner",
    sub: "Planen Sie, wie Ihre Ware in den Container passt — 3D-Visualisierung, Stapelregeln und Gewichtsverteilung. Kostenlos, ohne Anmeldung.",
    cta: "Ladungsplaner öffnen — kostenlos",
    features: [
      ["3D-Visualisierung", "Plan drehen und zoomen; jeder Artikel farbcodiert, damit das Lager folgen kann."],
      ["Stapelregeln", "Max. Stapelebenen pro Artikel — Lithiumbatterien und bruchempfindliche Waren korrekt behandelt."],
      ["Aufrecht lassen", "Artikel fixieren, die nicht gedreht werden dürfen (Flüssigkeiten, Elektronik, Maschinen)."],
      ["Gewichtsverteilung", "Prüfung vorne/hinten und links/rechts gegen einseitige Belastung."],
      ["Excel- und CSV-Import", "Packliste einfügen oder Tabelle importieren — mehrsprachige Spaltenköpfe erkannt."],
      ["Teilbare Pläne", "Link an Kollegen senden; sie öffnen exakt denselben Plan, ohne Konto."],
    ],
    faq: [
      ["Ist es wirklich kostenlos?", "Ja. Alle Funktionen der aktuellen Version sind kostenlos."],
      ["Welche Container werden unterstützt?", "20GP, 40GP, 40HC, 45HC mit Standard-Innenmaßen, plus eigene Maße."],
      ["Muss ich etwas installieren?", "Nein. Läuft im Browser auf Desktop und Mobilgerät."],
    ],
  },
  {
    lang: "fr", file: "fr.html",
    title: "Planificateur de chargement de conteneurs gratuit — 3D",
    desc: "Calculateur 3D gratuit de chargement de conteneurs en ligne. Planifiez le fret dans des conteneurs 20GP/40GP/40HC/45HC, règles d'empilage, répartition du poids, import Excel.",
    h1: "Planificateur de chargement de conteneurs",
    sub: "Planifiez comment votre fret tient dans le conteneur — visualisation 3D, règles d'empilage et équilibre du poids. Gratuit, sans inscription.",
    cta: "Ouvrir le planificateur — c'est gratuit",
    features: [
      ["Visualisation 3D", "Faites tourner et zoomez le plan ; chaque article est codé par couleur pour l'entrepôt."],
      ["Règles d'empilage", "Couches max. par article — batteries lithium et marchandises fragiles bien gérées."],
      ["Rester debout", "Verrouillez les articles qui ne doivent pas être tournés (liquides, électronique, machines)."],
      ["Répartition du poids", "Contrôle d'équilibre avant/arrière et gauche/droite pour éviter les conteneurs déséquilibrés."],
      ["Import Excel et CSV", "Collez votre liste ou importez un tableur — en-têtes multilingues reconnus."],
      ["Plans partageables", "Envoyez un lien aux collègues ; ils ouvrent exactement le même plan, sans compte."],
    ],
    faq: [
      ["C'est vraiment gratuit ?", "Oui. Toutes les fonctions de la version actuelle sont gratuites."],
      ["Quels conteneurs sont pris en charge ?", "20GP, 40GP, 40HC, 45HC aux dimensions intérieures standard, plus des dimensions personnalisées."],
      ["Faut-il installer quelque chose ?", "Non. Cela fonctionne dans le navigateur, sur ordinateur et mobile."],
    ],
  },
];

const style = `body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;margin:0;color:#313131;line-height:1.7;background:#f6f7f8}
header{background:#fff;color:#313131;padding:36px 20px;text-align:center;border-bottom:1px solid #eceef0}
header h1{font-size:28px;margin:0 0 8px;color:#1a9a5c}header p{color:#6b7280;max-width:640px;margin:8px auto}
.wrap{max-width:880px;margin:0 auto;padding:36px 20px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
.card{background:#fff;border:1px solid #eceef0;border-radius:14px;padding:20px;transition:box-shadow .15s}
.card:hover{box-shadow:0 8px 24px rgba(0,0,0,.08)}
.card b{color:#1a9a5c}.card p{font-size:14px;color:#5f6670;margin:6px 0 0}
.cta{display:block;width:max-content;margin:36px auto;background:#1a9a5c;color:#fff;padding:15px 40px;border-radius:999px;text-decoration:none;font-size:16px;font-weight:600;box-shadow:0 4px 16px rgba(26,154,92,.35)}
.cta:hover{background:#178550;box-shadow:0 8px 24px rgba(26,154,92,.45)}
.faq div{background:#fff;border:1px solid #eceef0;border-radius:12px;padding:16px 20px;margin:12px 0}
.faq b{display:block;margin-bottom:4px}
footer{text-align:center;color:#9aa1a9;font-size:13px;padding:28px}
.langs{font-size:12px;margin-top:10px}.langs a{color:#178550;margin:0 6px;text-decoration:none}
@media(max-width:600px){header h1{font-size:20px}}`;

const ALL_PAGES = PAGES.concat(EXTRA_PAGES);
let hreflang = ALL_PAGES.map(p => `<link rel="alternate" hreflang="${p.lang}" href="${BASE}/${p.file}">`).join("\n");
hreflang += `\n<link rel="alternate" hreflang="zh" href="${BASE}/">\n<link rel="alternate" hreflang="x-default" href="${BASE}/">`;

for (const p of ALL_PAGES) {
  const dirAttr = p.rtl ? ' dir="rtl"' : "";
  const html = `<!DOCTYPE html>
<html lang="${p.lang}"${dirAttr}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${BRAND} — ${p.title}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:title" content="${BRAND} — ${p.title}">
<meta property="og:description" content="${p.desc}">
<meta property="og:image" content="${BASE}/og.png">
<meta property="og:url" content="${BASE}/seo/${p.file}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${BRAND} — ${p.title}">
<meta name="twitter:description" content="${p.desc}">
<meta name="twitter:image" content="${BASE}/og.png">
<meta name="description" content="${p.desc}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E📦%3C/text%3E%3C/svg%3E">
${hreflang}
<style>${style}</style>
</head>
<body>
<header>
  <h1>📦 ${p.h1}</h1>
  <p>${p.sub}</p>
  <div class="langs">${ALL_PAGES.map(x => `<a href="${x.file}" hreflang="${x.lang}">${x.lang.toUpperCase()}</a>`).join("")} · <a href="${BASE}/">中文</a></div>
</header>
<div class="wrap">
  <div class="grid">
    ${p.features.map(([b, d]) => `<div class="card"><b>${b}</b><p>${d}</p></div>`).join("\n    ")}
  </div>
  <a class="cta" href="../index.html?lang=${p.lang}">${p.cta} →</a>
  <h2>FAQ</h2>
  <div class="faq">
    ${p.faq.map(([q, a]) => `<div><b>${q}</b>${a}</div>`).join("\n    ")}
  </div>
</div>
<footer>📦 ${BRAND}（柜满满） — Free Container Load Planning Tool</footer>
</body>
</html>`;
  fs.writeFileSync(path.join(__dirname, "seo", p.file), html);
  console.log("生成 seo/" + p.file);
}

/* sitemap.xml + robots.txt */
const today = new Date().toISOString().slice(0, 10);
const urls = [`<url><loc>${BASE}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>`]
  .concat(ALL_PAGES.map(p => `<url><loc>${BASE}/seo/${p.file}</loc><lastmod>${today}</lastmod><xhtml:link rel="alternate" hreflang="${p.lang}" href="${BASE}/seo/${p.file}"/></url>`));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>`;

/* ============ 内容营销页（文章） ============ */
const CONTENTS = [
  {
    file: "guide-40hc.html", lang: "zh",
    title: "40HC 集装箱能装多少立方米？装柜计算完全指南",
    desc: "40HC 内容积 76.4 m³ 到底能装多少货？内尺寸、计算公式、真实利用率数据与常见误区，一文讲清。附免费 3D 装柜计算工具。",
    cta: "用 3D 计算器算你的柜（免费）",
    body: `
<p><strong>直接答案：</strong>40HC 高柜的内容积是 <strong>76.4 m³</strong>（内尺寸 12.03 × 2.35 × 2.69 m），额定载重 26.5 吨。但实际能装进去的货物，通常只有 55–65 m³——取决于你怎么码放。</p>
<h2>常见柜型内尺寸速查表</h2>
<table><tr><th>柜型</th><th>内尺寸 (cm)</th><th>容积</th><th>载重</th></tr>
<tr><td>20GP</td><td>589.8×235.2×239.1</td><td>33.2 m³</td><td>28 吨</td></tr>
<tr><td>40GP</td><td>1203.1×235.2×239.1</td><td>67.7 m³</td><td>26.5 吨</td></tr>
<tr><td>40HC</td><td>1203.1×235.2×269.1</td><td>76.4 m³</td><td>26.5 吨</td></tr>
<tr><td>45HC</td><td>1351.3×235.2×269.1</td><td>85.7 m³</td><td>27 吨</td></tr></table>
<h2>为什么实际装不到 76.4 m³？</h2>
<p>三个数学上无法回避的损耗：① <strong>边角缝隙</strong>——纸箱 60cm 宽，柜宽 235cm，一排 3 个剩 55cm，再塞别的货才可能利用；② <strong>堆叠限制</strong>——许多货不能压，高度利用打折；③ <strong>装卸通道</strong>——码头要求留出操作空间。</p>
<p>经验数据：随手乱装约 55–65% 利用率；用工具规划后可到 <strong>75–85%</strong>。从 65% 提到 80%，一个 40HC 就能多装 11 m³——可能省下一个柜的运费。</p>
<h2>手算公式（粗估）</h2>
<p>可装件数 ≈ 每层件数 × 层数。每层件数 = ⌊柜长/箱长⌋ × ⌊柜宽/箱宽⌋（可再叠加旋转朝向），层数 = ⌊柜内高/箱高⌋。例如 60×40×50cm 的箱子装 40HC：每层 20×5=100 件（考虑旋转可到 110+），5 层 ≈ 500–550 件。</p>
<p>但真实约束更多：堆叠层数限制、禁止立放的货、偏载、承重……手算只能估个范围。<strong>精确方案建议用 3D 装柜计算器模拟</strong>，几秒钟出结果还能看到每个箱子摆哪。</p>
<h2>常见误区</h2>
<p>① 只看容积不看载重——泡沫货先超体积，金属货先超重量；② 忽略包装尺寸是"外尺寸"；③ 忘了集装箱内壁有约 2–5cm 的公差；④ 偏载超过 60% 可能被拒装或罚款。</p>
`,
  },
  {
    file: "guide-40hc-en.html", lang: "en",
    title: "How much fits in a 40HC container? Complete loading guide",
    desc: "A 40HC holds 76.4 m³ — but how much of YOUR cargo fits? Internal dimensions, the math, real utilization numbers and common mistakes. Free 3D loading calculator included.",
    cta: "Plan your container in 3D — free",
    body: `
<p><strong>Short answer:</strong> a 40HC high-cube container offers <strong>76.4 m³</strong> of internal volume (12.03 × 2.35 × 2.69 m) with a 26,500 kg payload. Realistically you will fit 55–65 m³ of cargo — depending on how well you plan.</p>
<h2>Internal dimensions cheat sheet</h2>
<table><tr><th>Type</th><th>Internal (cm)</th><th>Volume</th><th>Payload</th></tr>
<tr><td>20GP</td><td>589.8×235.2×239.1</td><td>33.2 m³</td><td>28 t</td></tr>
<tr><td>40GP</td><td>1203.1×235.2×239.1</td><td>67.7 m³</td><td>26.5 t</td></tr>
<tr><td>40HC</td><td>1203.1×235.2×269.1</td><td>76.4 m³</td><td>26.5 t</td></tr>
<tr><td>45HC</td><td>1351.3×235.2×269.1</td><td>85.7 m³</td><td>27 t</td></tr></table>
<h2>Why can't you use all 76.4 m³?</h2>
<p>Three unavoidable losses: ① <strong>edge gaps</strong> — a 60cm-wide box in a 235cm-wide container leaves 55cm strips that only smaller items can fill; ② <strong>stacking limits</strong> — crushable goods cap your height usage; ③ <strong>handling clearance</strong> at the port.</p>
<p>Rule of thumb: naive loading reaches 55–65%; planned loading reaches <strong>75–85%</strong>. Going from 65% to 80% on one 40HC = about 11 m³ extra — potentially one full container of freight saved.</p>
<h2>Quick manual estimate</h2>
<p>Units ≈ per-layer count × layers. Per layer = ⌊length/box L⌋ × ⌊width/box W⌋ (plus rotated orientation), layers = ⌊height/box H⌋. For 60×40×50cm boxes in a 40HC: 20×5 = 100 per layer, 5 layers ≈ 500–550 units.</p>
<p>Real constraints (stack limits, this-way-up items, weight balance, floor-loading) make precise planning a job for a <strong>3D load planner</strong> — seconds to run, shows exactly where every box goes.</p>
<h2>Common mistakes</h2>
<p>① Volume-only thinking — foam cargo hits the volume limit, steel hits the weight limit; ② using inner instead of outer box dimensions; ③ forgetting the 2–5cm container wall tolerance; ④ weight distribution beyond 60/40 can get your container rejected.</p>
`,
  },
  {
    file: "tips-freight.html", lang: "zh",
    title: "海运装柜省运费的 7 个实用技巧",
    desc: "从装载率、打托策略到偏载控制——7 个立刻能用的装柜省运费技巧，附免费 3D 装柜工具。",
    cta: "免费规划你的下一柜",
    body: `
<p>海运费按柜计价，一个柜几万块。<strong>装载率每提高 10%，等于白捡十分之一的运费</strong>。以下 7 个技巧按见效快慢排序。</p>
<h2>1. 先规划再装货</h2>
<p>用 3D 装柜计算器提前模拟，能发现"换个柜型能装下"或"这批货需要两个柜"——装货当天才发现要两个柜就晚了。</p>
<h2>2. 重货沉底、轻货上铺</h2>
<p>重的箱子放柜子前半段和底层，轻的铺上层。既安全又能避免偏载拒装。</p>
<h2>3. 相同货物集中码放</h2>
<p>同尺寸的箱子像砌墙一样排成网格，比混着装多出 10% 以上的装载率。</p>
<h2>4. 小件塞缝</h2>
<p>大件之间的缝隙用小件填补——装柜工具会自动告诉你哪些缝隙能塞什么。</p>
<h2>5. 老老实实量外箱尺寸</h2>
<p>"差不多 60" 和实际 63 差的每一厘米都在柜子里放大。量外尺寸，量三次。</p>
<h2>6. 控制偏载</h2>
<p>左右或前后重量差超过 60% 有拒装风险。装载后看一眼重量分布。</p>
<h2>7. 打托与散装算两笔账</h2>
<p>打托保护货物但吃掉装载率（托盘之间留空）。两种方案都算一遍再决定——差价可能超出托盘成本。</p>
`,
  },
  {
    file: "tips-freight-en.html", lang: "en",
    title: "7 practical ways to cut sea freight cost with better loading",
    desc: "Load factor, palletizing strategy, weight balance — 7 container loading tips you can use today, with a free 3D planning tool.",
    cta: "Plan your next container — free",
    body: `
<p>Ocean freight is priced per container. <strong>Every 10% of load factor you gain is a tenth of the freight you keep.</strong> Seven tips, ordered by how fast they pay off.</p>
<h2>1. Plan before you load</h2>
<p>Simulate in a 3D load planner first — you'll learn whether a different container type fits, or that this shipment needs two containers. Finding out on loading day is too late.</p>
<h2>2. Heavy low, light high</h2>
<p>Heavy boxes to the front bottom, light ones on top. Safer, and avoids rejection for weight imbalance.</p>
<h2>3. Tile identical boxes</h2>
<p>Uniform boxes in a grid pattern yield 10%+ more load factor than mixed stacking.</p>
<h2>4. Fill gaps with small items</h2>
<p>A good planner tells you exactly which small items fit the leftover strips and tiers.</p>
<h2>5. Measure the real outer boxes</h2>
<p>"About 60" versus an actual 63 — every centimeter is multiplied across the container. Measure outer dimensions, twice.</p>
<h2>6. Watch the weight balance</h2>
<p>More than 60/40 front-back or left-right imbalance risks rejection. Check the distribution after planning.</p>
<h2>7. Do the pallet math both ways</h2>
<p>Pallets protect cargo but eat load factor (air between pallets). Run both scenarios — the difference may exceed the pallet cost.</p>
`,
  },
];
for (const art of CONTENTS) {
  const html = `<!DOCTYPE html>
<html lang="${art.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>柜满满 — ${art.title}</title>
<meta name="description" content="${art.desc}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:title" content="${art.title}">
<meta property="og:description" content="${art.desc}">
<meta property="og:image" content="${BASE}/og.png">
<link rel="alternate" hreflang="${art.lang}" href="${BASE}/seo/${art.file}">
${hreflang}
<style>${style}
  article { max-width:760px; margin:0 auto; padding:36px 20px; }
  article h2 { color:#1a9a5c; margin:28px 0 10px; font-size:20px; }
  article p, article li { font-size:15px; color:#313131; }
  article table { width:100%; border-collapse:collapse; margin:14px 0; font-size:14px; background:#fff; }
  article th, article td { border:1px solid #eceef0; padding:8px 12px; text-align:left; }
  article th { background:#e8f6ee; color:#178550; }
  .a-cta { display:block; width:max-content; margin:30px auto; background:#1a9a5c; color:#fff; padding:14px 34px; border-radius:999px; text-decoration:none; font-weight:600; }
  .a-cta:hover { background:#178550; }
</style>
</head>
<body>
<header><h1>📦 ${art.title}</h1><p>${art.desc}</p></header>
<article>
${art.body}
<a class="a-cta" href="../index.html?lang=${art.lang}">${art.cta} →</a>
</article>
<footer><div class="langs"><a href="${BASE}/">中文</a> · <a href="guide-40hc${art.lang === "zh" ? "-en" : ""}.html">${art.lang === "zh" ? "English" : "中文版"}</a> · <a href="tips-freight${art.lang === "zh" ? "-en" : ""}.html">${art.lang === "zh" ? "English" : "中文版"}</a> · <a href="en.html">EN</a></div>📦 ${BRAND}（柜满满）</footer>
</body>
</html>`;
  fs.writeFileSync(path.join(__dirname, "seo", art.file), html);
  console.log("生成 seo/" + art.file);
}
const artUrls = CONTENTS.map(a => `<url><loc>${BASE}/seo/${a.file}</loc><lastmod>${today}</lastmod></url>`).join("\n");
fs.writeFileSync(path.join(__dirname, "seo", "sitemap.xml"),
  sitemap.replace("</urlset>", artUrls + "\n</urlset>"));
console.log("sitemap 含文章页");

fs.writeFileSync(path.join(__dirname, "seo", "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(__dirname, "seo", "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${BASE}/seo/sitemap.xml\n`);
console.log("生成 seo/sitemap.xml + seo/robots.txt");
console.log("完成");

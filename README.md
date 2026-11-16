# 📦 柜满满 GuiManMan — 免费在线装柜优化工具

输入货物尺寸，自动计算集装箱 3D 码放方案，把柜子装得更满、运费省得更多。

**线上地址**：https://c314726018.github.io/container-load-planner/（自定义域名 guimanman.com 待绑定）

## 功能

- 3D 装载可视化（Three.js），按货品配色，旋转/缩放
- 智能码放：6 向旋转、堆叠层数限制、立放限制、支撑校验、重货沉底
- 4 种标准柜型（20GP/40GP/40HC/45HC）+ 自定义柜型
- 多柜自动分流（装不下/超重自动开新柜）
- 偏载校验（前后/左右重量分布）
- 装载步骤指导（仓库工人可照做的分步说明）
- Excel/CSV 导入（多语言表头识别）+ Excel 粘贴导入
- 分享链接（方案编码进 URL，免后端）
- PDF 装柜报告导出（含公司抬头、逐柜截图与步骤）
- 6 语言界面：中文 / English / Español / 日本語 / 한국어 / Русский
- 多语言 SEO 落地页（`seo/`，`gen_seo.js` 生成）
- 响应式设计，手机可用

## 目录结构

```
zhuanggui/
├── index.html        # 主应用（单文件，含 i18n/UI/场景）
├── lib/
│   ├── pack.js       # 3D 装箱算法（极端点启发式，Node/浏览器共用）
│   ├── three.min.js  # Three.js r128（本地化）
│   ├── OrbitControls.js
│   └── xlsx.full.min.js  # SheetJS（Excel 解析）
├── seo/              # 多语言 SEO 落地页（gen_seo.js 生成）
├── gen_seo.js        # SEO 页面生成器
├── test_pack.js      # 算法测试（112 项）
└── test_e2e.js       # 端到端测试（Playwright，25 项）
```

## 开发

```bash
# 本地预览
python3 -m http.server 8642 --bind 127.0.0.1

# 算法测试
node test_pack.js

# 端到端测试（需本机 Chrome for Testing，路径见 test_e2e.js）
npm i playwright-core && node test_e2e.js

# 重新生成 SEO 落地页（上线前把 BASE 常量改成真实域名）
node gen_seo.js
```

## 部署

纯静态站点，任意静态托管可用（GitHub Pages / Cloudflare Pages / Vercel）。
SEO 页引用 `?lang=xx` 参数直达对应语言界面。

## License

MIT

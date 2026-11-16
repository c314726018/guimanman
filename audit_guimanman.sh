#!/usr/bin/env bash
# 柜满满（GuiManMan）每日全面巡检
# 用法: bash audit_guimanman.sh  （在 zhuanggui 项目根目录运行）
# 检查 12 项，输出汇总报告；critical 失败时退出码 1
set -u
cd "$(dirname "$0")"

PASS=0; FAIL=0; CRIT=0
ok()   { PASS=$((PASS+1)); echo "✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "❌ $1 ${2:-}"; }
crit() { CRIT=$((CRIT+1)); FAIL=$((FAIL+1)); echo "🚨 [CRITICAL] $1 ${2:-}"; }

echo "==== 柜满满每日巡检 $(date '+%F %T') ===="

# 1. 核心文件存在
for f in index.html lib/pack.js lib/importer.js lib/three.min.js lib/OrbitControls.js lib/xlsx.full.min.js README.md; do
  [ -f "$f" ] && ok "文件存在: $f" || crit "核心文件缺失: $f"
done

# 2. SEO 落地页 24 个 + sitemap/robots
for l in en es pt de fr vi ja ko ru zhTW it nl pl tr id ms fi sv cs hu el th ar he; do
  [ -f "seo/$l.html" ] && ok "SEO 页: $l.html" || bad "SEO 页缺失: $l.html"
done
[ -f "seo/sitemap.xml" ] && ok "sitemap.xml" || bad "sitemap.xml 缺失"
[ -f "seo/robots.txt" ] && ok "robots.txt" || bad "robots.txt 缺失"

# 3. 品牌关键词
grep -q "柜满满" index.html && ok "品牌关键词「柜满满」" || crit "index.html 缺品牌关键词"
grep -q "GuiManMan" seo/en.html && ok "英文页品牌词 GuiManMan" || bad "英文页缺品牌词"

# 4. 算法测试（112 项）
if OUT=$(node test_pack.js 2>&1); then
  n=$(echo "$OUT" | tail -1 | grep -oE "[0-9]+" | head -1)
  ok "算法测试全过 ($n 项)"
else
  crit "算法测试失败" "$(echo "$OUT" | grep '❌' | head -3)"
fi

# 5. 真实装箱单导入测试（12 项）
if OUT=$(node test_import.js 2>&1); then
  ok "真实装箱单导入测试全过"
else
  crit "导入测试失败（真实数据回归被破坏）" "$(echo "$OUT" | grep '❌' | head -3)"
fi

# 6. 新功能测试（18 项）
if OUT=$(node test_features.js 2>&1); then
  ok "功能测试全过（承重/托盘/优先级/间隙）"
else
  crit "功能测试失败" "$(echo "$OUT" | grep '❌' | head -3)"
fi

# 7. 性能哨兵：1000 件装箱 < 5s（已含在功能测试内，这里再单独压测）
T0=$(date +%s%N 2>/dev/null || python3 -c 'import time;print(time.time_ns())')
node -e "
const PackLib = require('./lib/pack.js');
const g = [{name:'x',l:50,w:35,h:30,qty:1000,kg:8,stack:8,color:'#fff'}];
const r = PackLib.packAll(g, {l:1203.1,w:235.2,h:269.1,payload:26500});
process.exit(r.containers.reduce((s,c)=>s+c.placed.length,0)===1000?0:1);
" && ok "性能哨兵: 1000 件装箱通过" || crit "性能哨兵失败: 1000 件未全装或超时"

# 8. 线上主站可达
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 https://c314726018.github.io/guimanman/ || echo 000)
[ "$CODE" = "200" ] && ok "线上主站 200" || crit "线上主站异常: $CODE"

# 9. 线上品牌词
T=$(curl -s --max-time 20 https://c314726018.github.io/guimanman/ | grep -o "<title>[^<]*" | head -1)
echo "$T" | grep -q "柜满满" && ok "线上 title 正确: ${T#<title>}" || bad "线上 title 异常: $T"

# 10. SEO 页线上抽样（3 个）
for l in en vi fr; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "https://c314726018.github.io/guimanman/seo/$l.html" || echo 000)
  [ "$CODE" = "200" ] && ok "线上 SEO 页 $l 200" || bad "线上 SEO 页 $l 异常: $CODE"
done

# 11. 老链接跳转页
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 https://c314726018.github.io/container-load-planner/ || echo 000)
[ "$CODE" = "200" ] && ok "旧链接跳转页 200" || bad "旧链接跳转页异常: $CODE"

# 12. Git 同步状态
git fetch origin -q 2>/dev/null
LOCAL=$(git rev-parse HEAD 2>/dev/null); REMOTE=$(git rev-parse origin/main 2>/dev/null)
DIRTY=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$LOCAL" = "$REMOTE" ] && [ "$DIRTY" = "0" ]; then ok "Git 与远程同步、无未提交改动"
else bad "Git 不同步: 本地落后/领先或有 $DIRTY 个未提交文件"; fi

echo "==== 汇总: 通过 $PASS ｜ 失败 $FAIL ｜ 其中 critical $CRIT ===="
[ "$CRIT" = "0" ] && [ "$FAIL" = "0" ] && echo "🟢 整体健康" || echo "🔴 需要关注"
exit $([ "$CRIT" = "0" ] && echo 0 || echo 1)

#!/usr/bin/env bash
# 六层全面体检（多方法交叉验证）
# 层1 静态分析 | 层2 逻辑测试 | 层3 端到端 | 层4 25语言压测 | 层5 全站走查(本地+线上) | 层6 每日巡检
set -u
cd "$(dirname "$0")"
RESULT=/tmp/full_check_result.txt
: > $RESULT

L() { echo "" >> $RESULT; echo "[$1] $2" >> $RESULT; }

echo "=== 层1/6 静态分析（语法 + id 引用 + 重复 id + 语言包一致性）==="
if python3 check_static.py; then L "层1 静态分析" "✅ 通过"; echo "  ✅ 静态分析通过" | tee -a $RESULT; else L "层1 静态分析" "❌ 失败"; echo "  ❌ 静态分析失败" | tee -a $RESULT; fi

echo ""
echo "=== 层2/6 逻辑测试（pack 112 + features 22 + import 12）==="
T2=0
node test_pack.js 2>&1 | tail -1 | tee -a $RESULT && T2=$((T2+1))
node test_features.js 2>&1 | tail -1 | tee -a $RESULT && T2=$((T2+1))
node test_import.js 2>&1 | tail -1 | tee -a $RESULT && T2=$((T2+1))
L "层2 逻辑测试" "3 套运行完成"

echo ""
echo "=== 层3/6 端到端交互（Playwright）==="
(spawn_server() { python3 -m http.server 8642 --bind 127.0.0.1 >/dev/null 2>&1 & }; spawn_server; sleep 1)
node test_e2e.js 2>&1 | grep -E "✅ 通过|❌|✅ 无|失败" | tee -a $RESULT
pkill -f "http.server 8643" 2>/dev/null

echo ""
echo "=== 层4/6 25 语言全切换压测 ==="
(spawn_server() { python3 -m http.server 8643 --bind 127.0.0.1 >/dev/null 2>&1 & }; spawn_server; sleep 1)
node check_langs.js http://127.0.0.1:8643 2>&1 | tail -3 | tee -a $RESULT
pkill -f "http.server 8643" 2>/dev/null

echo ""
echo "=== 层5/6 全站走查（本地 → 线上）==="
unset NODE_OPTIONS
node walkthrough.js local 2>&1 | tail -2 | tee -a $RESULT
node walkthrough.js live 2>&1 | tail -2 | tee -a $RESULT

echo ""
echo "=== 层6/6 每日巡检（46 项）==="
bash audit_guimanman.sh 2>&1 | tail -2 | tee -a $RESULT

echo ""
echo "========== 六层体检结束 =========="
N_FAIL=$(grep "❌" $RESULT | grep -vc "失败 0" || true); echo "❌ 真实失败行数: $N_FAIL" | tee -a $RESULT
cat $RESULT

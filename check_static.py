#!/usr/bin/env python3
"""静态层：HTML/JS 交叉一致性检查
① getElementById 引用的 id 必须存在于 HTML
② id 不得重复
③ 内联 <script> 语法检查（node --check）
④ HTML 基础结构检查（标签配对抽样）
"""
import io, re, subprocess, sys, os

os.chdir(os.path.dirname(os.path.abspath(__file__)))
html = io.open("index.html", encoding="utf-8").read()
issues = []

# ① id 定义
defined = re.findall(r'id="([^"]+)"', html)
dup = {x for x in defined if defined.count(x) > 1}
if dup: issues.append("重复 id: " + ", ".join(sorted(dup)))
defined_set = set(defined)

# JS 里 getElementById 引用
js_blocks = re.findall(r"<script>(.*?)</script>", html, re.S)
js_all = "\n".join(js_blocks)
used = set(re.findall(r'getElementById\("([^"]+)"\)', js_all))
missing = sorted(u for u in used if u not in defined_set and not u.startswith("cu") or u.startswith("cu") and u not in defined_set)
missing = [u for u in used if u not in defined_set]
if missing: issues.append("getElementById 引用但不存在的 id: " + ", ".join(missing))

# ② 内联脚本语法
for i, blk in enumerate(js_blocks):
    if "lib/" in blk[:50]: continue
    tmp = "/tmp/_inline_%d.js" % i
    io.open(tmp, "w", encoding="utf-8").write(blk)
    r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
    if r.returncode != 0:
        issues.append("内联脚本 #%d 语法错误: %s" % (i, r.stderr[:200]))

# lib/*.js 语法
for f in os.listdir("lib"):
    if f.endswith(".js") and f != "xlsx.full.min.js":
        r = subprocess.run(["node", "--check", "lib/" + f], capture_output=True, text=True)
        if r.returncode != 0: issues.append("lib/%s 语法错误: %s" % (f, r.stderr[:150]))

# ③ HTML 结构抽样：div 配对
opens = len(re.findall(r"<div\b", html)); closes = len(re.findall(r"</div>", html))
if opens != closes: issues.append("div 不配对: open=%d close=%d" % (opens, closes))

# ④ languages-extra 键一致性
try:
    r = subprocess.run(["node", "-e",
        "require('./lib/langs-extra.js');const E=globalThis.I18N_EXTRA;const z=Object.keys(E.zhTW).length;"
        "const bad=Object.entries(E).filter(([l,d])=>Object.keys(d).length!==z).map(b=>b[0]);"
        "console.log(bad.length?'MISMATCH:'+bad.join(','):'OK:'+Object.keys(E).length+' languages,'+z+' keys');"],
        capture_output=True, text=True)
    out = r.stdout.strip()
    if not out.startswith("OK"): issues.append("语言包: " + out)
except Exception as e:
    issues.append("语言包加载失败: " + e)

print("静态层: " + ("✅ 无问题" if not issues else "❌ %d 项" % len(issues)))
for i in issues: print("  - " + i)
sys.exit(1 if issues else 0)

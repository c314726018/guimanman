#!/usr/bin/env python3
"""截图基线对比：walkthrough/*.png 与 walkthrough/baseline/ 逐像素对比
用法:
  python3 compare_shots.py           # 对比并报告（首次运行自动建立基线）
  python3 compare_shots.py --accept  # 人工确认变化合理后，刷新基线
输出: 变化率 ≥0.5% 的页面清单（其余视为无视觉变化）
"""
import os, sys, shutil
from PIL import Image, ImageChops

d = os.path.dirname(os.path.abspath(__file__))
cur = os.path.join(d, "walkthrough")
base = os.path.join(cur, "baseline")
accept = "--accept" in sys.argv
os.makedirs(base, exist_ok=True)

if accept:
    n = 0
    for f in os.listdir(cur):
        if f.endswith(".png"):
            shutil.copy(os.path.join(cur, f), os.path.join(base, f)); n += 1
    print(f"✅ 基线已刷新（{n} 张）")
    sys.exit(0)

changed, newb, same = [], [], 0
for f in sorted(os.listdir(cur)):
    if not f.endswith(".png"):
        continue
    cur_p = os.path.join(cur, f)
    base_p = os.path.join(base, f)
    if not os.path.exists(base_p):
        shutil.copy(cur_p, base_p)
        newb.append(f)
        continue
    try:
        a = Image.open(cur_p).convert("RGB")
        b = Image.open(base_p).convert("RGB")
    except Exception as e:
        changed.append((f, "图片读取失败 " + str(e), 100.0)); continue
    if a.size != b.size:
        changed.append((f, f"尺寸变化 {b.size}→{a.size}", 100.0)); continue
    diff = ImageChops.difference(a, b)
    bbox = diff.getbbox()
    if bbox is None:
        same += 1; continue
    hist = diff.convert("L").histogram()
    total = a.size[0] * a.size[1]
    pct = sum(hist[16:]) / total * 100  # 亮度差≥16 视为有效变化
    if pct >= 0.5:
        changed.append((f, f"变化 {pct:.1f}% 区域 {bbox}", pct))
    else:
        same += 1

print(f"截图对比: 相同 {same} ｜ 新基线 {len(newb)} ｜ 有变化 {len(changed)}")
for f, msg, pct in sorted(changed, key=lambda x: -x[2]):
    print(f"  {'🔍' if pct < 30 else '⚠️'} {f}: {msg}")
print("提示: 逐张目检变化是否合理；确认后运行 python3 compare_shots.py --accept 刷新基线")

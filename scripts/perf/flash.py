# 逐帧亮度：找「闪」——亮度突然跳变、一两帧后又跳回来。用法：python flash.py <帧目录>
import sys, os
from PIL import Image, ImageStat

d = sys.argv[1]
frames = sorted(f for f in os.listdir(d) if f.endswith('.jpg'))
rows = []
for f in frames:
    ms = int(f.split('_')[1].split('.')[0])
    im = Image.open(os.path.join(d, f)).convert('L')
    rows.append((ms, ImageStat.Stat(im).mean[0], f))

print('帧数', len(rows))
prev = None
for i, (ms, lum, f) in enumerate(rows):
    jump = '' if prev is None else f'{lum - prev:+6.1f}'
    # 闪：和前一帧差很多，而且和后面第一、二帧中的某一帧又接近前一帧
    flag = ''
    if prev is not None and abs(lum - prev) > 25:
        nxt = [r[1] for r in rows[i + 1:i + 3]]
        if any(abs(x - prev) < 12 for x in nxt):
            flag = '  <-- 闪？'
        else:
            flag = '  <-- 跳变'
    print(f'{ms:6d}ms  亮度 {lum:6.1f} {jump}{flag}  {f}')
    prev = lum

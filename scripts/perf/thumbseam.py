# 底栏滑块截图（thumbcheck.mjs 存的）里找拼接处的亮列：同一列在两行都比左右两边亮 6 以上就算。要 Pillow。
# 用法：python thumbseam.py <目录>
import glob, sys
from PIL import Image
bad = 0
for f in sorted(glob.glob(sys.argv[1] + '/*.png')):
    im = Image.open(f).convert('RGB')
    cols = []
    for y in (200, 205):   # 滑块下半截、字的下面（截图是 3 倍屏，底栏上下各留了边）
        row = [sum(im.getpixel((x, y))) // 3 for x in range(im.width)]
        cols.append({x for x in range(1, len(row) - 1) if row[x] - row[x - 1] > 6 and row[x] - row[x + 1] > 6})
    if cols[0] & cols[1]:
        bad += 1
        print('有亮列', f, sorted(cols[0] & cols[1]))
print('共', len(glob.glob(sys.argv[1] + '/*.png')), '张，有亮列的', bad, '张')

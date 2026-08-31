import sys
import glob
import os
from PIL import Image, ImageDraw

base = sys.argv[1]  # e.g. assets/obstacles 또는 assets/monsters
mode = sys.argv[2]  # "테마1,테마2,..." (기존 obstacles 방식) 또는 "flat"({base}/*.png를 그리드로)
out = sys.argv[3]
cell = 140

if mode == "flat":
    # 하위 테마/크기 폴더 없이 {base}/*.png로 평탄하게 저장된 에셋용 (예: assets/monsters)
    paths = sorted(glob.glob(f"{base}/*.png"))
    cols = 8
    rows = max(1, (len(paths) + cols - 1) // cols)
    sheet = Image.new("RGB", (cols * cell, rows * cell), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    for i, path in enumerate(paths):
        r, c = divmod(i, cols)
        im = Image.open(path).convert("RGBA")
        bg = Image.new("RGBA", (cell, cell), (60, 60, 60, 255))
        scale = min((cell - 16) / im.width, (cell - 16) / im.height)
        nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
        im2 = im.resize((nw, nh))
        bg.alpha_composite(im2, ((cell - nw) // 2, (cell - nh) // 2))
        sheet.paste(bg.convert("RGB"), (c * cell, r * cell))
        label = os.path.splitext(os.path.basename(path))[0]
        d.text((c * cell + 2, r * cell + 2), label[:16], fill=(255, 255, 0))
    sheet.save(out)
    print("saved", out, sheet.size)

else:
    themes = mode.split(",")
    tiers = ["small", "medium", "large"]
    cols = 10
    rows = len(themes) * len(tiers)
    sheet = Image.new("RGB", (cols * cell, rows * cell), (40, 40, 40))
    d = ImageDraw.Draw(sheet)

    r = 0
    for theme in themes:
        for tier in tiers:
            for c in range(cols):
                path = f"{base}/{theme}/{tier}/{c}.png"
                try:
                    im = Image.open(path).convert("RGBA")
                except FileNotFoundError:
                    continue
                bg = Image.new("RGBA", (cell, cell), (60, 60, 60, 255))
                scale = min((cell - 16) / im.width, (cell - 16) / im.height)
                nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
                im2 = im.resize((nw, nh))
                bg.alpha_composite(im2, ((cell - nw) // 2, (cell - nh) // 2))
                sheet.paste(bg.convert("RGB"), (c * cell, r * cell))
                d.text((c * cell + 2, r * cell + 2), f"{theme[:2]}/{tier[0]}/{c}", fill=(255, 255, 0))
            r += 1

    sheet.save(out)
    print("saved", out, sheet.size)

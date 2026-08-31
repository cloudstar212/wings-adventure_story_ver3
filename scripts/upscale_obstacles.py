import glob
from PIL import Image, ImageFilter

# 각 크기 단계의 게임 내 표시 크기(반지름*2.1) 대비 약 2.5배 DPI 여유를 두고
# 그 이하 해상도인 원본만 Lanczos 업스케일 + 언샤프마스크로 다시 저장한다.
TIER_TARGET_H = {"small": 130, "medium": 190, "large": 260}

count = 0
for theme in ["space", "ocean", "dessert", "household", "fruit", "transport"]:
    for tier, target_h in TIER_TARGET_H.items():
        for path in glob.glob(f"assets/obstacles/{theme}/{tier}/*.png"):
            im = Image.open(path).convert("RGBA")
            if im.height >= target_h:
                continue
            scale = target_h / im.height
            w = max(1, round(im.width * scale))
            up = im.resize((w, target_h), Image.LANCZOS)
            up = up.filter(ImageFilter.UnsharpMask(radius=2, percent=120, threshold=2))
            up.save(path)
            count += 1

print(f"upscaled {count} icons")

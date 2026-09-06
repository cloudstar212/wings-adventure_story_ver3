"""PWA 홈 화면 아이콘 생성 - 세 주인공(assets/sprites/{basic,char2,char3}/basic.png,
배경 제거된 기본 날개 비행 스프라이트)을 한 장의 정사각형 아이콘으로 합성한다.
필요한 사이즈(512/192/apple-touch 180)를 mobile/icons/에 저장. 원본 스프라이트가
바뀌면 이 스크립트만 재실행하면 된다."""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "mobile" / "icons"
OUT_DIR.mkdir(parents=True, exist_ok=True)
MASTER = 1024

CHAR_SPRITES = [
    ROOT / "assets/sprites/basic.png",         # 1P 기본 주인공(갈색머리)
    ROOT / "assets/sprites/char2/basic.png",   # 2번째 주인공(포니테일)
    ROOT / "assets/sprites/char3/basic.png",   # 3번째 주인공(은발)
]

def radial_bg(size):
    """하늘색 방사형 그라디언트 배경(게임 톤과 통일)."""
    img = Image.new("RGB", (size, size))
    cx = cy = size / 2
    max_r = size * 0.75
    top = (255, 255, 255)
    bottom = (79, 150, 224)
    px = img.load()
    for y in range(size):
        for x in range(size):
            d = min(1.0, math.hypot(x - cx, y - cy) / max_r)
            r = round(top[0] + (bottom[0] - top[0]) * d)
            g = round(top[1] + (bottom[1] - top[1]) * d)
            b = round(top[2] + (bottom[2] - top[2]) * d)
            px[x, y] = (r, g, b)
    return img

def load_char(path, target_h):
    im = Image.open(path).convert("RGBA")
    bbox = im.getbbox()
    im = im.crop(bbox)
    scale = target_h / im.height
    im = im.resize((max(1, round(im.width * scale)), target_h), Image.LANCZOS)
    return im

def paste_with_shadow(base, char_img, cx, bottom_y):
    """char_img를 (수평중심 cx, 바닥 y=bottom_y)에 맞춰 그림자와 함께 붙인다."""
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    alpha = char_img.split()[3]
    dark = Image.new("RGBA", char_img.size, (10, 20, 40, 140))
    dark.putalpha(alpha.point(lambda a: int(a * 0.55)))
    sx = cx - char_img.width // 2
    sy = bottom_y - char_img.height
    shadow.paste(dark, (sx + 14, sy + 20), dark)
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    base.alpha_composite(shadow)
    base.alpha_composite(char_img, (sx, sy))

def build_master():
    bg = radial_bg(MASTER).convert("RGBA")

    # 은은한 후광(주인공들이 모이는 중심을 강조)
    glow = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse(
        [MASTER * 0.18, MASTER * 0.16, MASTER * 0.82, MASTER * 0.80],
        fill=(255, 255, 255, 90),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(80))
    bg.alpha_composite(glow)

    # 셋 다 같은 방향(오른쪽)을 보고 나는 자세라(얼굴은 이미지 오른쪽, 날개는 왼쪽으로
    # 뻗음), 너무 겹치면 옆 캐릭터의 날개가 얼굴을 가린다. 세 얼굴이 다 보이도록
    # 겹침을 최소화한 가로 3분할 대형(가운데만 살짝 크게)으로 배치한다.
    boy1 = load_char(CHAR_SPRITES[0], round(MASTER * 0.46))
    girl = load_char(CHAR_SPRITES[1], round(MASTER * 0.52))
    boy2 = load_char(CHAR_SPRITES[2], round(MASTER * 0.46))

    bottom_y = round(MASTER * 0.80)
    paste_with_shadow(bg, boy1, round(MASTER * 0.15), bottom_y)
    paste_with_shadow(bg, boy2, round(MASTER * 0.85), bottom_y)
    paste_with_shadow(bg, girl, round(MASTER * 0.50), bottom_y + round(MASTER * 0.04))

    return bg.convert("RGB")

def export(master, sizes, prefix, safe_pad=0.0):
    for size in sizes:
        if safe_pad > 0:
            inner = round(size * (1 - safe_pad * 2))
            resized = master.resize((inner, inner), Image.LANCZOS)
            canvas = Image.new("RGB", (size, size), (255, 255, 255))
            off = (size - inner) // 2
            canvas.paste(resized, (off, off))
        else:
            canvas = master.resize((size, size), Image.LANCZOS)
        canvas.save(OUT_DIR / f"{prefix}-{size}.png")
        print("saved", OUT_DIR / f"{prefix}-{size}.png")

if __name__ == "__main__":
    master = build_master()
    master.save(OUT_DIR / "icon-master-1024.png")
    # 안드로이드/manifest용(꽉 채움) - Chrome 등은 자체적으로 원형/둥근사각 마스킹을 적용하므로
    # 그림 자체에 여백을 과하게 두지 않는다.
    export(master, [512, 192], "icon")
    # iOS 홈 화면(apple-touch-icon)은 자체 라운드 처리만 하고 마스킹 여유가 필요 없어 동일하게 꽉 채움.
    master.resize((180, 180), Image.LANCZOS).save(OUT_DIR / "apple-touch-icon.png")
    print("done")

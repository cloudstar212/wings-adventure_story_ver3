import io
import json
import os
import numpy as np
from rembg import remove, new_session
from PIL import Image

names = ["basic", "golden", "cloud", "rainbow", "sky", "flame", "water", "electric"]
top_crop = {"basic": 235}
default_top = 185

# 원본 384x512 셀 기준 캐릭터 몸통(가슴/벨트) 앵커 좌표 - 모든 셀에서 캐릭터 위치가 동일함
ANCHOR_X, ANCHOR_Y = 245, 380

os.makedirs("assets/tmp", exist_ok=True)
os.makedirs("assets/sprites", exist_ok=True)

s_anime = new_session("isnet-anime")
s_general = new_session("u2net")


def get_alpha(data, session):
    out = remove(data, session=session)
    im = Image.open(io.BytesIO(out)).convert("RGBA")
    return np.array(im)[:, :, 3]


anchors = {}

for name in names:
    raw = Image.open(f"assets/cards/{name}.png").convert("RGB")
    top = top_crop.get(name, default_top)
    charonly = raw.crop((0, top, raw.width, raw.height))
    charonly.save(f"assets/tmp/{name}_charonly.png")

    buf = io.BytesIO()
    charonly.save(buf, format="PNG")
    data = buf.getvalue()

    a1 = get_alpha(data, s_anime)
    a2 = get_alpha(data, s_general)
    alpha = np.maximum(a1, a2)

    if name == "electric":
        arr = np.array(charonly).astype(int)
        h, w, _ = arr.shape
        R, G, B = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        bright = (np.maximum(np.maximum(R, G), B) > 150) & (((R + G) / 2 - B) > 10)
        region = np.zeros((h, w), dtype=bool)
        region[0:230, 0:300] = True
        wing_mask = (bright & region).astype(np.uint8) * 255
        alpha = np.maximum(alpha, wing_mask)

    alpha = np.where(alpha < 25, 0, alpha).astype(np.uint8)
    rgba = np.dstack([np.array(charonly), alpha])
    im = Image.fromarray(rgba, "RGBA")

    bbox = im.getbbox()
    pad = 4
    bx0, by0, bx1, by1 = bbox
    box = (max(0, bx0 - pad), max(0, by0 - pad), min(im.width, bx1 + pad), min(im.height, by1 + pad))
    cropped = im.crop(box)
    cropped.save(f"assets/sprites/{name}.png")

    # 원본 384x512 좌표계의 앵커를 최종 크롭 이미지 좌표계로 변환
    fx = ANCHOR_X - box[0]
    fy = (ANCHOR_Y - top) - box[1]
    anchors[name] = {
        "w": cropped.width, "h": cropped.height,
        "ax": round(fx / cropped.width, 4),
        "ay": round(fy / cropped.height, 4),
    }
    print(name, cropped.size, anchors[name])

with open("assets/sprites/anchors.json", "w") as f:
    json.dump(anchors, f, indent=2)

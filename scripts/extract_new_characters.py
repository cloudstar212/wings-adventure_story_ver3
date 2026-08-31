"""주인공2/3 신규 캐릭터 에셋을 design/ 흰배경 시트에서 추출한다.

- 캐릭터 스프라이트(8종 날개): extract_characters_v2.py와 동일한 방식(흰배경 flood-fill 제거 +
  눈동자 중심 앵커 검출)을 "주인공{2,3}_흰배경.png"(기존 주인공1 시트와 동일한 2행x4열 레이아웃)에
  그대로 적용한다. -> assets/sprites/{char2,char3}/{wingId}.png
- 차지 이펙트(약/강): extract_effects.py의 흰배경 알파 처리 방식을 재사용해, 각 캐릭터의 차지 공격
  시트 2장(4행 x [캐릭터 썸네일/약검기/강검기] 3열)에서 행/열 경계를 밀도 기반으로 자동 검출하고
  약검기·강검기 두 컬럼만 크롭한다(썸네일 컬럼은 위 전용 시트가 있어 여기서는 쓰지 않음).
  -> assets/effects/charge/{hero2,hero3}/{wingId}_{weak,full}.png

기존 주인공1 에셋(assets/sprites/*.png, assets/effects/charge/*.png)은 건드리지 않는다.
"""
import json
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC_DIR = "design"
SPRITE_OUT = "assets/sprites"
CHARGE_OUT = "assets/effects/charge"

WING_ORDER = ["basic", "golden", "cloud", "rainbow", "sky", "flame", "water", "electric"]
# (행, 열) 순서 = WINGS 배열 순서 (extract_characters_v2.py와 동일)
SPRITE_GRID = [
    ["basic", "golden", "cloud", "rainbow"],
    ["sky", "flame", "water", "electric"],
]

CHARACTERS = [
    {
        "id": "hero2", "spriteDir": "char2",
        "sheet": "캐릭터 및 날개 디자인_주인공2_흰배경.png",
        "charge_sheets": ["주인공2_플레이어 차지 공격_1.png", "주인공2_플레이어 차지 공격_2.png"],
    },
    {
        "id": "hero3", "spriteDir": "char3",
        "sheet": "캐릭터 및 날개 디자인_주인공3_흰배경.png",
        "charge_sheets": ["주인공3_플레이어 차지 공격_1.png", "주인공3_플레이어 차지 공격_2.png"],
    },
]


# ---------------------------- 공용 유틸(extract_characters_v2.py / extract_effects.py와 동일) ----------------------------

def nonwhite_mask(arr, thresh=30):
    diff = np.abs(arr.astype(int) - 255).sum(axis=2)
    return diff > thresh, diff


def find_bands(density, thresh):
    bands = []
    in_band = False
    s = 0
    for y in range(len(density)):
        d = density[y]
        if d > thresh and not in_band:
            s = y
            in_band = True
        elif d <= thresh and in_band:
            bands.append((s, y))
            in_band = False
    if in_band:
        bands.append((s, len(density)))
    return bands


def clean_fragments(img, min_ratio=0.2):
    a = np.array(img.split()[-1])
    labeled, n = ndimage.label(a > 40, structure=np.ones((3, 3)))
    if n <= 1:
        return img
    sizes = ndimage.sum(np.ones_like(a), labeled, range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    main_area = sizes[main - 1]
    h, w = a.shape
    objs = ndimage.find_objects(labeled)
    drop = np.zeros_like(a, dtype=bool)
    for i, sl in enumerate(objs):
        lbl = i + 1
        if lbl == main or sl is None:
            continue
        ys, xs = sl
        touches_border = xs.start == 0 or xs.stop == w or ys.start == 0 or ys.stop == h
        if touches_border and sizes[lbl - 1] < main_area * min_ratio:
            drop |= labeled == lbl
    if drop.any():
        arr = np.array(img)
        arr[drop, 3] = 0
        img = Image.fromarray(arr, "RGBA")
    return img


def white_bg_alpha(region_arr, region_diff):
    """흰 배경 시트용: 테두리 flood-fill로 진짜 배경만 투명 처리(내부 밝은 하이라이트는 보존)."""
    bgish = region_diff < 45
    labeled_bg, _ = ndimage.label(bgish, structure=np.ones((3, 3)))
    border_labels = (set(labeled_bg[0, :].tolist()) | set(labeled_bg[-1, :].tolist()) |
                      set(labeled_bg[:, 0].tolist()) | set(labeled_bg[:, -1].tolist()))
    border_labels.discard(0)
    bg_connected = np.isin(labeled_bg, list(border_labels)) if border_labels else np.zeros_like(bgish, dtype=bool)
    soft = np.clip((region_diff - 10) * 4, 0, 255)
    return np.where(bg_connected, soft, 255).astype(np.uint8)


def eye_anchor(final_img):
    """캐릭터 이미지에서 눈동자(진한 색) 픽셀 군집의 중심을 앵커로 삼는다(extract_characters_v2.py와 동일)."""
    fa = np.array(final_img)
    r, g, b, av = fa[:, :, 0].astype(int), fa[:, :, 1].astype(int), fa[:, :, 2].astype(int), fa[:, :, 3]
    dark_eyes = (av > 100) & (r < 70) & (g < 70) & (b < 70)
    ys, xs = np.where(dark_eyes)
    if len(xs) > 0:
        return xs.mean() / final_img.width, ys.mean() / final_img.height
    return 0.4, 0.25


# ---------------------------- 1) 캐릭터 스프라이트(8종 날개) ----------------------------

def extract_character_sprites(cfg):
    src = f"{SRC_DIR}/{cfg['sheet']}"
    out_dir = f"{SPRITE_OUT}/{cfg['spriteDir']}"
    os.makedirs(out_dir, exist_ok=True)

    im = Image.open(src).convert("RGB")
    arr = np.array(im)
    h, w, _ = arr.shape
    mask, diff = nonwhite_mask(arr)

    scan_mask = mask.copy()
    scan_mask[:130, :320] = False  # 좌상단 로고 제외
    row_density = scan_mask.sum(axis=1)
    # thresh=15(주인공1 원본 기준)로는 주인공2/3 시트의 2번째 행 배너가 캐릭터 밴드에 옅게
    # 이어져 붙는 경우가 있어(실측 확인), 두 시트 모두에서 배너/캐릭터가 안정적으로 분리되는
    # 25를 쓴다.
    bands = find_bands(row_density, thresh=25)
    char_bands = [b for b in bands if (b[1] - b[0]) >= 100]
    assert len(char_bands) == 2, (cfg["id"], "row bands", char_bands)

    anchors = {}
    count = 0
    for row_idx, (y0, y1) in enumerate(char_bands):
        col_density = mask[y0:y1, :].sum(axis=0)
        col_bands = find_bands(col_density, thresh=3)
        col_bands = [b for b in col_bands if (b[1] - b[0]) >= 100]
        assert len(col_bands) == 4, (cfg["id"], "col bands", col_bands)
        for col_idx, (x0, x1) in enumerate(col_bands):
            name = SPRITE_GRID[row_idx][col_idx]
            pad_x, pad_y = 6, 6
            cx0, cy0 = max(0, x0 - pad_x), max(0, y0 - pad_y)
            cx1, cy1 = min(w, x1 + pad_x), min(h, y1 + pad_y)

            region_arr = arr[cy0:cy1, cx0:cx1]
            region_diff = diff[cy0:cy1, cx0:cx1]
            alpha_f = white_bg_alpha(region_arr, region_diff)
            cell_img = Image.fromarray(np.dstack([region_arr, alpha_f]).astype(np.uint8), "RGBA")
            cell_img = clean_fragments(cell_img)

            bbox = cell_img.getbbox()
            bpad = 4
            bx0, by0, bx1, by1 = bbox
            bx0 = max(0, bx0 - bpad); by0 = max(0, by0 - bpad)
            bx1 = min(cell_img.width, bx1 + bpad); by1 = min(cell_img.height, by1 + bpad)
            final = cell_img.crop((bx0, by0, bx1, by1))
            final.save(f"{out_dir}/{name}.png")

            ax, ay = eye_anchor(final)
            anchors[name] = {"w": final.width, "h": final.height, "ax": round(ax, 4), "ay": round(ay, 4)}
            print(cfg["id"], name, final.size, anchors[name])
            count += 1

    with open(f"{out_dir}/anchors.json", "w") as f:
        json.dump(anchors, f, indent=2)
    print(f"[{cfg['id']}] sprites extracted: {count}/8")


# ---------------------------- 2) 차지 이펙트(약/강) ----------------------------

def extract_charge_for_character(cfg):
    out_dir = f"{CHARGE_OUT}/{cfg['id']}"
    os.makedirs(out_dir, exist_ok=True)
    count = 0

    for sheet_idx, sheet_name in enumerate(cfg["charge_sheets"]):
        src = f"{SRC_DIR}/{sheet_name}"
        im = Image.open(src).convert("RGB")
        arr = np.array(im)
        h, w, _ = arr.shape
        mask, diff = nonwhite_mask(arr)

        # 상단 로고+제목+헤더 바를 건너뛰고(y<180) 4개 데이터 행을 밀도 기반으로 검출한다.
        # thresh=20은 행간 옅은 잔여 이펙트(꼬리) 때문에 행이 하나로 뭉개지는 경우가 있어(주인공3
        # 실측 확인), 4개 시트 모두에서 안정적으로 4개 밴드가 나오는 40을 쓴다.
        row_density = mask[180:, :].sum(axis=1)
        bands = find_bands(row_density, thresh=40)
        bands = [(y0 + 180, y1 + 180) for (y0, y1) in bands if (y1 - y0) >= 80]
        assert len(bands) == 4, (cfg["id"], sheet_name, "row bands", bands)

        for row_idx, (y0, y1) in enumerate(bands):
            wing = WING_ORDER[sheet_idx * 4 + row_idx]
            # 행 안에서 [캐릭터 썸네일 | 약검기 | 강검기] 3개 컬럼을 밀도 기반으로 검출.
            col_density = mask[y0:y1, :].sum(axis=0)
            col_bands = find_bands(col_density, thresh=5)
            col_bands = [b for b in col_bands if (b[1] - b[0]) >= 60]
            assert len(col_bands) == 3, (cfg["id"], sheet_name, wing, "col bands", col_bands)

            for stage, (x0, x1) in zip(("weak", "full"), col_bands[1:3]):
                pad = 6
                cx0, cy0 = max(0, x0 - pad), max(0, y0 - pad)
                cx1, cy1 = min(w, x1 + pad), min(h, y1 + pad)
                region_arr = arr[cy0:cy1, cx0:cx1]
                region_diff = diff[cy0:cy1, cx0:cx1]
                alpha_f = white_bg_alpha(region_arr, region_diff)
                cell_img = Image.fromarray(np.dstack([region_arr, alpha_f]).astype(np.uint8), "RGBA")
                cell_img = clean_fragments(cell_img)
                bbox = cell_img.getbbox()
                if bbox is None:
                    print("EMPTY", cfg["id"], wing, stage)
                    continue
                bpad = 4
                bx0, by0, bx1, by1 = bbox
                bx0 = max(0, bx0 - bpad); by0 = max(0, by0 - bpad)
                bx1 = min(cell_img.width, bx1 + bpad); by1 = min(cell_img.height, by1 + bpad)
                final = cell_img.crop((bx0, by0, bx1, by1))
                final.save(f"{out_dir}/{wing}_{stage}.png")
                count += 1

    print(f"[{cfg['id']}] charge extracted: {count}/16")


if __name__ == "__main__":
    for cfg in CHARACTERS:
        extract_character_sprites(cfg)
        extract_charge_for_character(cfg)

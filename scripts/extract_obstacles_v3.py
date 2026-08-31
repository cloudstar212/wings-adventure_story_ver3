"""신규 테마별 장애물 시트(6개 파일, 3단계x10종, 흰 배경) 추출 스크립트.
행 그룹을 밀도 기반으로 자동 검출하고, 행 안에서는 연결요소를 10개 컬럼에 배정해
각 아이콘의 실제 경계를 찾는다 (균등폭 절단으로 인한 이웃 침범/잘림 방지).
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC_DIR = "design"
OUT = "assets/obstacles"
TIER_NAMES = ["small", "medium", "large"]
COLS = 10

THEMES = {
    "fruit": "장애물_과일.png",
    "transport": "장애물_교통수단.png",
    "dessert": "장애물_달콤한 디저트.png",
    "ocean": "장애물_바다모험.png",
    "space": "장애물_우주탐험.png",
    "household": "장애물_집안물건.png",
}


def nonwhite_mask(arr, thresh=30):
    diff = np.abs(arr.astype(int) - 255).sum(axis=2)
    return diff > thresh, diff


def find_bands(density, thresh=20):
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


def find_row_groups(mask, x_lo=300):
    """제목 배너를 제외한 3개 행(작은/중간/큰) 아이콘 영역의 y범위를 찾는다."""
    density = mask[:, x_lo:].sum(axis=1)
    bands = find_bands(density, thresh=20)
    assert len(bands) >= 4, f"unexpected band count {len(bands)}"
    bands = bands[1:]  # 첫 밴드(제목) 제외
    icon_bands = [b for b in bands if (b[1] - b[0]) >= 25]  # 라벨 텍스트(높이<25) 제외

    groups = []
    cur = list(icon_bands[0])
    for b in icon_bands[1:]:
        if b[0] - cur[1] < 70:
            cur[1] = b[1]
        else:
            groups.append(tuple(cur))
            cur = list(b)
    groups.append(tuple(cur))
    assert len(groups) == 3, f"expected 3 row groups, got {len(groups)}: {groups}"
    return groups


def extract_row_icons(arr, mask, diff, y0, y1, x_start=10, x_end=1525, cols=COLS, pad=4):
    region_mask = mask[y0:y1, x_start:x_end]
    h, w = region_mask.shape
    labeled, n = ndimage.label(region_mask, structure=np.ones((3, 3)))
    if n == 0:
        return [None] * cols

    col_w = (x_end - x_start) / cols
    col_centers = [(c + 0.5) * col_w for c in range(cols)]

    slots = [None for _ in range(cols)]
    objs = ndimage.find_objects(labeled)
    for i, sl in enumerate(objs):
        if sl is None:
            continue
        ys, xs = sl
        area = (labeled[sl] == (i + 1)).sum()
        if area < 20:
            continue
        comp_w = xs.stop - xs.start
        comp_h = ys.stop - ys.start
        if comp_w > col_w * 1.9:
            continue
        if comp_h < 8:
            continue
        cx = (xs.start + xs.stop) / 2
        col = min(range(cols), key=lambda c: abs(col_centers[c] - cx))
        bx0, bx1, by0, by1 = xs.start, xs.stop, ys.start, ys.stop
        if slots[col] is None:
            slots[col] = [bx0, by0, bx1, by1]
        else:
            slots[col][0] = min(slots[col][0], bx0)
            slots[col][1] = min(slots[col][1], by0)
            slots[col][2] = max(slots[col][2], bx1)
            slots[col][3] = max(slots[col][3], by1)

    region_arr = arr[y0:y1, x_start:x_end]
    region_diff = diff[y0:y1, x_start:x_end]

    # 배경(진짜 흰 배경)만 투명하게 만든다: diff 임계값만으로는 아이콘 "내부"의 흰색/밝은
    # 하이라이트(도넛 글레이즈, 얼음, 별빛 등)까지 배경으로 오인해 구멍이 뚫리는 문제가
    # 있었다. 이미지 테두리에서부터 거의-흰 픽셀들을 flood-fill로 연결해 "테두리와 이어진
    # 흰 영역"만 진짜 배경으로 간주하고, 그 영역에만 부드러운(안티에일리어싱) 알파를
    # 적용한다. 아이콘 내부에 둘러싸인 흰 하이라이트는 테두리와 연결되지 않으므로
    # 불투명(255)하게 보존된다.
    bgish = region_diff < 45
    labeled_bg, _ = ndimage.label(bgish, structure=np.ones((3, 3)))
    border_labels = (set(labeled_bg[0, :].tolist()) | set(labeled_bg[-1, :].tolist()) |
                      set(labeled_bg[:, 0].tolist()) | set(labeled_bg[:, -1].tolist()))
    border_labels.discard(0)
    bg_connected = np.isin(labeled_bg, list(border_labels)) if border_labels else np.zeros_like(bgish, dtype=bool)
    soft = np.clip((region_diff - 10) * 4, 0, 255)
    alpha_f = np.where(bg_connected, soft, 255).astype(np.uint8)

    rgba = np.dstack([region_arr, alpha_f]).astype(np.uint8)
    full_img = Image.fromarray(rgba, "RGBA")

    results = []
    for col in range(cols):
        if slots[col] is None:
            # 인접 아이콘과 맞닿아 연결요소가 병합된 경우(예: 옅은 광채 효과가 이웃 칸까지
            # 번지는 경우)의 대비책: 해당 컬럼의 엄격한 x범위 내부에서만 흰색이 아닌
            # 픽셀의 bbox를 구해 잘라낸다. 이웃 침범은 없지만 정밀도는 연결요소 방식보다 낮음.
            cx0 = int(col * col_w)
            cx1 = int((col + 1) * col_w)
            strip = region_mask[:, cx0:cx1]
            ys, xs = np.where(strip)
            if len(ys) < 20:
                results.append(None)
                continue
            bx0, bx1 = cx0 + xs.min(), cx0 + xs.max() + 1
            by0, by1 = ys.min(), ys.max() + 1
        else:
            bx0, by0, bx1, by1 = slots[col]
        bx0 = max(0, bx0 - pad)
        by0 = max(0, by0 - pad)
        bx1 = min(w, bx1 + pad)
        by1 = min(h, by1 + pad)
        results.append(clean_fragments(full_img.crop((bx0, by0, bx1, by1))))
    return results


def clean_fragments(img):
    """옅은 광채/입자 효과가 이웃 칸까지 번져 크롭 경계에서 잘린 채로 딸려 들어온
    작은 파편을 제거한다. 크롭 테두리에 닿아 있고 본체보다 훨씬 작은 조각만 지운다
    (아이콘 자체의 정상적인 보조 요소는 보통 테두리에 닿지 않으므로 보존됨)."""
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
        if touches_border and sizes[lbl - 1] < main_area * 0.2:
            drop |= labeled == lbl
    if drop.any():
        arr = np.array(img)
        arr[drop, 3] = 0
        img = Image.fromarray(arr, "RGBA")
    return img


count = 0
for theme, fname in THEMES.items():
    path = os.path.join(SRC_DIR, fname)
    im = Image.open(path).convert("RGB")
    arr = np.array(im)
    mask, diff = nonwhite_mask(arr)
    groups = find_row_groups(mask)
    for tier_idx, (y0, y1) in enumerate(groups):
        tier = TIER_NAMES[tier_idx]
        icons = extract_row_icons(arr, mask, diff, y0, y1)
        dirpath = f"{OUT}/{theme}/{tier}"
        os.makedirs(dirpath, exist_ok=True)
        for c, icon in enumerate(icons):
            if icon is None:
                print("EMPTY", theme, tier, c)
                continue
            icon.save(f"{dirpath}/{c}.png")
            count += 1
    print(theme, "rows:", groups)

print(f"extracted {count} icons")

"""신규 캐릭터+날개 시트(흰 배경, 배너+캐릭터 2행x4열)에서 8종 날개 스프라이트를 추출한다.
같은 포즈가 반복되므로 얼굴(눈) 중심을 기준 앵커로 자동 검출해 anchors.json을 갱신한다."""
import json
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = "design/캐릭터 및 날개 디자인.png"
OUT = "assets/sprites"

# (행, 열) 순서 = WINGS 배열 순서
NAMES = [
    ["basic", "golden", "cloud", "rainbow"],
    ["sky", "flame", "water", "electric"],
]


def nonwhite_mask(arr, thresh=30):
    diff = np.abs(arr.astype(int) - 255).sum(axis=2)
    return diff > thresh, diff


def find_bands(density, thresh=15):
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


def remove_rainbow_bg_arc(img):
    """무지개 날개 원본 셀에는 캐릭터 뒤에 장식용 배경 무지개 궤적이 그려져 있어,
    날개(팔레트가 겹치는 진짜 무지개색 깃털)와 헷갈리지 않도록 좌표 기반으로 지운다.
    캐릭터 머리 위(y<100)·오른쪽(x>150)의 옅은(파스텔) 픽셀만 대상으로 하고, 머리카락
    경계에 남는 색 번짐도 별도로 정리한다. (크롭 결과가 항상 같은 좌표계이므로 안전)"""
    a = np.array(img).astype(int)
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    minc = np.minimum(np.minimum(r, g), b)
    ih, iw = al.shape
    xs = np.arange(iw)[None, :]
    ys = np.arange(ih)[:, None]
    erase = (al > 0) & (ys < 100) & (xs > 150) & (minc > 135)
    out = a.copy()
    out[erase, 3] = 0

    zone = (ys >= 50) & (ys <= 75) & (xs >= 245) & (xs <= 270)
    r2, g2, b2, al2 = out[:, :, 0], out[:, :, 1], out[:, :, 2], out[:, :, 3]
    contam = zone & (al2 > 0) & (b2 > r2 * 0.45) & (r2 < 200)
    out[contam, 3] = 0
    return Image.fromarray(out.astype(np.uint8), "RGBA")


im = Image.open(SRC).convert("RGB")
arr = np.array(im)
h, w, _ = arr.shape
mask, diff = nonwhite_mask(arr)

# 배너(제목바)를 제외한 캐릭터 행 y범위 자동 검출 (좌상단 로고 영역은 제외)
scan_mask = mask.copy()
scan_mask[:130, :320] = False
row_density = scan_mask.sum(axis=1)
bands = find_bands(row_density, thresh=15)
# 배너(높이<40)는 제외, 캐릭터 본문 밴드만 남긴다
char_bands = [b for b in bands if (b[1] - b[0]) >= 100]
assert len(char_bands) == 2, char_bands

anchors = {}
count = 0
for row_idx, (y0, y1) in enumerate(char_bands):
    col_density = mask[y0:y1, :].sum(axis=0)
    col_bands = find_bands(col_density, thresh=3)
    col_bands = [b for b in col_bands if (b[1] - b[0]) >= 100]
    assert len(col_bands) == 4, col_bands
    for col_idx, (x0, x1) in enumerate(col_bands):
        name = NAMES[row_idx][col_idx]
        pad_x, pad_y = 6, 6
        cx0, cy0 = max(0, x0 - pad_x), max(0, y0 - pad_y)
        cx1, cy1 = min(w, x1 + pad_x), min(h, y1 + pad_y)

        region_arr = arr[cy0:cy1, cx0:cx1]
        region_diff = diff[cy0:cy1, cx0:cx1]

        # 배경(진짜 흰 배경)만 투명하게 만든다: diff 임계값만으로는 캐릭터/날개 "내부"의
        # 흰색·밝은 하이라이트(구름 날개의 흰 구름, 기본 날개의 흰 깃털 등)까지 배경으로
        # 오인해 구멍이 뚫리는 문제가 있었다. 이미지 테두리에서부터 거의-흰 픽셀들을
        # flood-fill로 연결해 "테두리와 이어진 흰 영역"만 진짜 배경으로 간주하고, 그
        # 영역에만 부드러운(안티에일리어싱) 알파를 적용한다. 캐릭터 내부에 둘러싸인 흰
        # 하이라이트는 테두리와 연결되지 않으므로 불투명(255)하게 보존된다.
        bgish = region_diff < 45
        labeled_bg, _ = ndimage.label(bgish, structure=np.ones((3, 3)))
        border_labels = (set(labeled_bg[0, :].tolist()) | set(labeled_bg[-1, :].tolist()) |
                          set(labeled_bg[:, 0].tolist()) | set(labeled_bg[:, -1].tolist()))
        border_labels.discard(0)
        bg_connected = np.isin(labeled_bg, list(border_labels)) if border_labels else np.zeros_like(bgish, dtype=bool)
        soft = np.clip((region_diff - 10) * 4, 0, 255)
        alpha_f = np.where(bg_connected, soft, 255).astype(np.uint8)

        rgba = np.dstack([region_arr, alpha_f]).astype(np.uint8)
        cell_img = Image.fromarray(rgba, "RGBA")
        cell_img = clean_fragments(cell_img)

        bbox = cell_img.getbbox()
        bpad = 4
        bx0, by0, bx1, by1 = bbox
        bx0 = max(0, bx0 - bpad)
        by0 = max(0, by0 - bpad)
        bx1 = min(cell_img.width, bx1 + bpad)
        by1 = min(cell_img.height, by1 + bpad)
        final = cell_img.crop((bx0, by0, bx1, by1))
        if name == "rainbow":
            final = remove_rainbow_bg_arc(final)
        final.save(f"{OUT}/{name}.png")

        # 얼굴(눈) 위치를 앵커 기준점으로 사용: 진한 검은색(눈동자) 픽셀 군집의 중심을 찾고
        # 캐릭터 몸통(가슴/벨트)은 눈에서 아래로 일정 비율 떨어진 위치로 근사한다.
        fa = np.array(final)
        r, g, b, av = fa[:, :, 0].astype(int), fa[:, :, 1].astype(int), fa[:, :, 2].astype(int), fa[:, :, 3]
        dark_eyes = (av > 100) & (r < 70) & (g < 70) & (b < 70)
        ys, xs = np.where(dark_eyes)
        if len(xs) > 0:
            eye_cx = xs.mean()
            eye_cy = ys.mean()
        else:
            eye_cx, eye_cy = final.width * 0.4, final.height * 0.25

        anchors[name] = {
            "w": final.width, "h": final.height,
            "ax": round(eye_cx / final.width, 4),
            "ay": round(eye_cy / final.height, 4),
        }
        print(name, final.size, anchors[name])
        count += 1

with open(f"{OUT}/anchors.json", "w") as f:
    json.dump(anchors, f, indent=2)
print(f"extracted {count} sprites")

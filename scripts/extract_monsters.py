"""몬스터 시트 2장(design/몬스터 20종.png, 몬스터 20종_2.png)에서 캐릭터 40종을 추출한다.
장애물 추출 스크립트(extract_obstacles_v3.py)의 크롭 방식(연결요소 클러스터링 + 소프트 알파 +
이웃 침범 대비 strict-column 대비책 + 파편 제거)을 그대로 재사용하되, 이 시트는 라벨(번호
배지+텍스트)이 아이콘 "위"에 있고 4행 x 5열 구성이라는 점만 다르다.
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC_DIR = "design"
OUT = "assets/monsters"
COLS = 5
ROWS = 4

# 각 시트의 20종을 번호 순서(좌->우, 위->아래)대로 나열한 영문 슬러그.
# "유령 기사"가 두 시트에 각각 등장해(원본 시트 자체의 중복) 두 번째 것은 _2로 구분.
SHEETS = [
    ("몬스터 20종.png", [
        "slime", "fire_slime", "goblin", "skeleton_warrior", "orc",
        "bat", "dark_mage", "werewolf", "mimic", "spiky_cactus",
        "baby_phoenix", "viper", "spider", "zombie", "red_ogre",
        "hell_witch", "stone_golem", "bomb_monster", "baby_dragon", "ghost_knight",
    ]),
    ("몬스터 20종_2.png", [
        "ice_slime", "lightning_pixie", "rock_turtle", "shadow_wraith", "poison_mushroom",
        "skeleton_archer", "ghost_knight_2", "sand_worm", "bouncy_jellyfish", "armored_boar",
        "wind_sprite", "magma_golem", "ghost_bat", "cursed_doll", "night_owl",
        "sticky_blob", "sea_drake", "bone_dokkaebi", "eye_of_doom", "ice_golem",
    ]),
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


def find_icon_row_bands(mask):
    """제목 배너를 제외한 4개 행의 "아이콘 전용" y범위를 찾는다.
    각 행은 위쪽에 번호배지+텍스트 라벨(높이 약 37~39px), 아래에 캐릭터 아이콘이 있다.
    캐릭터 그림이 라벨 줄에 살짝 닿아 하나의 밴드로 합쳐지는 경우가 있어(예: 날개 달린
    캐릭터), 그런 경우 라벨 높이 직후 구간에서 밀도가 가장 낮은 지점을 경계로 다시 분리한다."""
    density = mask.sum(axis=1)
    bands = find_bands(density, thresh=15)
    bands = bands[1:]  # 첫 밴드(제목) 제외

    icon_bands = []
    for (y0, y1) in bands:
        height = y1 - y0
        if height <= 55:
            continue  # 라벨(배지+텍스트)만 있는 밴드는 건너뜀
        if height <= 185:
            icon_bands.append((y0, y1))  # 이미 라벨과 분리된 순수 아이콘 밴드
        else:
            search_lo, search_hi = y0 + 20, min(y0 + 60, y1)
            split = min(range(search_lo, search_hi), key=lambda y: density[y])
            icon_bands.append((split, y1))

    assert len(icon_bands) == ROWS, f"expected {ROWS} icon row bands, got {len(icon_bands)}: {icon_bands}"
    return icon_bands


def clean_fragments(img, min_ratio=0.2):
    """옅은 배경 잔여물 등으로 크롭 경계에 딸려 들어온, 본체보다 훨씬 작고 테두리에
    닿은 파편만 제거한다(정상적인 보조 요소는 테두리에 닿지 않으므로 보존됨)."""
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


def extract_row_icons(arr, mask, diff, y0, y1, x_start=20, x_end=1520, cols=COLS, pad=4):
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
            continue  # 칸 폭을 훨씬 넘는 요소는 이웃 침범/테두리선으로 간주해 제외
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

    # 배경(진짜 흰 배경)만 투명하게 만든다: diff 임계값만으로는 캐릭터 "내부"의 흰색/밝은
    # 하이라이트(뼈, 별빛, 얼음 반사광 등)까지 배경으로 오인해 구멍이 뚫리는 문제가 있었다.
    # 이미지 테두리에서부터 거의-흰 픽셀들을 flood-fill로 연결해 "테두리와 이어진 흰 영역"만
    # 진짜 배경으로 간주하고, 그 영역에만 부드러운(안티에일리어싱) 알파를 적용한다. 캐릭터
    # 내부에 둘러싸인 흰 하이라이트는 테두리와 연결되지 않으므로 불투명(255)하게 보존된다.
    # 주의: 한때 "테두리와 안 이어져 있어도 아주 넓고 순백에 가까운 덩어리는 배경으로
    # 취급"하는 2차 보정을 추가했었지만, 이게 해파리 머리 광택·아이스 슬라임 정수리
    # 광택·섀도우 레이스 한쪽 눈처럼 캐릭터 내부의 "크고 순백에 가까운" 정상적인
    # 하이라이트까지 배경으로 오인해 지워버리는 문제가 있어 제거했다. 순수하게
    # "테두리와 실제로 이어진 흰 영역"만 배경으로 간주한다 — 그 대가로 다리 사이처럼
    # 완전히 둘러싸인 배경 구멍은 불투명하게 남을 수 있지만, 하이라이트를 지우는 것보다
    # 훨씬 덜 눈에 띄는 부작용이라 이쪽을 택했다.
    bgish = region_diff < 45
    labeled_bg, n_bg = ndimage.label(bgish, structure=np.ones((3, 3)))
    rh, rw = bgish.shape
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
            # 인접 캐릭터와 맞닿아 연결요소가 병합된 경우의 대비책: 해당 컬럼의 엄격한
            # x범위 내부에서만 흰색이 아닌 픽셀의 bbox를 구해 잘라낸다.
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


os.makedirs(OUT, exist_ok=True)
count = 0
for fname, slugs in SHEETS:
    path = os.path.join(SRC_DIR, fname)
    im = Image.open(path).convert("RGB")
    arr = np.array(im)
    mask, diff = nonwhite_mask(arr)
    row_bands = find_icon_row_bands(mask)
    print(fname, "row bands:", row_bands)

    for row_idx, (y0, y1) in enumerate(row_bands):
        icons = extract_row_icons(arr, mask, diff, y0, y1)
        for col_idx, icon in enumerate(icons):
            slug = slugs[row_idx * COLS + col_idx]
            if icon is None:
                print("EMPTY", fname, row_idx, col_idx, slug)
                continue
            icon.save(f"{OUT}/{slug}.png")
            count += 1

print(f"extracted {count} monster icons")

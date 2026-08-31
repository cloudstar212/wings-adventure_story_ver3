"""design/의 이펙트 관련 시트 5장에서 5개 카테고리(charge/projectile/minion/thrown/zone)를
assets/effects/에 추출한다. 흰 배경 시트(minion/thrown/zone)는 extract_obstacles_v3.py와 같은
"테두리 flood-fill로 진짜 배경만 투명화"(내부 하이라이트 보존) 방식을 쓰고, 어두운 배경 시트
(charge/projectile)는 발광 이펙트라는 특성상 밝기 자체를 알파로 쓰는(밝을수록 불투명) 방식을 쓴다.
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC_DIR = "design"
OUT = "assets/effects"

WING_ORDER = ["basic", "golden", "cloud", "rainbow", "sky", "flame", "water", "electric"]

PROJECTILE_TYPES = ["fireball", "dark_orb", "lightning_bolt", "arrow", "water_breath"]
THROWN_TYPES = ["spike", "boulder", "sandstorm", "ice_shard", "lava_chunk"]
MINION_TYPES = ["baby_spider", "curse_pin"]
ZONE_TYPES = [
    "fire_slime_zone", "ice_slime_zone", "poison_mushroom_zone", "jellyfish_zone",
    "viper_zone", "bomb_zone", "eye_of_doom_zone", "sticky_puddle", "wind_vortex",
]


# ---------------------------- 공용 유틸 ----------------------------

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


def dark_bg_alpha(region_arr, thresh=30, scale=6):
    """어두운 배경 시트용: 발광 이펙트라 배경/전경이 밝기만으로 충분히 구분된다(밝을수록 불투명)."""
    brightness = region_arr.max(axis=2)
    return np.clip((brightness.astype(int) - thresh) * scale, 0, 255).astype(np.uint8)


def protected_dark_alpha(region_arr, bg_thresh=50, strong_t=90, radius=12):
    """dark_bg_alpha의 thresh=30은 실제 배경(밝기 27~47대)보다 낮아서, 크롭 여백이 넓은
    이미지에서는 배경이 옅은 회색/청색 안개처럼 반투명하게 남는다(완전히 투명해지지 않음).
    bg_thresh를 배경 밝기보다 높게 올려 배경을 확실히 alpha=0으로 만들되, 그 여파로
    불꽃/구슬 등 본체 내부의 어두운 디테일까지 함께 지워지지 않도록 밝은(strong_t 이상)
    본체 덩어리 주변 radius px만 보호 영역으로 남겨 그 안에서는 기존 dark_bg_alpha 값을
    그대로 쓴다(§11 charge/weak 재추출, projectile과 동일한 방식)."""
    brightness = region_arr.max(axis=2)
    alpha = np.clip((brightness.astype(int) - bg_thresh) * 6, 0, 255).astype(np.uint8)
    strong = brightness > strong_t
    labeled, n = ndimage.label(strong, structure=np.ones((3, 3)))
    if n == 0:
        return alpha
    sizes = ndimage.sum(np.ones_like(strong), labeled, range(1, n + 1))
    keep = [i + 1 for i in range(n) if sizes[i] >= 50]
    body = np.isin(labeled, keep)
    protect = ndimage.binary_dilation(body, structure=np.ones((radius * 2 + 1, radius * 2 + 1)))
    return np.where(protect, alpha, 0).astype(np.uint8)


def extract_row_icons_white(arr, mask, diff, y0, y1, x_start, x_end, cols, pad=4):
    """흰 배경 시트: 한 행을 cols개 컬럼으로 연결요소 클러스터링해 잘라낸다
    (extract_obstacles_v3.py의 방식을 그대로 재사용)."""
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
    alpha_f = white_bg_alpha(region_arr, region_diff)
    full_img = Image.fromarray(np.dstack([region_arr, alpha_f]).astype(np.uint8), "RGBA")

    results = []
    for col in range(cols):
        if slots[col] is None:
            cx0, cx1 = int(col * col_w), int((col + 1) * col_w)
            strip = region_mask[:, cx0:cx1]
            ys, xs = np.where(strip)
            if len(ys) < 20:
                results.append(None)
                continue
            bx0, bx1 = cx0 + xs.min(), cx0 + xs.max() + 1
            by0, by1 = ys.min(), ys.max() + 1
        else:
            bx0, by0, bx1, by1 = slots[col]
        bx0 = max(0, bx0 - pad); by0 = max(0, by0 - pad)
        bx1 = min(w, bx1 + pad); by1 = min(h, by1 + pad)
        results.append(clean_fragments(full_img.crop((bx0, by0, bx1, by1))))
    return results


def extract_row_icons_dark(arr, mask, y0, y1, x_start, x_end, cols, pad=4):
    """어두운 배경 시트: 위와 동일한 컬럼 클러스터링이지만 밝기 기반 마스크/알파를 쓴다."""
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
        if area < 15:
            continue
        comp_w = xs.stop - xs.start
        if comp_w > col_w * 1.95:
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
    alpha_f = dark_bg_alpha(region_arr)
    full_img = Image.fromarray(np.dstack([region_arr, alpha_f]).astype(np.uint8), "RGBA")

    results = []
    for col in range(cols):
        if slots[col] is None:
            # 광원 효과끼리 옅은 잔광/번개줄기로 이어져 연결요소가 통째로 병합되고(그래서
            # 폭 제한에 걸려 제외된) 경우의 대비책: 해당 컬럼의 엄격한 x범위 내부에서만
            # 밝은 픽셀의 bbox를 구해 잘라낸다(이웃 침범은 없음).
            cx0 = int(col * col_w)
            cx1 = int((col + 1) * col_w)
            strip = region_mask[:, cx0:cx1]
            ys, xs = np.where(strip)
            if len(ys) < 15:
                results.append(None)
                continue
            bx0, bx1 = cx0 + xs.min(), cx0 + xs.max() + 1
            by0, by1 = ys.min(), ys.max() + 1
        else:
            bx0, by0, bx1, by1 = slots[col]
        bx0 = max(0, bx0 - pad); by0 = max(0, by0 - pad)
        bx1 = min(w, bx1 + pad); by1 = min(h, by1 + pad)
        results.append(clean_fragments(full_img.crop((bx0, by0, bx1, by1))))
    return results


def extract_windowed_dark(arr, mask, y0, y1, col_bounds, pad=5):
    """어두운 배경 시트에서, 이웃 티어끼리 잔광/파편으로 겹쳐 연결요소 클러스터링이
    깨지는 행(예: 서로 다른 크기의 구체/번개가 잔상으로 이어진 경우)에 쓰는 대안.
    컬럼 경계를 자동 검출하지 않고 육안으로 확인한 x범위(col_bounds, 길이 cols+1)를
    그대로 하드 경계로 써서, 그 범위 안의 밝은 픽셀 bbox만 잘라낸다 - 이웃 칸 픽셀이
    아무리 이어져 있어도 경계를 넘어가지 않는다."""
    region_mask_full = mask[y0:y1, :]
    results = []
    for i in range(len(col_bounds) - 1):
        cx0, cx1 = col_bounds[i], col_bounds[i + 1]
        strip = region_mask_full[:, cx0:cx1]
        ys, xs = np.where(strip)
        if len(ys) < 15:
            results.append(None)
            continue
        bx0 = max(0, cx0 + xs.min() - pad)
        bx1 = min(arr.shape[1], cx0 + xs.max() + 1 + pad)
        by0 = max(0, y0 + ys.min() - pad)
        by1 = min(arr.shape[0], y0 + ys.max() + 1 + pad)
        region_arr = arr[by0:by1, bx0:bx1]
        alpha = dark_bg_alpha(region_arr)
        img = Image.fromarray(np.dstack([region_arr, alpha]).astype(np.uint8), "RGBA")
        results.append(clean_fragments(img))
    return results


def find_content_span(colsum, gap_thresh=3, min_gap=20, min_run=6):
    """1차원 밀도 배열에서 "진짜 내용"의 (시작,끝) 구간을 찾는다. 검기 이펙트 주변에
    흩뿌려진 낱개 반짝임 파편이 만드는 1~2픽셀짜리 노이즈 스파이크를 시작점으로 오인하지
    않도록, 최소 min_run 이상 연속으로 밀도가 threshold를 넘는 지점을부터를 "진짜 시작"으로
    삼는다. 그 뒤 min_gap 이상 연속으로 빈(<=gap_thresh) 구간이 나오면 그 직전까지가 끝
    (스트릭 오른쪽의 텍스트 라벨과 분리하는 경계)."""
    n = len(colsum)
    above = colsum > gap_thresh
    i = 0
    content_start = None
    while i < n:
        if above[i]:
            j = i
            while j < n and above[j]:
                j += 1
            if j - i >= min_run:
                content_start = i
                break
            i = j
        else:
            i += 1
    if content_start is None:
        return None, None

    i = content_start
    gap_count = 0
    while i < n:
        if colsum[i] <= gap_thresh:
            gap_count += 1
            if gap_count >= min_gap:
                return content_start, i - gap_count
        else:
            gap_count = 0
        i += 1
    return content_start, n


# ---------------------------- CHARGE (플레이어 차지 공격) ----------------------------

def extract_charge():
    path = f"{SRC_DIR}/플레이어 차지 공격(검기).png"
    im = Image.open(path).convert("RGB")
    arr = np.array(im)
    brightness = arr.max(axis=2)
    H, W = brightness.shape

    # 표 안의 실제 금색 구분선 위치를 육안으로 확인해 얻은 경계값(8행, 높이가 균일하지
    # 않음 - 균등 분할을 썼더니 불꽃/물 행처럼 짧은 행 사이에서 옆 행 이펙트가 섞여
    # 들어오는 문제가 있었음).
    ROW_BOUNDS = [113, 228, 338, 438, 545, 655, 745, 855, 965]
    os.makedirs(f"{OUT}/charge", exist_ok=True)

    count = 0
    for i, wing in enumerate(WING_ORDER):
        y0 = ROW_BOUNDS[i]
        y1 = ROW_BOUNDS[i + 1]
        # weak는 원래 (300,790) 범위를 썼으나, 이펙트 잔광이 옅게 이어지다 보니
        # find_content_span의 간격 판정이 오른쪽의 "OO 검기" 설명 글씨까지 하나로
        # 묶어버렸다(실제 이펙트는 xb=670 안쪽에서 끝나고 글씨는 684 이후에 시작 -
        # 육안 확인). full은 이 문제가 없어 그대로 둔다.
        for stage, (xa, xb) in [("weak", (300, 670)), ("full", (800, 1536))]:
            sub_mask = brightness[y0:y1, xa:xb] > 40
            colsum = sub_mask.sum(axis=0)
            cstart, cend = find_content_span(colsum)
            if cstart is None:
                print("EMPTY charge", wing, stage)
                continue
            rows_with_content = np.where(sub_mask[:, cstart:cend].any(axis=1))[0]
            if len(rows_with_content) == 0:
                print("EMPTY charge(row)", wing, stage)
                continue
            pad = 6
            bx0 = max(0, xa + cstart - pad)
            bx1 = min(W, xa + cend + pad)
            by0 = max(0, y0 + rows_with_content.min() - pad)
            by1 = min(H, y0 + rows_with_content.max() + 1 + pad)
            if stage == "weak":
                # 세로 패딩이 행 경계를 넘어가면 위/아래 행 사이 구분선이 얇게
                # 섞여 들어온다(육안 확인) - weak만 행 범위 안으로 되돌린다.
                by0 = max(by0, y0)
                by1 = min(by1, y1)
                # 그래도 행 안쪽에 옅게 남아있던 구분선(육안 확인 후 실측한 픽셀
                # 위치)만 개별적으로 잘라낸다 - 이펙트 본체는 이 선들보다 안쪽에서
                # 시작/끝나므로 잘리지 않는다.
                trim = {"basic": ("top", 7), "golden": ("bottom", 103),
                        "cloud": ("bottom", 88), "rainbow": ("bottom", 79),
                        "sky": ("bottom", 88)}.get(wing)
                if trim:
                    edge, row = trim
                    if edge == "top":
                        by0 = by0 + row
                    else:
                        by1 = by0 + row

            region = arr[by0:by1, bx0:bx1]
            # weak는 크롭 여백이 넓어 배경이 반투명 안개로 남는 문제가 있어 protected_dark_alpha를
            # 쓴다(육안 확인, 2026-08-15). full은 크롭이 이미 타이트해 문제가 없어 그대로 둔다.
            alpha = protected_dark_alpha(region) if stage == "weak" else dark_bg_alpha(region)
            img = Image.fromarray(np.dstack([region, alpha]).astype(np.uint8), "RGBA")
            img = clean_fragments(img)
            img.save(f"{OUT}/charge/{wing}_{stage}.png")
            count += 1
    print(f"charge: extracted {count}/16")


# ---------------------------- PROJECTILE (몬스터 투사체) ----------------------------

def extract_projectile():
    path = f"{SRC_DIR}/몬스터 투사체.png"
    im = Image.open(path).convert("RGB")
    arr = np.array(im)
    mask = arr.max(axis=2) > 40

    # 화염구/화살은 항목끼리 충분히 분리되어 연결요소 클러스터링(자동 컬럼 검출)이 잘 맞는다.
    # 반면 어둠 구슬/번개 볼트/물 브레스는 티어가 커질수록 옅은 잔향(연기/번개줄기/포말)이
    # 옆 티어까지 넓게 이어져 자동 클러스터링이 깨지므로, 육안으로 확인한 x경계를 그대로
    # 하드 경계로 쓰는 windowed 방식을 쓴다.
    rows_cc = {
        "fireball": (120, 285),
        "arrow": (665, 805),
    }
    rows_windowed = {
        "dark_orb": (300, 465, [270, 435, 625, 865, 1185, 1536]),
        "lightning_bolt": (490, 655, [270, 400, 640, 890, 1185, 1536]),
        "water_breath": (835, 1005, [270, 400, 605, 880, 1235, 1536]),
    }

    os.makedirs(f"{OUT}/projectile", exist_ok=True)
    count = 0
    for ptype in PROJECTILE_TYPES:
        if ptype in rows_cc:
            y0, y1 = rows_cc[ptype]
            icons = extract_row_icons_dark(arr, mask, y0, y1, x_start=270, x_end=1536, cols=5)
        else:
            y0, y1, bounds = rows_windowed[ptype]
            icons = extract_windowed_dark(arr, mask, y0, y1, bounds)
        for c, icon in enumerate(icons):
            tier = c + 1
            if icon is None:
                print("EMPTY projectile", ptype, tier)
                continue
            icon.save(f"{OUT}/projectile/{ptype}_{tier}.png")
            count += 1
    print(f"projectile: extracted {count}/25 (원본 시트에 5종 x 5티어 = 25장만 존재 — 30장 아님, 보고 참조)")


# ---------------------------- MINION (몬스터 미니언) ----------------------------

def extract_minion():
    path = f"{SRC_DIR}/몬스터 미니언.png"
    im = Image.open(path).convert("RGB")
    arr = np.array(im)
    diff = np.abs(arr.astype(int) - 255).sum(axis=2)
    mask = diff > 30

    rows = [(150, 410), (570, 836)]
    os.makedirs(f"{OUT}/minion", exist_ok=True)
    count = 0
    for r, (y0, y1) in enumerate(rows):
        mtype = MINION_TYPES[r]
        # 0번 컬럼(x 20~320)이 설명 라벨(배지+텍스트)에 밀려 실제 아이콘 1·2번이 1번
        # 컬럼(x 320~620)에 함께 겹쳐 들어가는 문제가 있어, 라벨 뒤(x 290~650)만 따로
        # 2컬럼으로 잘라 1·2번을 만든다. 3·4·5번은 기존 5컬럼 그리드가 이미 정확하다.
        icons_12 = extract_row_icons_white(arr, mask, diff, y0, y1, x_start=290, x_end=650, cols=2)
        icons_345 = extract_row_icons_white(arr, mask, diff, y0, y1, x_start=20, x_end=1520, cols=5)[2:5]
        icons = icons_12 + icons_345
        for c, icon in enumerate(icons):
            tier = c + 1
            if icon is None:
                print("EMPTY minion", mtype, tier)
                continue
            icon.save(f"{OUT}/minion/{mtype}_{tier}.png")
            count += 1
    print(f"minion: extracted {count}/10")


# ---------------------------- THROWN (몬스터 투척 장애물) ----------------------------

def extract_thrown():
    path = f"{SRC_DIR}/몬스터 투척 장애물.png"
    im = Image.open(path).convert("RGB")
    arr = np.array(im)
    diff = np.abs(arr.astype(int) - 255).sum(axis=2)
    mask = diff > 30

    rows = [(110, 285), (318, 462), (486, 636), (662, 800), (820, 984)]
    os.makedirs(f"{OUT}/thrown", exist_ok=True)
    count = 0
    # 옆 컬럼의 잔여 파티클 파편이 클러스터링 시 함께 딸려 들어온 케이스만 수동 보정
    # (본체와 큰 간격을 두고 반대쪽 끝에 고립된 작은 조각들).
    EDGE_TRIM = {
        ("boulder", 3): ("left", 50),
        ("boulder", 4): ("right", 230),
        ("ice_shard", 4): ("right", 250),
        ("lava_chunk", 3): ("left", 50),
        ("lava_chunk", 4): ("right", 240),
    }
    for r, (y0, y1) in enumerate(rows):
        ttype = THROWN_TYPES[r]
        # minion과 동일한 문제: 0번 컬럼(x 20~320)이 설명 라벨(배지+텍스트)에 밀려 실제
        # 아이콘 1·2번이 1번 컬럼(x 320~620)에 함께 겹쳐 들어간다. 라벨 뒤(x 290~700)만
        # 따로 2컬럼으로 잘라 1·2번을 만들고, 3·4·5번은 기존 5컬럼 그리드를 그대로 쓴다.
        icons_12 = extract_row_icons_white(arr, mask, diff, y0, y1, x_start=290, x_end=700, cols=2)
        icons_345 = extract_row_icons_white(arr, mask, diff, y0, y1, x_start=20, x_end=1520, cols=5)[2:5]
        icons = icons_12 + icons_345
        for c, icon in enumerate(icons):
            tier = c + 1
            if icon is None:
                print("EMPTY thrown", ttype, tier)
                continue
            trim = EDGE_TRIM.get((ttype, tier))
            if trim:
                edge, cut = trim
                w, h = icon.size
                box = (cut, 0, w, h) if edge == "left" else (0, 0, cut, h)
                icon = icon.crop(box)
                a = np.array(icon.split()[-1])
                ys2, xs2 = np.where(a > 0)
                icon = icon.crop((int(xs2.min()), int(ys2.min()), int(xs2.max()) + 1, int(ys2.max()) + 1))
            icon.save(f"{OUT}/thrown/{ttype}_{tier}.png")
            count += 1
    print(f"thrown: extracted {count}/25")


# ---------------------------- ZONE (몬스터 장판 & 필드 이펙트) ----------------------------

def extract_zone():
    path = f"{SRC_DIR}/몬스터 장판, 필드이펙트.png"
    im = Image.open(path).convert("RGB")
    arr = np.array(im)
    diff = np.abs(arr.astype(int) - 255).sum(axis=2)
    mask = diff > 30
    H, W = mask.shape
    os.makedirs(f"{OUT}/zone", exist_ok=True)
    count = 0

    # 1) 장판 이펙트(경고 구역) 7종: 한 행, 7컬럼
    row1_bounds = [(20, 226), (236, 434), (443, 651), (664, 878), (889, 1080), (1087, 1283), (1295, 1512)]
    y0, y1 = 260, 555
    for i, (cx0, cx1) in enumerate(row1_bounds):
        ztype = ZONE_TYPES[i]
        sub_mask = mask[y0:y1, cx0:cx1]
        ys, xs = np.where(sub_mask)
        if len(ys) == 0:
            print("EMPTY zone", ztype)
            continue
        pad = 4
        bx0 = max(0, cx0 + xs.min() - pad); bx1 = min(W, cx0 + xs.max() + 1 + pad)
        by0 = max(0, y0 + ys.min() - pad); by1 = min(H, y0 + ys.max() + 1 + pad)
        region_arr = arr[by0:by1, bx0:bx1]
        region_diff = diff[by0:by1, bx0:bx1]
        alpha = white_bg_alpha(region_arr, region_diff)
        img = Image.fromarray(np.dstack([region_arr, alpha]).astype(np.uint8), "RGBA")
        img = clean_fragments(img)
        img.save(f"{OUT}/zone/{ztype}.png")
        count += 1

    # 2) 슬로우 필드 이펙트(지속 구역) 2종: 좌/우 절반으로 분할
    # 각 절반 왼쪽 위에 번호 배지+이름 라벨이 이펙트 아트와 별개의 연결요소로 붙어 있어
    # (아트 쪽 흰 배경과 라벨 사이에 뚜렷한 x 갭이 없어 단순 컬럼 절단으로는 못 자름),
    # 라벨을 이루는 작은 연결요소만 선택적으로 지운다: 라벨 글자/배지는 전부 이 구역의
    # 왼쪽 위(y<=100, x<=400)에 몰려 있고 실제 이펙트 아트(가장 큰 연결요소 포함)는
    # 거기서 벗어나 있으므로, "y<=100 및 x 시작<=400" 조건을 만족하는 연결요소만 제거한다.
    y0, y1 = 670, 950
    for i, (cx0, cx1) in enumerate([(0, 750), (750, W)]):
        ztype = ZONE_TYPES[7 + i]
        sub_mask = mask[y0:y1, cx0:cx1].copy()
        labeled, n = ndimage.label(sub_mask, structure=np.ones((3, 3)))
        objs = ndimage.find_objects(labeled)
        for j, sl in enumerate(objs):
            if sl is None:
                continue
            ys_c, xs_c = sl
            if ys_c.stop <= 100 and xs_c.start <= 400:
                sub_mask[labeled == (j + 1)] = False
        ys, xs = np.where(sub_mask)
        if len(ys) == 0:
            print("EMPTY zone", ztype)
            continue
        pad = 4
        bx0 = max(0, cx0 + xs.min() - pad); bx1 = min(W, cx0 + xs.max() + 1 + pad)
        by0 = max(0, y0 + ys.min() - pad); by1 = min(H, y0 + ys.max() + 1 + pad)
        region_arr = arr[by0:by1, bx0:bx1]
        region_diff = diff[by0:by1, bx0:bx1]
        alpha = white_bg_alpha(region_arr, region_diff)
        # bbox만 좁혀서는 라벨이 사각형 crop 안에 다시 포함될 수 있으므로(다른 kept 요소가
        # bbox를 넓히면), 라벨 요소를 제거한 sub_mask를 최종 crop 영역에 맞춰 잘라 알파에도
        # 픽셀 단위로 그대로 반영한다.
        kept_full = np.zeros((H, W), dtype=bool)
        kept_full[y0:y1, cx0:cx1] = sub_mask
        keep_crop = kept_full[by0:by1, bx0:bx1]
        alpha = np.where(keep_crop, alpha, 0).astype(np.uint8)
        if ztype == "wind_vortex":
            # 원본 시트의 좌/우 셀 경계 점선(가장 왼쪽 14px 안에만 존재, 실제 토네이도
            # 아트는 그보다 한참 오른쪽에서 시작함)을 잘라낸다.
            alpha[:, :14] = 0
        img = Image.fromarray(np.dstack([region_arr, alpha]).astype(np.uint8), "RGBA")
        img = clean_fragments(img)
        img.save(f"{OUT}/zone/{ztype}.png")
        count += 1

    print(f"zone: extracted {count}/9")


if __name__ == "__main__":
    extract_charge()
    extract_projectile()
    extract_minion()
    extract_thrown()
    extract_zone()

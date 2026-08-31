"""장애물 시트에서 아이콘을 추출하는 공용 로직.
행(row) 전체 폭의 연결요소(connected components)를 분석해 각 아이콘의 실제
경계를 찾기 때문에, 균등폭 컬럼으로 단순히 자를 때 생기는 이웃 아이템 침범
(예: 소방차 사다리가 옆 칸까지 뻗은 경우) 문제를 방지한다."""
import numpy as np
from PIL import Image
from scipy import ndimage


def find_row_split(row_img, gap_threshold=6):
    """아이콘 행과 라벨(글자) 행 사이의 y 경계를 찾는다."""
    arr = np.array(row_img.convert("RGB")).astype(int)
    h, w, _ = arr.shape
    diff = np.abs(arr - 255).sum(axis=2)
    nonwhite = diff > 30
    density = nonwhite.sum(axis=1)

    search_start = int(h * 0.45)
    y = search_start
    while y < h:
        if density[y] <= gap_threshold:
            start = y
            while y < h and density[y] <= gap_threshold:
                y += 1
            return start
        y += 1
    return h


def extract_row_icons(sheet_img, x_start, x_end, y0, y1, cols=10, pad=3):
    """행 하나(아이콘 10개)를 연결요소 기반으로 분리해 잘라낸다.
    반환: 길이 cols의 리스트, 각 원소는 RGBA Image 또는 None."""
    split = find_row_split(sheet_img.crop((x_start, y0, x_end, y1)))
    y_icon_end = y0 + split

    region = sheet_img.crop((x_start, y0, x_end, y_icon_end)).convert("RGB")
    arr = np.array(region).astype(int)
    h, w, _ = arr.shape
    diff = np.abs(arr - 255).sum(axis=2)
    mask = diff > 22

    labeled, n = ndimage.label(mask, structure=np.ones((3, 3)))
    if n == 0:
        return [None] * cols

    col_w = (x_end - x_start) / cols
    col_centers = [(c + 0.5) * col_w for c in range(cols)]

    # 각 연결요소를 가장 가까운 컬럼에 배정
    # 노이즈 방지: 아주 작은 조각, 칸 폭을 넘는 가늘고 긴 테두리/그림자선,
    # 그리고 라벨 박스 모서리 등에서 생기는 아주 얇은(세로 10px 미만) 파편은 제외한다.
    slots = [None for _ in range(cols)]  # [x0,y0,x1,y1] per column
    objs = ndimage.find_objects(labeled)
    for i, sl in enumerate(objs):
        if sl is None:
            continue
        ys, xs = sl
        area = (labeled[sl] == (i + 1)).sum()
        if area < 15:
            continue
        comp_w = xs.stop - xs.start
        comp_h = ys.stop - ys.start
        if comp_w > col_w * 1.8:
            continue  # 칸 폭을 훨씬 넘는 가늘고 긴 요소는 테두리/그림자선으로 간주해 제외
        if comp_h < 10:
            continue  # 세로로 아주 얇은 조각은 라벨 박스 테두리/모서리 파편으로 간주해 제외
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

    # 흰 배경 대비 부드러운(soft) 알파를 추정한다. 기존의 이분법(0 또는 255) 알파는
    # 테두리가 계단처럼 거칠어 보이는 원인이었다. 색상 자체는 건드리지 않고(un-blend
    # 시도는 불투명한 내부 픽셀까지 어둡게 왜곡시켜 폐기) 알파만 부드럽게 만들어
    # 진짜 경계(안티에일리어싱) 픽셀만 부분 투명해지도록 한다.
    alpha_f = np.clip((diff - 10) * 4, 0, 255).astype(np.uint8)
    rgba = np.dstack([arr, alpha_f]).astype(np.uint8)
    full_img = Image.fromarray(rgba, "RGBA")

    results = []
    for col in range(cols):
        if slots[col] is None:
            results.append(None)
            continue
        bx0, by0, bx1, by1 = slots[col]
        bx0 = max(0, bx0 - pad)
        by0 = max(0, by0 - pad)
        bx1 = min(w, bx1 + pad)
        by1 = min(h, by1 + pad)
        results.append(full_img.crop((bx0, by0, bx1, by1)))
    return results

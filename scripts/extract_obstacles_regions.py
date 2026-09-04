"""지역(날개)별 장애물 시트(assets/obstacles/obstacle_{wingId}.png, 5열x2행=10종)를
개별 아이콘으로 잘라 assets/obstacles/{wingId}/{0..9}.png로 저장한다.

시트마다 배경 처리 방식이 다르다:
- 이미 알파 채널이 있고 테두리가 충분히 투명한 시트(RGBA, 예: cloud/golden)는 그대로 크롭만 한다.
- 배경이 흰색/체크무늬로 남아있는 시트(RGB 또는 알파가 사실상 불투명한 RGBA, 예: basic/electric/
  flame/rainbow/sky/water)는 extract_obstacles_v3.py와 동일한 "테두리 flood-fill" 방식으로
  배경만 투명화한다(아이콘 내부의 흰 하이라이트는 테두리와 연결되지 않아 보존됨).

각 셀은 격자 크기 그대로 자른 뒤, 알파 바운딩박스로 여백을 다듬어(패딩 유지) 저장한다.
"""
import glob
import os
import numpy as np
from PIL import Image
from scipy import ndimage

COLS, ROWS = 5, 2
SRC_DIR = "assets/obstacles"
PAD = 6

def border_flood_remove(rgb_arr, small_island_max=300):
    """RGB 배열에서 테두리와 연결된 거의-흰 배경 + 테두리에 안 닿은 작은 노이즈 섬까지
    투명화한 RGBA 배열을 반환한다(clean_background_layers.py와 동일한 방식 - 체크무늬 잔여
    노이즈가 flood-fill 도중 끊겨 고립된 불투명 반점으로 남는 문제 방지)."""
    diff = np.abs(rgb_arr.astype(int) - 255).sum(axis=2)
    bgish = diff < 45
    labeled_bg, n = ndimage.label(bgish, structure=np.ones((3, 3)))
    border_labels = (set(labeled_bg[0, :].tolist()) | set(labeled_bg[-1, :].tolist()) |
                      set(labeled_bg[:, 0].tolist()) | set(labeled_bg[:, -1].tolist()))
    border_labels.discard(0)
    if n:
        sizes = ndimage.sum(np.ones_like(bgish), labeled_bg, range(1, n + 1))
        keep_labels = set(border_labels)
        for lbl in range(1, n + 1):
            if lbl not in keep_labels and sizes[lbl - 1] <= small_island_max:
                keep_labels.add(lbl)
    else:
        keep_labels = border_labels
    bg_connected = np.isin(labeled_bg, list(keep_labels)) if keep_labels else np.zeros_like(bgish, dtype=bool)
    # 부드러운(soft) 알파 대신 하드 컷을 쓴다: 이 시트들의 "빈 칸" 배경이 순백이 아니라 두 색이
    # 번갈아 나오는 옅은 체크무늬 프리뷰 아티팩트라, diff 기반 soft 알파를 쓰면 체크무늬의
    # 두 색상이 서로 다른 반투명도로 남아 알파 채널 자체에 체크무늬가 구워지는 문제가 있었다
    # (clean_background_layers.py에서 실측 확인 후 동일하게 수정).
    alpha = np.where(bg_connected, 0, 255).astype(np.uint8)
    return np.dstack([rgb_arr, alpha]).astype(np.uint8)

def has_real_alpha(img):
    """이미 border 쪽이 충분히 투명한 RGBA 이미지인지 확인한다."""
    if img.mode != "RGBA":
        return False
    a = np.array(img.split()[-1])
    border = np.concatenate([a[0, :], a[-1, :], a[:, 0], a[:, -1]])
    return border.mean() < 200  # 테두리 평균 알파가 충분히 낮으면 이미 배경 제거된 것으로 간주

def trim_alpha_bbox(img, pad=PAD):
    a = np.array(img.split()[-1])
    ys, xs = np.where(a > 8)
    if len(ys) == 0:
        return img
    h, w = a.shape
    x0 = max(0, xs.min() - pad); x1 = min(w, xs.max() + 1 + pad)
    y0 = max(0, ys.min() - pad); y1 = min(h, ys.max() + 1 + pad)
    return img.crop((x0, y0, x1, y1))

def process_sheet(path, wing_id):
    img = Image.open(path)
    W, H = img.size
    cw, ch = W / COLS, H / ROWS
    out_dir = f"{SRC_DIR}/{wing_id}"
    os.makedirs(out_dir, exist_ok=True)

    if has_real_alpha(img):
        base_rgba = img.convert("RGBA")
        prebuilt = np.array(base_rgba)
    else:
        rgb = np.array(img.convert("RGB"))
        prebuilt = border_flood_remove(rgb)

    idx = 0
    for row in range(ROWS):
        for col in range(COLS):
            box = (int(col * cw), int(row * ch), int((col + 1) * cw), int((row + 1) * ch))
            cell = Image.fromarray(prebuilt[box[1]:box[3], box[0]:box[2]], "RGBA")
            cell = trim_alpha_bbox(cell)
            cell.save(f"{out_dir}/{idx}.png")
            idx += 1
    print(f"{wing_id}: {idx}장 저장 -> {out_dir}/")

def main():
    sheets = sorted(glob.glob(f"{SRC_DIR}/obstacle_*.png"))
    for path in sheets:
        wing_id = os.path.basename(path)[len("obstacle_"):-len(".png")]
        process_sheet(path, wing_id)

if __name__ == "__main__":
    main()

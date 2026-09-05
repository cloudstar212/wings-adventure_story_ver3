"""design/천사와 요정.png 에서 천사(왼쪽)만 크롭해 assets/elite/boss_angel_full.png로 추출한다.

배경 제거 방식은 clean_background_layers.py의 border_flood_remove(소규모 섬 일괄 제거)가 아니라
extract_new_characters.py/extract_characters_v2.py의 white_bg_alpha를 그대로 재사용한다 - 그
차이가 중요하다: border_flood_remove는 테두리에 안 닿아도 일정 크기(small_island_max) 미만인
흰색 계열 덩어리를 전부 배경으로 간주해 지워버려서, 드레스처럼 화면 전체에 넓게 퍼진 흰색
내부 디테일이 여기저기 뜯겨나갔다(사용자 확정 버그). white_bg_alpha는 그런 크기 기반 예외가
전혀 없이 "이미지 테두리에서 flood-fill로 실제 닿는 흰색"만 지우고, 나머지는 아무리 하얗고
넓어도 무조건 불투명 유지한다 - 그래서 캐릭터 시트 추출 때는 내부 흰색이 멀쩡했던 것.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = "design/천사와 요정.png"
OUT = "assets/elite/boss_angel_full.png"
CROP_BOX = (0, 0, 1015, 1024)  # 요정과의 여백(x=990~1040, 실측)에서 안전하게 자른 경계


def nonwhite_mask(arr, thresh=30):
    diff = np.abs(arr.astype(int) - 255).sum(axis=2)
    return diff > thresh, diff


def white_bg_alpha(region_arr, region_diff):
    """흰 배경 시트용: 테두리 flood-fill로 진짜 배경만 투명 처리(내부 흰색은 무조건 보존)."""
    bgish = region_diff < 45
    labeled_bg, _ = ndimage.label(bgish, structure=np.ones((3, 3)))
    border_labels = (set(labeled_bg[0, :].tolist()) | set(labeled_bg[-1, :].tolist()) |
                      set(labeled_bg[:, 0].tolist()) | set(labeled_bg[:, -1].tolist()))
    border_labels.discard(0)
    bg_connected = np.isin(labeled_bg, list(border_labels)) if border_labels else np.zeros_like(bgish, dtype=bool)
    soft = np.clip((region_diff - 10) * 4, 0, 255)
    return np.where(bg_connected, soft, 255).astype(np.uint8)


def main():
    img = Image.open(SRC).convert("RGB").crop(CROP_BOX)
    arr = np.array(img)
    _, diff = nonwhite_mask(arr)
    alpha = white_bg_alpha(arr, diff)
    out = Image.fromarray(np.dstack([arr, alpha]).astype(np.uint8), "RGBA")

    bbox = out.getbbox()
    pad = 4
    bx0, by0, bx1, by1 = bbox
    bx0, by0 = max(0, bx0 - pad), max(0, by0 - pad)
    bx1, by1 = min(out.width, bx1 + pad), min(out.height, by1 + pad)
    out.crop((bx0, by0, bx1, by1)).save(OUT)
    print("saved", OUT, Image.open(OUT).size)


if __name__ == "__main__":
    main()

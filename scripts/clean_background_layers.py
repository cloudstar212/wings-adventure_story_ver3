"""assets/background/ 의 mid/near/effect 레이어 중 배경이 제대로 투명화되지 않은
파일들을 정리한다 (far 레이어는 원래부터 불투명 배경 그림이라 대상에서 제외).

증상 두 가지:
1) RGB 모드(알파 채널 자체가 없음) - 실제로는 흰색/체크무늬 배경이 그대로 박혀있음.
2) RGBA인데 테두리 알파가 어중간하게 남아있음(완전 투명도 완전 불투명도 아님) - 흐릿한
   반투명 안개처럼 배경이 남아 캔버스에 겹쳐 그리면 뿌옇게 보임.

두 경우 모두 흰 배경 위에 합성해 RGB로 평탄화한 뒤, extract_obstacles_v3.py와 동일한
"테두리 flood-fill" 방식으로 배경만 다시 투명화한다(아이콘/그림 내부의 흰 하이라이트는
테두리와 연결되지 않아 보존됨).
"""
import glob
import os
import numpy as np
from PIL import Image
from scipy import ndimage

BG_DIR = "assets/background"
TARGET_SUFFIXES = ("_mid.png", "_near.png", "_effect.png")
SKIP_FILES = {"room.png", "shop.png"}

def flatten_to_rgb(img):
    if img.mode == "RGBA":
        base = Image.new("RGB", img.size, (255, 255, 255))
        base.paste(img, mask=img.split()[-1])
        return np.array(base)
    return np.array(img.convert("RGB"))

def border_flood_remove(rgb_arr, small_island_max=300):
    diff = np.abs(rgb_arr.astype(int) - 255).sum(axis=2)
    # 임계값 100: 체크무늬 배경엔 diff 0~97 범위에 걸친 미세한 노이즈가 섞여 있어(실측:
    # basic_near.png 하늘 영역 diff 최대 97), extract_obstacles_v3.py의 45나 1차 시도한
    # 65로는 하늘 곳곳에 작은 불투명 반점이 남았다. 100까지 올리면 하늘 노이즈는 전부
    # 잡히고, 실제 전경(잔디/바위) 안쪽은 diff가 훨씬 커서(150 이상 다수) 영향이 적다 -
    # 다만 전경 가장자리의 미세한 안티에일리어싱 일부가 함께 잘려나갈 수 있다(허용 가능한
    # 트레이드오프로 판단, 아래 small_island_max와 함께 이중 안전장치).
    bgish = diff < 100
    labeled_bg, n = ndimage.label(bgish, structure=np.ones((3, 3)))
    border_labels = (set(labeled_bg[0, :].tolist()) | set(labeled_bg[-1, :].tolist()) |
                      set(labeled_bg[:, 0].tolist()) | set(labeled_bg[:, -1].tolist()))
    border_labels.discard(0)
    # 체크무늬 잔여 노이즈가 완벽히 균일하지 않아, 테두리 flood-fill이 중간에 끊겨 고립된
    # "섬"으로 남는 작은 배경 조각들이 있었다(실측: 하늘 한복판에 불투명한 흰 점들이 남음 -
    # basic_near.png 기준 노이즈 섬 최대 121px, 실제 그림 내용은 25만px대 - 격차가 커서
    # 300px 컷오프로도 실제 그림 요소를 잘라낼 위험은 낮다). 테두리에 안 닿아도 면적이
    # 작으면 배경으로 간주해 함께 투명화한다.
    if n:
        sizes = ndimage.sum(np.ones_like(bgish), labeled_bg, range(1, n + 1))
        keep_labels = set(border_labels)
        for lbl in range(1, n + 1):
            if lbl not in keep_labels and sizes[lbl - 1] <= small_island_max:
                keep_labels.add(lbl)
    else:
        keep_labels = border_labels
    bg_connected = np.isin(labeled_bg, list(keep_labels)) if keep_labels else np.zeros_like(bgish, dtype=bool)
    # extract_obstacles_v3.py처럼 diff 기반 "부드러운" 알파를 쓰면, 이 체크무늬 배경의 두 색상
    # (연한 회색 vs 거의 흰색)이 diff 값 자체가 서로 달라 반투명도가 다르게 남는다 - 그 결과
    # 알파 채널 자체에 체크무늬가 그대로 구워지는 문제가 있었다(실측 확인). 여기서는 배경으로
    # 판정된 영역은 예외 없이 완전 투명(0)으로 하드 컷한다 - 실제 그림 경계의 미세한 안티에일리어싱
    # 보존보다 체크무늬 잔상 제거가 우선.
    alpha = np.where(bg_connected, 0, 255).astype(np.uint8)
    return np.dstack([rgb_arr, alpha]).astype(np.uint8)

def needs_cleanup(img):
    if img.mode != "RGBA":
        return True
    a = np.array(img.split()[-1])
    border = np.concatenate([a[0, :], a[-1, :], a[:, 0], a[:, -1]])
    return border.mean() >= 50  # 이미 충분히 투명하면 건드리지 않는다

def main():
    files = sorted(glob.glob(f"{BG_DIR}/*.png"))
    for path in files:
        name = os.path.basename(path)
        if name in SKIP_FILES or not name.endswith(TARGET_SUFFIXES):
            continue
        img = Image.open(path)
        if not needs_cleanup(img):
            print(f"skip (already clean): {name}")
            continue
        rgb = flatten_to_rgb(img)
        rgba = border_flood_remove(rgb)
        Image.fromarray(rgba, "RGBA").save(path)
        print(f"cleaned: {name}")

if __name__ == "__main__":
    main()

"""hero2/hero3 무지개 날개 스프라이트(assets/sprites/{char2,char3}/rainbow.png)에서
배경에 섞여 있는 무지개 아치를 제거한다.

배경: design/ 원본 시트의 "무지개 날개" 칸 그림 자체에 캐릭터와 별개로 하늘색 무지개 아치가
함께 그려져 있다(hero1의 원본은 이 아치가 없음). extract_new_characters.py의 흰배경
제거(white_bg_alpha)는 "흰 배경과 연결된 영역"만 투명화하므로, 흰색이 아닌 이 아치는 원본부터
불투명 전경으로 추출되어 제거되지 않는다. 즉 흰배경 제거 로직의 버그가 아니라 원본 소스 아트에
포함된 내용이라, extract_new_characters.py를 아무리 다시 돌려도 이 스크립트로 재보정하기 전까지는
계속 재현된다(원본 시트를 직접 다시 그리지 않는 한).

이 스크립트는 원본 시트를 고치는 대신, 이미 추출된 rainbow.png 2장을 캐릭터 실루엣 기준으로
행(row) 단위로 스캔해 "머리카락/피부(보호 대상)로 인식되는 마지막 x 지점" 바깥쪽을 투명 처리하는
방식으로 아치만 제거한다. 캐릭터마다 머리색이 달라(hero2=흑발→명도 기준, hero3=은발→채도 기준)
보호 판정 함수가 다르고, 눈·입이 있는 얼굴 영역은 색 기준으로 아치와 구분이 안 되므로 좌표 박스로
별도 보호한다. 캐릭터 디자인이 바뀌면 아래 CHAR_PARAMS의 좌표를 다시 잡아야 한다.

사용법: python scripts/clean_rainbow_bg.py
(원본을 덮어쓰기 전에 assets/sprites/{char2,char3}/rainbow.png를 백업해두는 것을 권장)
"""
import numpy as np
from PIL import Image


def sat(r, g, b):
    return max(r, g, b) - min(r, g, b)


def make_is_protected(kind):
    """kind='dark': hero2(흑발) 기준 어두운 픽셀=머리카락. kind='lowsat': hero3(은발) 기준
    채도 낮은 픽셀=머리카락(흰/은발은 밝기로 구분 불가하므로 채도로 판정)."""
    if kind == "dark":
        def f(px):
            r, g, b, al = int(px[0]), int(px[1]), int(px[2]), int(px[3])
            return al > 100 and (r + g + b) < 280
        return f
    else:
        def f(px):
            r, g, b, al = int(px[0]), int(px[1]), int(px[2]), int(px[3])
            return al > 100 and sat(r, g, b) < 34
        return f


def clean_arc(path, out_path, protect_kind, ybounds, xsearch, xerase_max,
              face_box, sliver_xrange, margin=8, run_thresh=20):
    is_protected = make_is_protected(protect_kind)
    im = Image.open(path).convert("RGBA")
    a = np.array(im)
    h, w = a.shape[:2]
    y0, y1 = ybounds
    xs0, xs1 = xsearch
    fx0, fx1, fy0, fy1 = face_box
    sx0, sx1 = sliver_xrange

    for y in range(y0, min(y1, h)):
        row = a[y]
        protected_xs = [x for x in range(xs0, min(xs1, w)) if is_protected(row[x])]
        right_edge = max(protected_xs) if protected_xs else xs0 - 1
        erase_from = max(right_edge + margin, xs0)
        # pass1: 캐릭터 실루엣(그 행에서 보호 판정된 마지막 x) 바깥쪽은 무조건 지운다
        # (얼굴 박스 안이면 보호 색 판정과 무관하게 항상 보존)
        for x in range(erase_from, min(xerase_max, w)):
            if fx0 <= x <= fx1 and fy0 <= y <= fy1:
                continue
            if row[x][3] > 0:
                a[y, x] = [255, 255, 255, 0]
        # pass2: 머리카락 갈래 사이로 아치가 얇게 비치는 경우, 보호 판정 없이 길게(run_thresh
        # 이상) 이어지는 구간은 머리카락일 가능성이 낮으므로 지운다(날개/트레일 쪽은 sliver_xrange
        # 밖이라 영향 없음)
        x = sx0
        while x < min(sx1, w):
            if is_protected(row[x]) or row[x][3] == 0:
                x += 1
                continue
            run_start = x
            while x < min(sx1, w) and not is_protected(row[x]) and row[x][3] > 0:
                x += 1
            if x - run_start > run_thresh:
                for xx in range(run_start, x):
                    if fx0 <= xx <= fx1 and fy0 <= y <= fy1:
                        continue
                    a[y, xx] = [255, 255, 255, 0]
    Image.fromarray(a, "RGBA").save(out_path)


CHAR_PARAMS = {
    "assets/sprites/char2/rainbow.png": dict(
        protect_kind="dark",  # hero2 = 흑발
        ybounds=(0, 200), xsearch=(150, 345), xerase_max=395,
        face_box=(190, 305, 80, 205), sliver_xrange=(230, 345),
        margin=10, run_thresh=22,
    ),
    "assets/sprites/char3/rainbow.png": dict(
        protect_kind="lowsat",  # hero3 = 은발(밝기로 구분 불가, 채도로 판정)
        ybounds=(0, 130), xsearch=(150, 330), xerase_max=395,
        face_box=(195, 315, 85, 205), sliver_xrange=(230, 330),
        margin=8, run_thresh=20,
    ),
}

if __name__ == "__main__":
    for path, params in CHAR_PARAMS.items():
        clean_arc(path, path, **params)
        print("cleaned", path)

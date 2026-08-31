"""hero2/hero3 날개 선택 카드 일러스트를 design/ 원본 시트에서 추출한다.

hero1의 assets/cards/*.png(scripts/crop_cells.py)와 동일하게, 배경이 그대로 살아있는 원본 시트
("캐릭터 및 날개 디자인_주인공{2,3}.png" - 흰배경 아닌 버전)를 2행x4열로 등분해서 그대로
assets/cards/{char2,char3}/{wingId}.png로 저장한다. 흰배경 버전(_흰배경.png, 캐릭터 스프라이트
추출용)과 헷갈리지 않도록 주의.

이 카드는 날개 선택 UI 썸네일 전용이다(wingThumbSrc(), game.js). 비행 중 실제 캐릭터 렌더링에는
여전히 assets/sprites/{char2,char3}/*.png(배경 제거된 투명 스프라이트)를 쓴다 - 원본 시트에
포함된 배경 장식(예: 무지개 날개 칸의 무지개 아치)이 실제 캐릭터 렌더링에 섞여 들어가면 안 되므로
두 용도의 이미지를 분리해서 관리한다(무지개 아치 제거는 scripts/clean_rainbow_bg.py 참고).

사용법: python scripts/crop_hero_cards.py
"""
import os
from PIL import Image

WING_ORDER = ["basic", "golden", "cloud", "rainbow", "sky", "flame", "water", "electric"]

SHEETS = {
    "char2": "design/캐릭터 및 날개 디자인_주인공2.png",
    "char3": "design/캐릭터 및 날개 디자인_주인공3.png",
}


def crop_cards(hero, sheet_path):
    img = Image.open(sheet_path).convert("RGB")
    w, h = img.size
    cols, rows = 4, 2
    cw, ch = w // cols, h // rows
    out_dir = f"assets/cards/{hero}"
    os.makedirs(out_dir, exist_ok=True)
    for i, name in enumerate(WING_ORDER):
        col, row = i % cols, i // cols
        box = (col * cw, row * ch, (col + 1) * cw, (row + 1) * ch)
        img.crop(box).save(f"{out_dir}/{name}.png")
    print(hero, "cards extracted:", len(WING_ORDER))


if __name__ == "__main__":
    for hero, sheet in SHEETS.items():
        crop_cards(hero, sheet)

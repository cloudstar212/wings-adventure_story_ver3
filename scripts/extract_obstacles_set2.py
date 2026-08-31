import os
from PIL import Image
from obstacle_lib import extract_row_icons

SRC = "장애물 set 2.png"
OUT = "assets/obstacles"

im = Image.open(SRC).convert("RGB")

THEMES = [
    ("household", [(55, 170), (190, 290), (310, 430)]),
    ("fruit",     [(515, 615), (635, 735), (755, 863)]),
    ("transport", [(970, 1055), (1070, 1175), (1190, 1305)]),
]
X_START, X_END = 168, 1178
TIER_NAMES = ["small", "medium", "large"]

count = 0
for theme_id, rows in THEMES:
    for tier_idx, (y0, y1) in enumerate(rows):
        tier = TIER_NAMES[tier_idx]
        icons = extract_row_icons(im, X_START, X_END, y0, y1)
        dirpath = f"{OUT}/{theme_id}/{tier}"
        os.makedirs(dirpath, exist_ok=True)
        for c, icon in enumerate(icons):
            if icon is None:
                print("EMPTY", theme_id, tier, c)
                continue
            icon.save(f"{dirpath}/{c}.png")
            count += 1

print(f"extracted {count} icons")

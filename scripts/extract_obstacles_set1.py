import os
from PIL import Image
from obstacle_lib import extract_row_icons

SRC = "장애물 set 1.png"
OUT = "assets/obstacles"

im = Image.open(SRC).convert("RGB")

THEMES = [
    ("space", [(42, 135), (140, 220), (240, 348)]),
    ("ocean", [(404, 490), (496, 572), (595, 700)]),
    ("dessert", [(738, 815), (821, 897), (915, 1012)]),
]
X_START, X_END = 225, 1536
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

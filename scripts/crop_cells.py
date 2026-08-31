import glob
import os
from PIL import Image

src_path = glob.glob("*.png")[0]
img = Image.open(src_path).convert("RGB")
W, H = img.size
cols, rows = 4, 2
cw, ch = W // cols, H // rows

names = [
    "basic", "golden", "cloud", "rainbow",
    "sky", "flame", "water", "electric",
]

os.makedirs("assets/cards", exist_ok=True)

for i, name in enumerate(names):
    col = i % cols
    row = i // cols
    box = (col * cw, row * ch, (col + 1) * cw, (row + 1) * ch)
    cell = img.crop(box)
    cell.save(f"assets/cards/{name}_raw.png")
    print(name, box)

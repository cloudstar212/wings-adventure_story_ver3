import os
from rembg import remove, new_session
from PIL import Image

os.makedirs("assets/icons", exist_ok=True)
session = new_session("isnet-general-use")

jobs = [
    ("money", "assets/backgrounds/shop.png", (378, 635, 512, 725)),
    ("gem",   "assets/backgrounds/shop.png", (645, 630, 755, 730)),
    ("coin",  "assets/backgrounds/room.png", (518, 836, 597, 895)),
]

for name, src, box in jobs:
    crop = Image.open(src).convert("RGB").crop(box)
    out = remove(crop, session=session)
    bbox = out.getbbox()
    if bbox:
        pad = 3
        b = (max(0, bbox[0]-pad), max(0, bbox[1]-pad), min(out.width, bbox[2]+pad), min(out.height, bbox[3]+pad))
        out = out.crop(b)
    out.save(f"assets/icons/{name}.png")
    print(name, out.size)

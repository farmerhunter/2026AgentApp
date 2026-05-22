#!/usr/bin/env python3
"""Generate Chinese demo session images for upload_20260518_002.

Usage:
    python3 scripts/generate_chinese_demo_images.py

Requires: Pillow
    pip install Pillow

Fonts used (macOS system fonts):
    - PingFang SC (苹方) for UI/sans-serif text
    - STKaiti (华文楷体) for serif/article text
"""

import os
import random
from PIL import Image, ImageDraw, ImageFont

random.seed(42)

OUT_DIR = os.path.join(
    os.path.dirname(__file__), "..", "src", "web_ui", "public", "data",
    "question_sessions", "upload_20260518_002"
)
ORIGINAL_DIR = os.path.join(OUT_DIR, "original")
CROPS_DIR = os.path.join(OUT_DIR, "crops")

# macOS system font paths
PINGFANG = "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc"
KAITI = "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/88d6cc32a907955efa1d014207889413890573be.asset/AssetData/Kaiti.ttc"

W, H = 1200, 1600
MARGIN_LEFT = 100
MARGIN_RIGHT = 100
CONTENT_W = W - MARGIN_LEFT - MARGIN_RIGHT

BBOX1 = {"x": 100, "y": 260, "width": 900, "height": 360}
BBOX2 = {"x": 100, "y": 680, "width": 900, "height": 420}


def load_fonts():
    return {
        "title": ImageFont.truetype(PINGFANG, 26, index=0),
        "subtitle": ImageFont.truetype(PINGFANG, 20, index=0),
        "body": ImageFont.truetype(PINGFANG, 18, index=0),
        "body_bold": ImageFont.truetype(PINGFANG, 18, index=1),
        "small": ImageFont.truetype(PINGFANG, 16, index=0),
        "kaiti": ImageFont.truetype(KAITI, 18, index=0),
    }


def add_paper_texture(img):
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            noise = random.randint(-5, 5)
            dx = abs(x - w / 2) / (w / 2)
            dy = abs(y - h / 2) / (h / 2)
            vignette = int(18 * max(dx, dy) ** 2)
            nr = max(0, min(255, r + noise - vignette))
            ng = max(0, min(255, g + noise - vignette))
            nb = max(0, min(255, b + noise - vignette))
            pixels[x, y] = (nr, ng, nb)
    return img


def wrap_text(draw, text, font, max_width):
    lines = []
    current_line = ""
    for ch in text:
        test = current_line + ch
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] > max_width and current_line:
            lines.append(current_line)
            current_line = ch
        else:
            current_line = test
    if current_line:
        lines.append(current_line)
    return lines


def draw_paragraph(draw, x, y, text, font, max_width, line_height, color=(40, 40, 40)):
    lines = wrap_text(draw, text, font, max_width)
    for line in lines:
        draw.text((x, y), line, fill=color, font=font)
        y += line_height
    return y


def generate_page():
    fonts = load_fonts()
    img = Image.new("RGB", (W, H), (252, 251, 248))
    draw = ImageDraw.Draw(img)
    add_paper_texture(img)
    draw = ImageDraw.Draw(img)

    # Header
    header_y = 60
    draw.text((W // 2 - 70, header_y), "语文练习", fill=(30, 30, 30), font=fonts["title"])
    draw.line([(MARGIN_LEFT, header_y + 40), (W - MARGIN_RIGHT, header_y + 40)], fill=(180, 180, 180), width=1)
    draw.text((MARGIN_LEFT, header_y + 50), "姓名：__________    班级：__________    日期：__________", fill=(80, 80, 80), font=fonts["small"])

    # --- Question 1: Reading comprehension (y: 260~620) ---
    q1_y = 265
    draw.text((MARGIN_LEFT, q1_y), "一、阅读理解（20分）", fill=(30, 30, 30), font=fonts["subtitle"])
    q1_y += 32

    draw.text((MARGIN_LEFT + 16, q1_y), "阅读短文《把时间用在重要的事上》，完成下列题目。", fill=(50, 50, 50), font=fonts["body_bold"])
    q1_y += 30

    article_texts = [
        "　　人生如白驹过隙，时间是我们最宝贵的资源。然而，很多人却把大量时间花在了无关紧要的事情上。刷短视频、浏览无关信息，这些行为看似放松，实则在不知不觉中吞噬了我们本可以用来学习和成长的时光。",
        "　　那么，什么才是重要的事？重要的事是那些能够帮助我们实现长远目标的事情。以阅读为例，每天抽出半小时阅读经典书籍，一年下来就是一百八十多个小时。正如古人所说：\"不积跬步，无以至千里。\"这些积累会在潜移默化中提升我们的理解力与思辨力。",
    ]

    for para in article_texts:
        q1_y = draw_paragraph(draw, MARGIN_LEFT + 16, q1_y, para, fonts["body"], CONTENT_W - 32, 26)
        q1_y += 4

    q1_y += 8

    draw.text((MARGIN_LEFT, q1_y), "1. 概括本文的中心论点。（4分）", fill=(40, 40, 40), font=fonts["body_bold"])
    q1_y += 26
    draw.text((MARGIN_LEFT, q1_y), "答：_____________________________________________________", fill=(80, 80, 80), font=fonts["body"])
    q1_y += 24

    draw.text((MARGIN_LEFT, q1_y), "2. 结合第2段，说明作者举\"每天阅读半小时\"这个例子的作用。（6分）", fill=(40, 40, 40), font=fonts["body_bold"])
    q1_y += 26
    draw.text((MARGIN_LEFT, q1_y), "答：_____________________________________________________", fill=(80, 80, 80), font=fonts["body"])

    # --- Separator ---
    draw.line([(MARGIN_LEFT, 645), (W - MARGIN_RIGHT, 645)], fill=(200, 200, 200), width=1)

    # --- Question 2: Writing revision (y: 680~1100) ---
    q2_y = 685
    draw.text((MARGIN_LEFT, q2_y), "二、写作修改（10分）", fill=(30, 30, 30), font=fonts["subtitle"])
    q2_y += 32

    draw.text((MARGIN_LEFT, q2_y), "请修改下面的片段作文，使段落观点更加明确，并补充一个能支撑", fill=(50, 50, 50), font=fonts["body_bold"])
    q2_y += 26
    draw.text((MARGIN_LEFT, q2_y), "观点的具体细节。", fill=(50, 50, 50), font=fonts["body_bold"])
    q2_y += 30

    # Box for original passage
    box_x = MARGIN_LEFT + 16
    box_w = CONTENT_W - 32
    box_y = q2_y
    box_h = 140
    draw.rectangle([box_x, box_y, box_x + box_w, box_y + box_h], outline=(160, 160, 160), width=1)
    for y in range(box_y + 1, box_y + box_h):
        for x in range(box_x + 1, box_x + box_w):
            r, g, b = img.getpixel((x, y))
            img.putpixel((x, y), (r - 3, g - 3, b - 2))
    draw = ImageDraw.Draw(img)

    passage_text = "　　我觉得读书很重要。读书可以让人学到很多东西，也可以让人变得更加聪明。所以我们都应该多读书，这样才能让自己变得更好。读书是一件非常好的事情，我喜欢读书。"
    passage_y = box_y + 12
    passage_y = draw_paragraph(draw, box_x + 12, passage_y, passage_text, fonts["body"], box_w - 24, 24, color=(60, 60, 60))

    q2_y = box_y + box_h + 18

    draw.text((MARGIN_LEFT, q2_y), "要求：", fill=(40, 40, 40), font=fonts["body_bold"])
    q2_y += 24
    draw.text((MARGIN_LEFT + 16, q2_y), "（1）使段落观点更加明确；", fill=(50, 50, 50), font=fonts["body"])
    q2_y += 22
    draw.text((MARGIN_LEFT + 16, q2_y), "（2）补充一个能支撑观点的具体细节。", fill=(50, 50, 50), font=fonts["body"])
    q2_y += 28

    draw.text((MARGIN_LEFT, q2_y), "修改后的作文：", fill=(40, 40, 40), font=fonts["body_bold"])
    q2_y += 24
    draw.text((MARGIN_LEFT, q2_y), "_________________________________________________________", fill=(80, 80, 80), font=fonts["body"])
    q2_y += 22
    draw.text((MARGIN_LEFT, q2_y), "_________________________________________________________", fill=(80, 80, 80), font=fonts["body"])
    q2_y += 22
    draw.text((MARGIN_LEFT, q2_y), "_________________________________________________________", fill=(80, 80, 80), font=fonts["body"])

    # Footer
    draw.line([(MARGIN_LEFT, H - 80), (W - MARGIN_RIGHT, H - 80)], fill=(200, 200, 200), width=1)
    draw.text((W // 2 - 60, H - 55), "第 1 页 共 1 页", fill=(150, 150, 150), font=fonts["small"])

    return img


def generate_crops(img):
    crops = {}
    for qid, bbox in [("q_chinese_001", BBOX1), ("q_chinese_002", BBOX2)]:
        left = bbox["x"]
        top = bbox["y"]
        right = left + bbox["width"]
        bottom = top + bbox["height"]
        crop = img.crop((left, top, right, bottom))
        crops[qid] = crop
    return crops


def main():
    os.makedirs(ORIGINAL_DIR, exist_ok=True)
    os.makedirs(CROPS_DIR, exist_ok=True)

    print("Generating Chinese demo images for upload_20260518_002...")
    img = generate_page()
    original_path = os.path.join(ORIGINAL_DIR, "page_1.jpg")
    img.save(original_path, "JPEG", quality=92)
    print(f"  Saved original: {original_path} ({img.size})")

    crops = generate_crops(img)
    for qid, crop_img in crops.items():
        path = os.path.join(CROPS_DIR, f"{qid}.jpg")
        crop_img.save(path, "JPEG", quality=92)
        print(f"  Saved crop: {path} ({crop_img.size})")

    print("Done.")


if __name__ == "__main__":
    main()

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


REPO_ROOT = Path(__file__).resolve().parents[3]
POSTER_DIR = REPO_ROOT / "deliverables" / "poster"
SVG_PATH = POSTER_DIR / "poster-v02.svg"
RUNTIME_DIR = POSTER_DIR / "capture" / "runtime"
RAW_PATH = RUNTIME_DIR / "poster-v02-sips-raw.png"
PREVIEW_PATH = POSTER_DIR / "previews" / "poster-v02-preview.png"
A4_PATH = POSTER_DIR / "previews" / "poster-v02-a4-check.png"

RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)

subprocess.run(
    ["sips", "-s", "format", "png", str(SVG_PATH), "--out", str(RAW_PATH)],
    check=True,
    stdout=subprocess.DEVNULL,
)

canvas = Image.open(RAW_PATH).convert("RGB")
scale_x = canvas.width / 900
scale_y = canvas.height / 1200


def pixel_box(x, y, width, height):
    return (
        round(x * scale_x),
        round(y * scale_y),
        round((x + width) * scale_x),
        round((y + height) * scale_y),
    )


def paste_fitted(path, box, visible_height=None):
    left, top, right, bottom = box
    size = (right - left, bottom - top)
    image = Image.open(path).convert("RGB")
    fitted = ImageOps.fit(image, size, method=Image.Resampling.LANCZOS)
    if visible_height is None:
        canvas.paste(fitted, (left, top))
        return
    visible_pixels = round(visible_height * scale_y)
    canvas.paste(fitted.crop((0, 0, size[0], visible_pixels)), (left, top))


paste_fitted(
    POSTER_DIR / "assets" / "worksheet-a-v1.png",
    pixel_box(62, 675, 126, 190),
)
paste_fitted(
    POSTER_DIR / "assets" / "worksheet-b-v1.png",
    pixel_box(205, 675, 126, 190),
)

screen_panels = [
    (66, "01-import-confirmation-poster.png", "练习导入与错题确认"),
    (329, "02-analysis-memory-poster.png", "AI 分析与学习记忆"),
    (592, "03-weekly-report-poster.png", "学习周报与打印"),
]
for x, filename, _ in screen_panels:
    paste_fitted(
        POSTER_DIR / "assets" / "screenshots" / filename,
        pixel_box(x, 970, 242, 90),
    )

draw = ImageDraw.Draw(canvas)
caption_font = ImageFont.truetype(
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    round(10.5 * scale_y),
)
for x, _, label in screen_panels:
    left, top, right, bottom = pixel_box(x, 1034, 242, 26)
    draw.rectangle((left, top, right, bottom), fill="#102A43")
    draw.text(
        ((left + right) / 2, (top + bottom) / 2),
        label,
        fill="white",
        font=caption_font,
        anchor="mm",
    )
    panel_left, panel_top, panel_right, panel_bottom = pixel_box(x, 970, 242, 90)
    draw.rounded_rectangle(
        (panel_left, panel_top, panel_right, panel_bottom),
        radius=round(11 * scale_x),
        outline="#9BBAB6",
        width=max(2, round(2 * scale_x)),
    )

canvas.save(PREVIEW_PATH, quality=95)
ImageOps.fit(canvas, (900, 1200), method=Image.Resampling.LANCZOS).save(A4_PATH, quality=95)

RAW_PATH.unlink(missing_ok=True)

print(PREVIEW_PATH)
print(A4_PATH)

import json
from pathlib import Path

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[3]
SCREENSHOT_DIR = REPO_ROOT / "deliverables" / "poster" / "assets" / "screenshots"
TARGET_SIZE = (1600, 900)


def fit_crop(image, box, size=TARGET_SIZE):
    cropped = image.crop(box)
    source_ratio = cropped.width / cropped.height
    target_ratio = size[0] / size[1]
    if source_ratio > target_ratio:
        new_width = round(cropped.height * target_ratio)
        left = (cropped.width - new_width) // 2
        cropped = cropped.crop((left, 0, left + new_width, cropped.height))
    else:
        new_height = round(cropped.width / target_ratio)
        top = (cropped.height - new_height) // 2
        cropped = cropped.crop((0, top, cropped.width, top + new_height))
    return cropped.resize(size, Image.Resampling.LANCZOS)


import_image = Image.open(SCREENSHOT_DIR / "01-import-confirmation-full.png").convert("RGB")
analysis_image = Image.open(SCREENSHOT_DIR / "02-analysis-memory-full.png").convert("RGB")
report_image = Image.open(SCREENSHOT_DIR / "03-weekly-report-full.png").convert("RGB")

import_poster = fit_crop(import_image, (0, 0, 1920, 1280))
import_poster.save(SCREENSHOT_DIR / "01-import-confirmation-poster.png", quality=95)

analysis_top = fit_crop(analysis_image, (340, 150, 1920, 1170), (1600, 650))
analysis_memory = fit_crop(analysis_image, (340, 1430, 1920, 1800), (1600, 242))
analysis_poster = Image.new("RGB", TARGET_SIZE, "white")
analysis_poster.paste(analysis_top, (0, 0))
analysis_poster.paste(analysis_memory, (0, 658))
analysis_poster.save(SCREENSHOT_DIR / "02-analysis-memory-poster.png", quality=95)

report_poster = fit_crop(report_image, (340, 80, 1920, 1280))
report_poster.save(SCREENSHOT_DIR / "03-weekly-report-poster.png", quality=95)

manifest = {
    "operation": "poster crops from unaltered browser captures",
    "target_size": {"width": 1600, "height": 900},
    "files": [
        {
            "output": "01-import-confirmation-poster.png",
            "source": "01-import-confirmation-full.png",
            "note": "top portion of the import and confirmation page",
        },
        {
            "output": "02-analysis-memory-poster.png",
            "source": "02-analysis-memory-full.png",
            "note": "two unaltered crops from the same page, joined with an 8 px divider to show findings and memory decision",
        },
        {
            "output": "03-weekly-report-poster.png",
            "source": "03-weekly-report-full.png",
            "note": "report title and evidence-based summary area",
        },
    ],
}
(SCREENSHOT_DIR / "crop-manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(json.dumps(manifest, ensure_ascii=False, indent=2))

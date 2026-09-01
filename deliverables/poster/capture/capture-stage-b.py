import json
from pathlib import Path

from playwright.sync_api import sync_playwright


REPO_ROOT = Path(__file__).resolve().parents[3]
OUTPUT_DIR = REPO_ROOT / "deliverables" / "poster" / "assets" / "screenshots"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE_URL = "http://127.0.0.1:5173"


def wait_ready(page, heading):
    page.wait_for_load_state("networkidle")
    page.get_by_role("heading", name=heading).wait_for(state="visible")


def capture_main(page, filename):
    page.locator("main").screenshot(path=str(OUTPUT_DIR / filename))


OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

console_errors = []
request_failures = []
page_checks = []

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path=CHROME,
        args=["--force-color-profile=srgb"],
    )
    context = browser.new_context(
        viewport={"width": 1800, "height": 1200},
        device_scale_factor=1.5,
        locale="zh-CN",
        color_scheme="light",
    )
    page = context.new_page()
    page.route("**/favicon.ico", lambda route: route.fulfill(status=204, body=""))
    page.on(
        "console",
        lambda message: console_errors.append(message.text)
        if message.type == "error"
        else None,
    )
    page.on(
        "requestfailed",
        lambda request: request_failures.append(
            {"url": request.url, "failure": request.failure}
        ),
    )

    page.goto(f"{BASE_URL}/app/import", wait_until="networkidle")
    wait_ready(page, "练习导入与确认")
    page.get_by_role("button", name="数学 原创模拟练习 A · 首次练习").click()
    page.get_by_text("已选 3/10").wait_for(state="visible")
    page.locator('img[alt="练习原图"]').wait_for(state="visible")
    capture_main(page, "01-import-confirmation-full.png")
    page_checks.append(
        {
            "route": "/app/import",
            "heading": "练习导入与确认",
            "assertions": ["原创模拟练习 A", "已选 3/10", "练习原图可见"],
        }
    )

    page.goto(f"{BASE_URL}/app/analysis", wait_until="networkidle")
    wait_ready(page, "分析与记忆")
    page.get_by_role("button", name="数学 findings_stage_b_b").click()
    page.get_by_text("证据不足", exact=True).first.wait_for(state="visible")
    page.get_by_text("二次根式分母有理化时", exact=False).wait_for(state="visible")
    capture_main(page, "02-analysis-memory-full.png")
    page_checks.append(
        {
            "route": "/app/analysis",
            "heading": "分析与记忆",
            "assertions": ["B 批发现可见", "证据不足可见", "A09 待确认记忆可见"],
        }
    )

    page.goto(f"{BASE_URL}/app/report", wait_until="networkidle")
    wait_ready(page, "周报与打印")
    page.get_by_text("A/B 学习周报：重复、变化与下一步", exact=True).first.wait_for(state="visible")
    page.get_by_text("原因未知", exact=False).wait_for(state="visible")
    page.get_by_role("button", name="打印周报").wait_for(state="visible")
    capture_main(page, "03-weekly-report-full.png")
    page_checks.append(
        {
            "route": "/app/report",
            "heading": "周报与打印",
            "assertions": ["重复问题", "局部变化", "原因未知", "打印周报按钮"],
        }
    )

    context.close()
    browser.close()

manifest = {
    "capture_type": "accepted-result replay",
    "base_url": BASE_URL,
    "viewport": {"width": 1800, "height": 1200, "device_scale_factor": 1.5},
    "source_commit": "3ccefce4971dbb5798c2ea2578a0c5174147785a",
    "source_material": "committed synthetic A/B worksheets and accepted Hermes outputs",
    "new_external_calls": {"ocr": 0, "hermes": 0},
    "files": [
        "01-import-confirmation-full.png",
        "02-analysis-memory-full.png",
        "03-weekly-report-full.png",
    ],
    "checks": page_checks,
    "console_errors": console_errors,
    "request_failures": request_failures,
}
(OUTPUT_DIR / "capture-manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

if console_errors or request_failures:
    raise SystemExit(
        f"capture completed with browser errors: console={len(console_errors)}, requests={len(request_failures)}"
    )

print(json.dumps(manifest, ensure_ascii=False, indent=2))

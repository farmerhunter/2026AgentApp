# 第19章旧样张：原始生成提示词

仅归档公开合成内容，不重新执行调用、不上传聊天记录或私有参考照片。v1 使用当时已展示的真实练习页作物理风格参考（非公开）；v2 的编辑目标为本目录 `worksheet-v1.png`。

## v1（请求时间 2026-08-30T07:35:19.234Z）

```text
Use case: scientific-educational
Asset type: private OCR validation sample, portrait PNG photograph
Input image: use the recent worksheet photo only as a broad reference for physical realism, grayscale workbook hierarchy, camera perspective, and natural handwriting; create a completely new original page and do not copy exact text, illustration, branding, layout details, or identifiers.
Primary request: Generate a photorealistic smartphone photograph of one original Chinese Grade 8 math worksheet page, titled exactly “第十九章 一次函数 单元练习”.
Content: exactly six clearly numbered exercises, 1–6, about linear functions: evaluating y=2x-3, slope/intercept, deciding whether a point lies on y=-x+4, reading a small coordinate graph, and a short real-life linear-function word problem. Include a few simple correct expressions such as y=2x-3, y=-x+4, y=3x+2.
Layout: A4 portrait, two clean vertical columns, exactly three question blocks per column. Each question is a distinct visual region with generous white space, aligned left edge, a large clean center gutter, and no content crossing blocks. Section labels “一、选择题” and “二、解答题”. This must be easy for QuestionSplitOCR to segment into six boxes.
Printed style: legible Chinese educational workbook typography, dark gray/black ink, restrained light-gray header band, compact coordinate grid in one question. No publisher logo, school, name, class, ID, QR code, barcode, watermark, page number, or answer key.
Handwriting: natural black-ballpoint student work within four question blocks: small option letters, short calculations, one circled result, and one crossed-out correction followed by a corrected answer. Handwriting must remain inside each question block and never obscure question numbers or center gutter.
Scene: entire page visible with four corners on a dark desk, slight phone-camera perspective, subtle page curl, soft uneven daylight, faint paper grain and very light show-through, sharp enough for OCR, no fingers or extra objects.
Constraints: portrait 3:4, high resolution, readable math, exactly six main numbered questions, privacy-safe, realistic rather than a pristine digital mockup, strong segmentation boundaries through spacing.
Avoid: copied wording from reference, extra questions, dense clutter, severe shadow, blur, pseudo-logos, personal data, red grading marks, handwriting crossing question boundaries, decorative nonsense text.
```

## v2（请求时间 2026-08-30T07:36:54.325Z）

```text
Use case: precise-object-edit
Asset type: private OCR validation sample
Primary request: Edit only Question 4 in the upper half of the right column. Preserve the entire photograph, paper, header, all other questions 1–3 and 5–6, coordinate graph, typography, handwriting style, shadows, perspective, page borders, spacing, and OCR-friendly block boundaries exactly as they are.
Replace the printed Question 4 content with mathematically valid text:
“4. 已知一次函数 y=3x+2。”
“（1）求当 x=-1 时的 y 值；”
“（2）当 y=8 时，求 x 的值。”
Replace only the handwritten work inside Question 4 with realistic black-ballpoint calculations:
“（1）y=3×(-1)+2=-1” with -1 circled.
“（2）3x+2=8，3x=6，x=2。” with x=2 lightly underlined.
Keep the writing fully inside Question 4 and away from the center gutter and Question 5. Do not change any other pixel-level content conceptually. Ensure Chinese and equations are legible and correct. No new logos, personal information, extra question numbers, red marks, or watermark.
```

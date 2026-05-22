#!/usr/bin/env python3
"""Convert 技术文档.md to Word .docx with embedded SVG→PNG figures."""

import re
import os
from docx import Document
from docx.shared import Pt, Inches, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
import cairosvg
from io import BytesIO

BASE_DIR = "/opt/hermes/2026AgentApp/deliverables/docs"
MD_PATH = os.path.join(BASE_DIR, "技术文档.md")
FIGURES_DIR = os.path.join(BASE_DIR, "figures")
OUT_PATH = os.path.join(BASE_DIR, "技术文档.docx")

# Read markdown
with open(MD_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

doc = Document()

# ── Page setup ──
for section in doc.sections:
    section.top_margin = Cm(2.54)
    section.bottom_margin = Cm(2.54)
    section.left_margin = Cm(3.18)
    section.right_margin = Cm(3.18)

# ── Style setup ──
style = doc.styles["Normal"]
font = style.font
font.name = "宋体"
font.size = Pt(12)
style.element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")

for level in range(1, 4):
    h_style = doc.styles[f"Heading {level}"]
    h_font = h_style.font
    h_font.name = "黑体"
    h_font.bold = True
    h_font.color.rgb = RGBColor(0, 0, 0)
    h_style.element.rPr.rFonts.set(qn("w:eastAsia"), "黑体")
    if level == 1:
        h_font.size = Pt(22)
    elif level == 2:
        h_font.size = Pt(16)
    else:
        h_font.size = Pt(14)

# ── Parse helpers ──
def is_h1(line):
    return re.match(r"^# (.+)", line)

def is_h2(line):
    return re.match(r"^## (.+)", line)

def is_h3(line):
    return re.match(r"^### (.+)", line)

def is_image(line):
    m = re.match(r"^!\[(.+)\]\((.+)\)", line)
    return m

def is_table_sep(line):
    return re.match(r"^\|[\s\-:|]+\|", line)

def is_table_row(line):
    return line.startswith("|") and line.rstrip().endswith("|")

def is_code_fence(line):
    return line.strip().startswith("```")

def is_blockquote(line):
    return line.startswith("> ")

def is_list_item(line):
    return re.match(r"^- (.+)", line)

def svg_to_png(svg_path):
    """Convert SVG to PNG bytes."""
    png_data = cairosvg.svg2png(url=svg_path, output_width=1400)
    return BytesIO(png_data)

def add_bold_runs(paragraph, text):
    """Add text to paragraph, handling **bold** and __bold__ markers."""
    # Split by ** and __ markers
    parts = re.split(r"(\*\*.+?\*\*|__.+?__)", text)
    for part in parts:
        if part.startswith("**") and part.endswith("**"):
            run = paragraph.add_run(part[2:-2])
            run.bold = True
        elif part.startswith("__") and part.endswith("__"):
            run = paragraph.add_run(part[2:-2])
            run.bold = True
        else:
            paragraph.add_run(part)

def add_blockquote(doc, lines, start, end):
    """Add a blockquote paragraph."""
    # Remove > prefix from each line
    clean_lines = []
    for line in lines[start:end]:
        if line.startswith("> "):
            clean_lines.append(line[2:])
        else:
            clean_lines.append(line)
    clean = "\n".join(clean_lines)
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(1)
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run(clean)
    run.font.size = Pt(10.5)
    run.font.color.rgb = RGBColor(100, 100, 100)
    run.font.italic = True

# ── First pass: identify blockquote and code block ranges ──
in_code_block = False
in_blockquote = False
code_start = -1
bq_start = -1

special_ranges = []  # (start, end, "code"|"blockquote")

for i, line in enumerate(lines):
    stripped = line.strip()
    
    if is_code_fence(line):
        if not in_code_block:
            in_code_block = True
            code_start = i
        else:
            special_ranges.append((code_start, i + 1, "code"))
            in_code_block = False
        continue
    
    if in_code_block:
        continue
    
    if is_blockquote(line):
        if not in_blockquote:
            in_blockquote = True
            bq_start = i
    else:
        if in_blockquote:
            special_ranges.append((bq_start, i, "blockquote"))
            in_blockquote = False

if in_blockquote:
    special_ranges.append((bq_start, len(lines), "blockquote"))

# Build set of "covered" line indices
covered = set()
for start, end, _ in special_ranges:
    for i in range(start, end):
        covered.add(i)

# ── Process lines ──
i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.strip()

    # Skip empty lines between non-covered sections
    if stripped == "":
        i += 1
        continue

    # Check if this line is inside a special range
    special = None
    for start, end, stype in special_ranges:
        if start <= i < end:
            special = (start, end, stype)
            break

    if special:
        start, end, stype = special
        if stype == "code":
            # Code block: add as monospaced paragraph
            code_lines = lines[start + 1 : end - 1]  # skip fences
            code_text = "".join(code_lines).rstrip()
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(1)
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(6)
            run = p.add_run(code_text)
            run.font.name = "Consolas"
            run.font.size = Pt(9)
        elif stype == "blockquote":
            add_blockquote(doc, lines, start, end)
        i = end
        continue

    # Headings
    m = is_h1(line)
    if m:
        doc.add_heading(m.group(1), level=1)
        i += 1
        continue

    m = is_h2(line)
    if m:
        doc.add_heading(m.group(1), level=2)
        i += 1
        continue

    m = is_h3(line)
    if m:
        doc.add_heading(m.group(1), level=3)
        i += 1
        continue

    # Image
    m = is_image(line)
    if m:
        alt_text = m.group(1)
        svg_rel_path = m.group(2)
        svg_path = os.path.join(BASE_DIR, svg_rel_path)
        if os.path.exists(svg_path):
            try:
                png_buf = svg_to_png(svg_path)
                doc.add_picture(png_buf, width=Inches(6))
                # Center the last paragraph (image)
                doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
                # Add caption
                cap = doc.add_paragraph()
                cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                cap_run = cap.add_run(alt_text)
                cap_run.font.size = Pt(9)
                cap_run.font.color.rgb = RGBColor(128, 128, 128)
            except Exception as e:
                doc.add_paragraph(f"[图片: {alt_text} — 转换失败: {e}]")
        else:
            doc.add_paragraph(f"[图片: {alt_text} — 文件未找到: {svg_path}]")
        i += 1
        continue

    # Table
    if is_table_sep(line):
        # This is a separator row — skip it, look back for header, forward for rows
        # Find header row (before separator)
        header_idx = i - 1
        while header_idx >= 0 and (lines[header_idx].strip() == "" or is_table_sep(lines[header_idx])):
            header_idx -= 1
        
        if header_idx >= 0 and is_table_row(lines[header_idx]):
            header_cells = [c.strip() for c in lines[header_idx].strip().strip("|").split("|")]
        else:
            i += 1
            continue

        # Find data rows after separator
        data_rows = []
        j = i + 1
        while j < len(lines) and is_table_row(lines[j]):
            row_cells = [c.strip() for c in lines[j].strip().strip("|").split("|")]
            data_rows.append(row_cells)
            j += 1

        # Create table
        num_cols = len(header_cells)
        table = doc.add_table(rows=1 + len(data_rows), cols=num_cols)
        table.style = "Light Grid Accent 1"

        # Header
        for ci, cell_text in enumerate(header_cells):
            cell = table.rows[0].cells[ci]
            cell.text = ""
            run = cell.paragraphs[0].add_run(cell_text)
            run.bold = True
            run.font.size = Pt(10)

        # Data
        for ri, row in enumerate(data_rows):
            for ci, cell_text in enumerate(row):
                if ci < num_cols:
                    cell = table.rows[ri + 1].cells[ci]
                    cell.text = ""
                    run = cell.paragraphs[0].add_run(cell_text)
                    run.font.size = Pt(10)

        i = j
        continue

    # List item
    m = is_list_item(line)
    if m:
        items = [m.group(1)]
        # Collect continuation lines (indented)
        j = i + 1
        while j < len(lines) and lines[j].strip() and not is_list_item(lines[j]):
            items[-1] += " " + lines[j].strip()
            j += 1
        for item_text in items:
            p = doc.add_paragraph(style="List Bullet")
            add_bold_runs(p, item_text)
        i = j
        continue

    # Regular paragraph
    # Collect multi-line paragraphs
    para_lines = [stripped]
    j = i + 1
    while j < len(lines) and lines[j].strip() != "" and not any(
        f(lines[j]) for f in [is_h1, is_h2, is_h3, is_image, is_table_sep, is_table_row, is_code_fence, is_blockquote, is_list_item]
    ):
        para_lines.append(lines[j].strip())
        j += 1

    para_text = " ".join(para_lines)
    if para_text.strip():
        p = doc.add_paragraph()
        add_bold_runs(p, para_text)

    i = j

# ── Save ──
doc.save(OUT_PATH)
print(f"✅ Saved: {OUT_PATH}")
print(f"   Pages: ~{len(doc.paragraphs) // 30 + 1}")
print(f"   Paragraphs: {len(doc.paragraphs)}")
print(f"   Images: 3 (SVG→PNG)")

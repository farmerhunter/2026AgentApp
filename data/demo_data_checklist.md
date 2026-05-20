# Demo Data Checklist

本文件用于在本地 UI 开发和 VPS 发布前检查 demo JSON 数据是否支撑第一版演示闭环。

开发者可逐项勾选，未满足项应修复后再发布。

---

## A. Contract Version

- [ ] 所有 contract JSON 使用 `"contract_version": "1.1"`
- [ ] 所有 sample JSON 使用 `"contract_version": "1.1"`
- [ ] `subject` 字段使用内部 code：`chinese` / `math` / `english`
- [ ] 中文展示字段使用 `subject_label`（语文 / 数学 / 英语）

验证命令：
```bash
grep -r '"contract_version"' data/contracts data/sample_inputs data/sample_outputs | grep -v '"1.1"'
grep -r '"subject":' data/sample_inputs data/sample_outputs | grep -vE 'chinese|math|english'
```

---

## B. Sample Input Coverage

- [ ] 数学教材摘要 `textbook_content_summary.json` 存在
- [ ] 语文教材摘要 `textbook_content_summary.json` 存在
- [ ] 数学备注 `note_*.json` 存在
- [ ] 语文备注 `note_*.json` 存在
- [ ] 数学上传记录 `upload_meta.json` 存在
- [ ] 语文上传记录 `upload_meta.json` 存在

验证命令：
```bash
ls data/sample_inputs/textbooks/textbook_math_grade8_demo/textbook_content_summary.json
ls data/sample_inputs/textbooks/textbook_chinese_grade8_demo/textbook_content_summary.json
ls data/sample_inputs/notes/note_*.json
ls data/sample_inputs/question_sessions/upload_*/upload_meta.json
```

---

## C. Sample Output Coverage

- [ ] 每个 upload session 都有 `question_split_result.json`
- [ ] 每个 upload session 都有 `question_confirmation_result.json`
- [ ] `focus_question_records` 同时包含 chinese 和 math 记录
- [ ] `week_reports_index.json` 至少包含 2 份周报索引
- [ ] 周报中 `subjects` 列出 `chinese`（active）、`math`（active）、`english`（no_data）
- [ ] 两份周报覆盖不同周范围

验证命令：
```bash
find data/sample_outputs/question_sessions -name 'question_split_result.json' | wc -l
find data/sample_outputs/question_sessions -name 'question_confirmation_result.json' | wc -l
python3 -c "
import json
with open('data/sample_outputs/week_reports/week_reports_index.json') as f:
    idx = json.load(f)
    print(f'Report count: {len(idx.get(\"reports\", []))}')
    for r in idx.get('reports', []):
        print(f'  {r[\"weekly_report_id\"]}: {r.get(\"week_start\",\"?\")} - {r.get(\"week_end\",\"?\")}')
"
```

---

## D. Web UI Public Data Sync

- [ ] `src/web_ui/public/data/` 包含与 sample inputs/outputs 对应的 demo 文件
- [ ] `public/data/textbooks/` 包含 math 和 chinese 教材摘要
- [ ] `public/data/notes/` 包含 math 和 chinese 备注
- [ ] `public/data/question_sessions/` 包含 `upload_*_001` 和 `upload_*_002`
- [ ] `public/data/week_reports/` 文件与 `sample_outputs/week_reports/` 同步
- [ ] Vite 本地开发能通过 `/data/...` 读取所有 public data 文件

验证命令：
```bash
diff <(cd data/sample_outputs/week_reports && ls *.json | sort) \
     <(cd src/web_ui/public/data/week_reports && ls *.json | sort)
```

---

## E. Privacy and Public Safety

- [ ] 无真实学生姓名
- [ ] 无真实学校名称
- [ ] 无真实试卷图片或 PDF
- [ ] 无手机号、身份证号等个人隐私信息
- [ ] 无 API key 或 token
- [ ] 无私人聊天记录
- [ ] 所有文件路径使用 `/data/...` 公共 URL，不使用本地绝对路径
- [ ] 无 `/Users/`、`/var/lib/`、`/private/` 等本地路径

验证命令：
```bash
rg -i 'phone|手机|身份证|api.key|token|password' data/sample_inputs data/sample_outputs src/web_ui/public/data
rg '/Users/|/var/lib/|/private/' data/sample_inputs data/sample_outputs src/web_ui/public/data
```

---

## F. Demo Story Closure

- [ ] **学习内容**（LearningContentView）：能展示语文和数学教材摘要
- [ ] **学习成果**（LearningResultsView）：能展示语文和数学上传材料
- [ ] **文字备注**（TextNoteView）：能展示语文和数学备注
- [ ] **重点题确认**（QuestionReviewView）：能展示切题结果和确认记录
- [ ] **历史周报**（WeeklyReportsView）：
  - [ ] 跨学科总览（subjects 汇总）
  - [ ] 语文分区（active）
  - [ ] 数学分区（active）
  - [ ] 英语空状态（no_data）
- [ ] 跨文件引用一致性：`upload_id`、`question_id`、`focus_question_id` 在上下游文件中可追溯

---

## G. JSON Validity

- [ ] 所有 sample JSON 文件通过 `python3 -m json.tool` 验证
- [ ] 所有 contract JSON 文件通过 `python3 -m json.tool` 验证

验证命令：
```bash
find data/contracts data/sample_inputs data/sample_outputs -name '*.json' \
  -exec sh -c 'python3 -m json.tool "$1" >/dev/null 2>&1 || echo "INVALID: $1"' _ {} \;
```

---

## 使用说明

### 本地 UI 开发前

1. 逐项勾选本 checklist
2. 未满足项先修复再开始 UI 开发
3. 确保 `public/data/` 与 `sample_outputs/` 同步

### VPS 发布前

1. 重新运行本 checklist 所有验证命令
2. 确认 `deploy_web_ui.sh` 已将 data 同步到 Nginx 目录
3. 确认浏览器能通过 `/data/week_reports/...` 访问数据

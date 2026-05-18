# Hermes 存储设计

本文档记录 Hermes 在试卷上传、切题识别、重点题确认、周报生成场景下的存储设计。目标是在演示阶段保持简单可落地，同时为后续接入腾讯云 COS 和数据库预留清晰迁移路径。

## 1. 设计结论

存储方案采用分阶段演进：

```text
第一阶段：VPS 本地文件存储
第二阶段：腾讯云 COS + 数据库
```

第一阶段优先保证演示可运行，所有文件存放在 VPS 本地目录中。

第二阶段将大文件和归档文件迁移到腾讯云 COS，将索引、元数据、状态和查询能力迁移到数据库。

## 2. 为什么需要新的存储设计

原始周报历史检索只需要保存少量 JSON：

```text
week_reports/
  week_reports_index.json
  week_YYYYMMDD_YYYYMMDD.json
```

引入试卷上传和切题后，会新增：

- 原始试卷图片或 PDF
- 腾讯云 OCR 原始响应
- 切题后的单题图片
- 题目坐标和识别文本
- 学生确认记录
- Hermes 重点题总结
- 周报 JSON
- 任务状态和错误信息

因此，存储从“少量静态 JSON”升级为“图片 + JSON + 索引 + 状态”的体系。

## 3. 第一阶段：VPS 本地文件存储

第一阶段不额外购买存储服务，直接使用 VPS 本地磁盘。

推荐根目录：

```text
/var/lib/hermes/data/
```

推荐目录结构：

```text
/var/lib/hermes/data/
  uploads/
    student_demo/
      2026-05-18/
        upload_20260518_001/
          page_1.jpg
          upload_meta.json

  question_crops/
    student_demo/
      2026-05-18/
        upload_20260518_001/
          q_001.jpg
          q_002.jpg

  ocr_results/
    student_demo/
      2026-05-18/
        upload_20260518_001/
          question_split_result.json
          tencent_raw_response.json

  confirmations/
    student_demo/
      2026-05-18/
        upload_20260518_001/
          question_confirmation_result.json

  focus_question_records/
    student_demo/
      2026-05-18/
        focus_questions.json

  week_reports/
    student_demo/
      week_reports_index.json
      week_20260518_20260524.json
```

## 4. 第一阶段 Web 暴露方式

不建议直接公开整个 `/var/lib/hermes/data/`。

演示阶段应区分“内部存储目录”和“前端公开读取目录”。

内部存储目录：

```text
/var/lib/hermes/data/
```

前端公开读取目录：

```text
/var/www/html/data/
```

Hermes 后端或部署脚本负责将脱敏后的演示数据从内部存储目录复制或发布到前端公开目录。

前端不应直接读取 `/var/lib/hermes/data/`。

演示阶段可以通过 Nginx 暴露必要的只读 URL，例如：

```text
/data/week_reports/
/data/question_sessions/
```

但需要注意：

- 原始试卷图片可能包含隐私，不应默认公开。
- 切题图片也可能包含学生姓名、分数或老师批注。
- 演示数据必须脱敏。
- 真实学生数据应通过后端鉴权后访问，而不是直接公开静态目录。

演示阶段公开目录建议使用：

```text
/var/www/html/data/
  week_reports/
    week_reports_index.json
    week_YYYYMMDD_YYYYMMDD.json

  question_sessions/
    upload_20260518_001/
      upload_meta.json
      question_split_result.json
      question_confirmation_result.json
      original/
        page_1.jpg
      crops/
        q_001.jpg
        q_002.jpg
```

生产阶段应避免把真实原始图片直接放到公开 Web 根目录下。

第一阶段为了保持前端简单，周报公开 URL 仍采用单学生演示路径：

```text
/data/week_reports/week_reports_index.json
/data/week_reports/week_YYYYMMDD_YYYYMMDD.json
```

内部存储可以保留学生维度：

```text
/var/lib/hermes/data/week_reports/{student_id}/...
```

发布到 `/var/www/html/data/week_reports/` 时，选择当前演示学生的数据进行复制或生成。

## 5. 第二阶段：腾讯云 COS + 数据库

第二阶段建议同时引入：

```text
腾讯云 COS
数据库
```

COS 负责保存大文件和归档文件：

- 原始试卷图片
- 原始 PDF
- 切题后的单题图片
- OCR 原始响应 JSON
- 周报 JSON 归档
- 其他上传附件

数据库负责保存可查询、可筛选、可更新的结构化数据：

- 学生
- 上传记录
- OCR 任务状态
- 题目元数据
- 人工确认记录
- 重点题记录
- 周报索引
- 学习建议
- 操作日志

## 6. COS 目录结构设计

推荐 COS bucket：

```text
hermes-study-data
```

推荐对象 key 结构：

```text
uploads/
  {student_id}/{date}/{upload_id}/page_1.jpg

question_crops/
  {student_id}/{date}/{upload_id}/q_001.jpg

ocr_results/
  {student_id}/{date}/{upload_id}/question_split_result.json
  {student_id}/{date}/{upload_id}/tencent_raw_response.json

confirmations/
  {student_id}/{date}/{upload_id}/question_confirmation_result.json

focus_question_records/
  {student_id}/{date}/focus_questions.json

week_reports/
  {student_id}/week_reports_index.json
  {student_id}/week_YYYYMMDD_YYYYMMDD.json
```

示例：

```text
uploads/student_demo/2026-05-18/upload_20260518_001/page_1.jpg
question_crops/student_demo/2026-05-18/upload_20260518_001/q_001.jpg
ocr_results/student_demo/2026-05-18/upload_20260518_001/question_split_result.json
week_reports/student_demo/week_20260518_20260524.json
```

## 7. 数据库表设计草案

第二阶段可以先使用 SQLite，后续迁移到 MySQL 或 PostgreSQL。

### 7.1 students

保存学生基础信息。

```text
id
display_name
grade
created_at
updated_at
```

### 7.2 uploads

保存上传记录。

```text
id
student_id
subject
source_type
captured_at
original_file_url
storage_provider
status
created_at
updated_at
```

### 7.3 ocr_jobs

保存 OCR / 切题任务。

```text
id
upload_id
provider
provider_job_id
status
raw_response_url
error_message
created_at
updated_at
```

### 7.4 questions

保存切题后的题目元数据。

```text
id
upload_id
page
question_index
question_text
question_image_url
bbox_json
raw_ocr_json_url
created_at
updated_at
```

### 7.5 question_confirmations

保存学生或家长的人工确认。

```text
id
question_id
selected
student_mark
teacher_score
full_score
knowledge_point
mistake_reason
review_priority
note
created_at
updated_at
```

### 7.6 focus_question_records

保存 Hermes 生成的重点题记录。

```text
id
question_id
student_id
subject
knowledge_point
mistake_summary
recommended_action
weekly_report_id
created_at
updated_at
```

### 7.7 weekly_reports

保存周报索引和状态。

```text
id
student_id
week_start
week_end
report_json_url
summary
status
created_at
updated_at
```

## 8. 衔接性要求

第一阶段和第二阶段必须保持数据模型兼容，避免后续重做。

要求：

1. 第一阶段的 JSON 字段应尽量接近第二阶段数据库表字段。
2. 所有记录都必须有稳定 ID，例如 `upload_id`、`question_id`、`record_id`。
3. 文件路径不要写死在业务逻辑里，应通过配置项控制。
4. JSON 中保存文件 URL 或相对路径，不保存本地绝对路径。
5. 存储 provider 需要显式记录，例如 `local`、`cos`。
6. 腾讯云原始响应必须保留，方便回溯和调试。
7. 人工确认记录和 OCR 结果分开保存，避免覆盖原始识别结果。
8. 周报引用重点题记录，不直接复制全部大图数据。
9. 前端只依赖公开 URL 契约，不依赖内部存储目录。
10. 从本地存储迁移到 COS 时，应保持前端 JSON 字段和 URL 字段含义不变。

## 9. 配置项建议

建议使用环境变量：

```text
HERMES_STORAGE_PROVIDER=local
HERMES_DATA_DIR=/var/lib/hermes/data
HERMES_PUBLIC_DATA_BASE_URL=/data

TENCENT_COS_BUCKET=hermes-study-data
TENCENT_COS_REGION=ap-beijing
TENCENT_COS_BASE_PREFIX=

DATABASE_URL=sqlite:////var/lib/hermes/hermes.db
```

第一阶段：

```text
HERMES_STORAGE_PROVIDER=local
```

第二阶段：

```text
HERMES_STORAGE_PROVIDER=cos
DATABASE_URL=mysql://... 或 postgresql://...
```

## 10. 隐私和安全要求

试卷图片和错题本图片可能包含：

- 学生姓名
- 学校
- 班级
- 分数
- 老师批注
- 家长或学生备注

因此：

1. 不要将真实图片、真实 OCR 结果或真实周报提交到 GitHub。
2. 示例数据必须脱敏。
3. 生产环境不要公开原始上传目录。
4. COS bucket 默认应设为私有读写。
5. 前端访问真实图片时应使用后端鉴权或签名 URL。
6. 日志中不要打印完整图片 URL、手机号、身份证号等敏感信息。

## 11. 演示阶段建议

演示阶段可以采用：

```text
VPS 本地文件存储
静态 JSON
脱敏样例图片
Nginx 暴露 demo 数据
```

不必立即购买额外存储服务。

但代码和数据结构应按照第二阶段可迁移的方式设计，避免把本地路径、公开 URL 和业务逻辑强绑定。

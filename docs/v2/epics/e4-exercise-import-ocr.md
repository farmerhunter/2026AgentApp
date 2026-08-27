# E4 练习/试卷图片导入与错题确认设计

Status: Proposed
Epic: E4 / GitHub Issue #88
Owner: David (LaoLiuHaHaHaHaXiao)
Updated: 2026-08-27

> 本文遵循 `docs/epic-design-guidelines.md` 与 `docs/epic-collaboration-protocol.md`。它只记录 E4 的跨模块边界、数据流、失败处理和验收策略；实时任务与状态以 #88 和 GitHub Project 为准。

## 1. 成果与用户场景

E4 结束后，学生可以在 `/app/import` 完成：

```text
选择一张练习/试卷图片
  -> 上传到私有目录
  -> 腾讯 QuestionSplitOCR 切题并识别题干与作答
  -> 查看原图和题目 bbox
  -> 勾选错题、补充得分/备注
  -> 保存确认结果
```

这份确认结果是 E5 的可靠输入。E4 不自动判错，也不生成知识点或错因。

## 2. 范围与非目标

### 当前负责

- 单张 JPG/PNG 上传，最大 10 MB。
- 原图保存到私有目录，不进入公开静态目录。
- 腾讯云 `QuestionSplitOCR` adapter，密钥只从环境变量读取。
- OCR 结果保存题干、学生作答、bbox 和必要原始响应元数据。
- 前端按原图 + bbox 展示题目区域，不保存每题裁图。
- 学生勾选错题，并保存确认结果。
- OCR 失败时明确 failed 并可重试，不产生半成品题目或确认数据。

### 非目标

- 不自动判错，不替代学生确认。
- 不支持 PDF 试卷、多图片批量上传、复杂文件管理。
- 不实现多 OCR Provider、生产级内容安全或通用 OCR 平台。
- 不在 E4 写入知识地图引用或错因分析；这些由 E5 完成。
- 不改变 `/demo` 行为。

## 3. 已验证基线

以下事实来自当前仓库：

- E1 已有 `uploads / ocr_jobs / questions / question_confirmations` 表。
- E1 已提供 `GET /api/sessions`、`GET /api/sessions/:upload_id/split`、`GET /api/sessions/:upload_id/confirmation` 和 `POST /api/sessions/:upload_id/confirmation`。
- E2 的 `/app/import` 已建立 session/split/confirmation 读取骨架，并明确显示 E4 未接入。
- 当前没有图片上传端点、OCR adapter、腾讯 SDK 或私有图片读取端点。
- `.gitignore` 已忽略 `.env`、`.env.*` 和密钥文件。
- E3 已完成知识地图 registry/API，E5 后续可据此写入版本化知识引用。

## 4. 核心不变量

1. 原图是私有文件，只通过 E4 API 在 `/app` 中读取；不进入 `/demo`、公开静态目录或 Git。
2. OCR 负责识别与切题；学生负责确认错题；E4 不自动判错。
3. OCR 失败不创建题目或确认记录；确认保存必须原子完成。
4. 确认结果最多 10 道已勾选题，作为一次 E5 分析任务输入。
5. E4 不写 `knowledge_map_ref`、`knowledge_point_ids` 或错因；这些字段由 E5 生成并校验。
6. OCR 配置必须经过脱敏图片探测后固定，不能在终评现场临时试参数。

## 5. 边界和数据流

```text
浏览器 /app/import
  -> POST /api/uploads
  -> 私有目录保存原图
  -> 创建 exercise_ocr job
  -> OCR adapter
  -> questions + raw response 保存
  -> GET /api/uploads/:upload_id/image
  -> GET /api/sessions/:upload_id/split
  -> 学生勾选错题
  -> POST /api/sessions/:upload_id/confirmation
  -> E5 后续读取确认结果
```

### 5.1 私有文件路径

- 本地开发：`runtime/private/uploads/<upload_id>/<filename>`
- VPS：`/var/lib/hermes/data/uploads/<upload_id>/<filename>`
- SQLite 只保存 `storage_key` 和必要元数据，不保存公开 URL。

### 5.2 原图展示

- 使用 `GET /api/uploads/:upload_id/image` 返回原图。
- 前端只叠加 bbox 覆盖层，不生成或保存每题裁图。
- 该 endpoint 只服务 `/app` 上传的私有图片；`/demo` 不访问。

## 6. API、数据模型与 contract

### 6.1 新增/修改 API

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `POST /api/uploads` | `multipart/form-data` | 上传图片，创建 upload 和 `exercise_ocr` job |
| `GET /api/uploads/:upload_id/ocr` | 查询 OCR job 状态 | 返回 queued/running/succeeded/failed |
| `POST /api/uploads/:upload_id/ocr/retry` | 重新运行 OCR | 失败后重试，不重复创建题目 |
| `GET /api/uploads/:upload_id/image` | 读取私有原图 | 供 bbox 展示 |
| `POST /api/sessions/:upload_id/confirmation` | 保存确认结果 | 已有端点，E4 补齐校验和最小字段 |

### 6.2 数据库字段补充

`uploads` 增加：

```text
storage_key
file_name
file_size
mime_type
image_width
image_height
```

`questions` 增加：

```text
student_answer_text
question_type
ocr_confidence
```

`ocr_jobs` 复用并补充 provider 结果状态；不新建重复任务表。

### 6.3 确认结果最小字段

E4 只允许学生确认以下内容：

```json
{
  "question_id": "question_...",
  "selected": true,
  "student_mark": "0",
  "full_score": "10",
  "note": "不会判断函数图象"
}
```

- `selected` 表示是否错题。
- `knowledge_point`、`knowledge_point_ids`、`mistake_reason` 由 E5 写入，E4 不要求也不伪造。

### 6.4 超过 10 题策略

- OCR 切出的题目全部保存和展示。
- 学生确认时，最多只能勾选并保存 10 道错题。
- 如果提交超过 10 道，API 返回 400，不保存部分结果。
- E5 只使用 E4 已保存的确认错题作为输入。

### 6.5 contract 映射

| 接口或输出 | 权威 contract | 验证方式 |
| --- | --- | --- |
| `GET /api/sessions/:upload_id/split` | `question_split_result` | API smoke + 字段断言 |
| `GET /api/sessions/:upload_id/confirmation` | `question_confirmation_result` | API smoke + 原子失败测试 |
| `GET /api/uploads/:upload_id/ocr` | E4 新增 OCR job envelope | 轮询到终态测试 |

## 7. OCR adapter 与探测方案

### 7.1 adapter 边界

- 使用腾讯云官方 Node SDK。
- 通过环境变量读取：

  ```text
  TENCENTCLOUD_SECRET_ID
  TENCENTCLOUD_SECRET_KEY
  TENCENTCLOUD_REGION
  TENCENT_OCR_USE_NEW_MODEL
  ```

- 使用 `ImageBase64` 直传，不上传图片到公开 URL。
- adapter 返回标准化的 questions/bbox/raw response，隐藏 SDK 细节。

### 7.2 fixture 模式

本地和 CI 不调用真实腾讯 OCR：

```text
OCR_PROVIDER_MODE=fixture | real
```

- `fixture` 使用仓库内合成图片和固定 OCR 结果，用于 API、事务和前端联调。
- `real` 才调用腾讯云；真实 OCR 探测只在受控环境进行。

### 7.3 终评前探测矩阵

在正式确定 `UseNewModel` 和展示样例前，至少测试：

| 维度 | 选项 |
| --- | --- |
| 模型 | `UseNewModel=false`、`UseNewModel=true` |
| 题目类型 | 纯印刷、印刷题目 + 手写作答 |
| 图片质量 | 清晰扫描、普通手机拍照、轻度倾斜/阴影 |
| 排版 | 单列、双列、题号明显、题号弱 |

每次记录：

- 切题数量
- 题干识别质量
- 手写作答识别质量
- bbox 是否对齐
- 漏切/多切/错切数量

最后固定：

```text
UseNewModel + 展示样例图片 + 字段映射
```

探测产出的原图和中间结果只放私有目录，不提交 Git。

## 8. 失败与恢复

- 文件类型不是 JPG/PNG 或超过 10 MB：返回 400，不创建 upload。
- 私有目录写入失败：不创建 upload，返回 500。
- OCR 调用失败、超时或返回无法解析：job 进入 `failed`，不创建 questions/confirmations。
- 前端轮询失败可点击重试；重试复用同一 upload，不创建重复 upload。
- 确认提交超过 10 题或字段非法：返回 400，不写部分确认。
- 图片缺失或权限不足：图片 endpoint 返回 404，不 fallback 到 demo 数据。

## 9. 当前阶段实施映射

### 9.1 后端

- 增加 multipart 依赖并实现私有文件上传。
- 增加 OCR adapter 和 fixture adapter。
- 增加 `exercise_ocr` job 创建、执行、状态查询和 retry。
- 扩展 `questions`/`uploads` schema 和 seed 兼容。
- 扩展 split/confirmation 响应与确认保存校验。

### 9.2 前端

- 将 `/app/import` 的 `not_ready` 替换为上传入口。
- 上传后显示 job 状态、原图、bbox 覆盖和题目列表。
- 学生可勾选错题并提交最小确认字段。
- 保持 `/demo` 不动。

## 10. 验收与证据

### 10.1 fixture 自动验证

- fixture adapter smoke 覆盖 upload、OCR job、split、image、confirmation。
- 确认超过 10 题返回 400，且不产生部分写入。
- OCR 失败 fixture 返回 failed，且不创建 questions/confirmations。
- `npm run build`、`npm run validate:data` 仍通过。

### 10.2 真实 OCR 手工验证

- 使用至少两张脱敏图片，分别用 `UseNewModel=false/true` 探测。
- 记录探测矩阵结果和最终展示样例。
- 在 `/app/import` 手工跑通一次完整流程。

## 11. 接受的残余与延后能力

- 多图片批量、PDF、文件管理和生产级内容安全延后。
- 多 OCR Provider 和自动重试平台延后。
- 不建设图像预处理、旋转校正或复杂后处理。
- 访问控制由 E6 部署层决定。

## 12. 需要 Architect 或项目负责人决定的问题

1. `POST /api/uploads` 使用 multipart/form-data 和本地私有目录保存，是否接受。
2. 使用 `GET /api/uploads/:upload_id/image` 返回原图以支持 bbox 展示，是否接受。
3. fixture/real OCR adapter 双模式是否接受。
4. 探测矩阵和终评前固定 `UseNewModel` 的流程是否接受。
5. 确认结果最小字段仅保留 `selected / student_mark / full_score / note`，是否接受。
6. 超过 10 题时“全部展示，确认最多 10 道，超出拒绝”是否接受。

# E4 练习/试卷图片导入与错题确认设计

Status: Proposed
Epic: E4 / GitHub Issue #88
Owner: David (LaoLiuHaHaHaHaXiao)
Updated: 2026-08-28

> 本文遵循 `docs/epic-design-guidelines.md` 与 `docs/epic-collaboration-protocol.md`。它只记录 E4 的跨模块边界、数据流、失败处理和验收策略；实时任务与状态以 #88 和 GitHub Project 为准。

## 1. 成果与用户场景

E4 结束后，学生可以在 `/app/import` 完成：

```text
选择一张练习/试卷图片
  -> 上传到私有目录
  -> 腾讯 QuestionSplitOCR 切题并识别题干与作答
  -> 查看原图和题目 bbox
  -> 勾选错题、必要时补录作答文本、补充备注
  -> 保存确认结果
```

这份确认结果是 E5 的可靠输入。E4 不自动判错，也不生成知识点或错因。

## 2. 范围与非目标

### 当前负责

- 单张 JPG/PNG 上传，原始文件上限为 **7 MiB**，避免 Base64 后超过腾讯 `ImageBase64` 10 MB 限制。
- 原图保存到私有目录，不进入公开静态目录。
- 腾讯云 `QuestionSplitOCR` adapter，密钥只从环境变量读取。
- OCR 结果保存题干、学生作答、bbox 和脱敏后的必要原始响应元数据。
- 前端按原图 + bbox 展示题目区域，不保存每题裁图。
- 学生勾选错题，并保存最小确认字段。
- OCR 失败时明确 `failed` 并可重试，不产生半成品题目或确认数据。

### 非目标

- 不自动判错，不替代学生确认。
- 不支持 PDF 试卷、多图片批量上传、复杂文件管理。
- 不实现多 OCR Provider、生产级内容安全或通用 OCR 平台。
- 不在 E4 写入知识地图引用、知识点或错因分析；这些由 E5 完成。
- 不保存完整 raw response、完整 OCR 文本、原图 Base64、secret 或日志敏感内容。
- 不改变 `/demo` 行为。

## 3. 已验证基线

以下事实来自当前仓库：

- E1 已有 `uploads / ocr_jobs / questions / question_confirmations` 表。
- E1 已提供 `GET /api/sessions`、`GET /api/sessions/:upload_id/split`、`GET /api/sessions/:upload_id/confirmation` 和 `POST /api/sessions/:upload_id/confirmation`。
- 当前 `question_confirmation_result` 中 `student_mark` 语义不是得分，`teacher_score` 才是既有得分字段；E4 设计不能复用 `student_mark` 承载答案或分数。
- E2 的 `/app/import` 已建立 session/split/confirmation 读取骨架，并明确显示 E4 未接入。
- 当前没有图片上传端点、OCR adapter、腾讯 SDK 或私有图片读取端点。
- `.gitignore` 已忽略 `.env`、`.env.*` 和密钥文件。
- E3 已完成知识地图 registry/API，E5 后续可据此写入版本化知识引用。
- #93 负责腾讯 OCR 测试账户、预算、脱敏探测样本和凭证注入；real adapter 冻结和真实 walkthrough 依赖 #93 完成。

## 4. 核心不变量

1. 原图是私有文件，只通过 E4 API 在 `/app` 中读取；不进入 `/demo`、公开静态目录或 Git。
2. OCR 负责识别与切题；学生负责确认错题；E4 不自动判错。
3. OCR 失败不创建题目或确认记录；确认保存必须原子完成。
4. 确认结果最多 10 道已勾选题，作为一次 E5 分析任务输入。
5. E4 不写 `knowledge_map_ref`、`knowledge_point_ids` 或错因；这些字段由 E5 生成并校验。
6. 私有图片 endpoint 只能由 DB 中的 `storage_key` 定位，不接受客户端路径；E6 shared-password gate 生效前不得对公网激活。
7. OCR 配置必须经过脱敏图片探测后固定，不能在终评现场临时试参数。

## 5. 边界和数据流

```text
浏览器 /app/import
  -> POST /api/uploads
  -> 校验 magic bytes、大小和类型
  -> 私有目录保存随机文件名原图
  -> 创建 exercise_ocr job
  -> OCR adapter
  -> normalizer/validator
  -> questions + 脱敏 metadata 原子保存
  -> GET /api/uploads/:upload_id/image
  -> GET /api/sessions/:upload_id/split
  -> 学生勾选错题
  -> POST /api/sessions/:upload_id/confirmation
  -> E5 后续读取确认结果
```

### 5.1 私有文件路径

- 本地开发：`runtime/private/uploads/<upload_id>/<random_server_filename>`
- VPS：`/var/lib/hermes/data/uploads/<upload_id>/<random_server_filename>`
- SQLite 只保存 `storage_key` 和必要元数据，不保存公开 URL。
- 文件名由服务端生成，不接受客户端原文件名。

### 5.2 原图展示

- 使用 `GET /api/uploads/:upload_id/image` 返回原图。
- 该 endpoint 根据 upload 的 `storage_key` 定位文件，并做路径 confinement。
- 响应头至少设置 `Cache-Control: private, no-store`。
- 文件读取前做 magic byte 校验，不信任扩展名或 MIME。
- 前端只叠加 bbox 覆盖层，不生成或保存每题裁图。
- E6 的 shared-password gate 必须同时保护 API 和 image endpoint；在 gate 生效前，image endpoint 不得对公网激活。

### 5.3 bbox 语义

- bbox 统一为相对于 image endpoint 返回的同一份图像字节、左上角原点的像素 `{ x, y, width, height }`。
- Tencent 返回的 `Coord`、`OrgWidth/OrgHeight`、`Width/Height`、`Angle` 由 normalizer 映射并校验。
- E4 不做 EXIF 旋转归一化；上传时拒绝带旋转元数据或方向未知且无法安全对齐的图片，避免 overlay 错位。
- 前端保持完整图像比例，不使用 `object-cover` 裁切。

## 6. API、数据模型与 contract

### 6.1 新增/修改 API

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `POST /api/uploads` | `multipart/form-data` | 上传图片，创建 upload 和 `exercise_ocr` job |
| `GET /api/uploads/:upload_id/ocr` | 查询 OCR job 状态 | 返回 `queued/running/succeeded/failed/interrupted` |
| `POST /api/uploads/:upload_id/ocr/retry` | 重新运行 OCR | 同一 upload 创建新 attempt，成功后不重复 questions |
| `GET /api/uploads/:upload_id/image` | 读取私有原图 | 供 bbox 展示 |
| `POST /api/sessions/:upload_id/confirmation` | 保存确认结果 | 已有端点，E4 补齐校验和最小字段 |

### 6.2 数据库字段补充与 migration

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

`ocr_jobs` 增加：

```text
attempt
is_latest
provider_request_id
provider_metadata_json
```

Migration 规则：

- 不在 `schema.sql` 里只依赖 `CREATE TABLE IF NOT EXISTS`；增加独立 migration 脚本。
- 执行前用 `PRAGMA table_info(...)` 检查列是否已存在，重复执行幂等。
- 对已有 E1 SQLite 验证升级，并验证 API 进程重启后数据可读。
- 新字段全部 nullable，旧 consumer 继续兼容。

### 6.3 确认结果最小字段

E4 只接受并写入：

```json
{
  "question_id": "question_...",
  "selected": true,
  "student_answer_text": "学生作答文本，仅 OCR 缺失时填写",
  "note": "不会判断函数图象"
}
```

- `selected` 表示是否错题。
- `student_answer_text` 只在 OCR 未识别到学生作答时允许补录。
- `note` 可选。
- E4 不接受/写入 `student_mark`、`teacher_score`、`full_score`、`knowledge_point*`、`mistake_reason` 等字段。
- 旧 response 中兼容字段保留为 nullable，但 E4 不把它们作为可编辑输入。

### 6.4 超过 10 题策略

- OCR 切出的题目全部保存和展示。
- 学生确认时，最多只能勾选并保存 10 道错题。
- 前端显示 `已选 n/10`，第 11 题在 UI 阻止；API 再次校验，超过 10 返回 400。
- 确认保存必须原子：任何一题非法或总数超过 10，不写部分结果。

### 6.5 contract 映射与兼容

| 接口或输出 | 权威 contract | 版本与兼容 | 验证方式 |
| --- | --- | --- | --- |
| `GET /api/sessions/:upload_id/split` | `question_split_result` | 新字段为可空扩展，不删除旧字段 | API smoke + 字段断言 |
| `GET /api/sessions/:upload_id/confirmation` | `question_confirmation_result` | 旧字段保留 nullable；E4 只写最小字段 | API smoke + 原子失败测试 |
| `GET /api/uploads/:upload_id/ocr` | E4 新增 OCR job envelope | 明确 status 集合和 attempt 字段 | 轮询到终态测试 |

## 7. OCR adapter 与探测方案

### 7.1 adapter 边界

- 使用腾讯云官方 Node SDK。
- 环境变量：

  ```text
  TENCENTCLOUD_SECRET_ID
  TENCENTCLOUD_SECRET_KEY
  TENCENTCLOUD_REGION
  TENCENT_OCR_USE_NEW_MODEL
  OCR_PROVIDER_MODE=fixture | real
  ```

- 使用 `ImageBase64` 直传，原始文件上限 7 MiB。
- fixture 和 real 必须经过同一个 normalizer/validator。
- 只持久化脱敏 metadata：provider/API version、`UseNewModel`、`RequestId`、源尺寸、必要 provider error code；不保存完整 raw response、`ImageBase64`、完整 OCR 文本或 secret。

### 7.2 fixture 模式

- `fixture` 使用仓库内合成图片和固定 OCR 结果，用于 API、事务和前端联调。
- `real` 只允许人工显式触发，不进入 CI 或自动 retry。
- 生产配置不得默认为 `fixture`。

### 7.3 终评前探测矩阵

#93 完成前，fixture、上传、job 骨架可以先实现；real adapter 字段冻结、真实 walkthrough 和 E4 收口必须等待预算确认与签名 probe。

探测至少测试：

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
UseNewModel + 展示样例图片 + vendor mapping + 字段映射
```

探测产出的原图和中间结果只放私有目录，不提交 Git。

## 8. 失败与恢复

### 8.1 job 状态

E4 OCR job 状态集合：

```text
queued -> running -> succeeded
                 \-> failed
                 \-> interrupted
```

与 E1 兼容映射：

| E1 既有 | E4 目标 |
| --- | --- |
| pending | queued |
| running | running |
| completed | succeeded |
| failed | failed |
| timeout | failed/interrupted |

`uploads.ocr_status`、OCR status endpoint 和前端使用同一套语义。

### 8.2 retry 与原子性

- retry 是同一 upload 的新 attempt；`ocr_jobs.attempt` 递增，只有 latest attempt 对外可见。
- 拒绝双击/并发重复执行：同一 upload 已有 queued/running 最新 attempt 时，retry 返回冲突。
- 只有 adapter 标准化成功后才在一个 transaction 中写 questions；失败不创建 questions/confirmations。
- 进程重启遗留的 `running` attempt 标记为 `failed/interrupted`。
- 文件系统与 SQLite 无法共用 transaction，补偿规则：
  - 文件写成但 DB 创建失败：删除孤儿文件。
  - DB 创建后 job 启动失败：保留 upload，进入可 retry 的 `failed` 状态。

## 9. 当前阶段实施映射

### 9.1 后端

- 增加 multipart 依赖并实现私有文件上传。
- 增加 magic byte、大小、MIME、路径 confinement 校验。
- 增加 OCR adapter 和 fixture adapter，共用一个 normalizer/validator。
- 增加 `exercise_ocr` job 创建、执行、状态查询、attempt 和 retry。
- 增加独立 migration 脚本和旧库升级验证。
- 扩展 split/confirmation 响应与确认保存校验。

### 9.2 前端

- 将 `/app/import` 的 `not_ready` 替换为上传入口。
- 状态流：

  ```text
  idle -> uploading -> queued/running -> ready -> saving -> saved
  ```

- 补充 invalid upload、upload failure、OCR failed + retry、save failure、刷新后恢复当前 upload 的分支。
- 显示 `已选 n/10`，第 11 题在 UI 阻止并由 API 再校验。
- 仅 OCR 缺失作答时开放答案补录，不显示 E5 的知识点/错因编辑。
- 保存成功只能在 POST 成功后显示，重复提交要禁用。

## 10. 验收与证据

### 10.1 fixture 自动验证

- fixture adapter smoke 覆盖 upload、OCR job、split、image、confirmation。
- 确认超过 10 题返回 400，且不产生部分写入。
- OCR 失败 fixture 返回 failed，且不创建 questions/confirmations。
- path traversal、伪造 MIME、缺失文件和非法 bbox 均失败。
- 未知 storage_key 或图片缺失返回 404。
- 进程重启后遗留 running attempt 变为 failed/interrupted。
- `npm run build`、`npm run validate:data` 仍通过。

### 10.2 真实 OCR 手工验证

- 在 #93 完成后，使用脱敏样本进行少量代表性探测。
- 记录探测矩阵结果和最终展示样例。
- 在 `/app/import` 手工跑通一次完整流程。

### 10.3 浏览器 walkthrough

至少覆盖：

- fixture 主路径
- 失败后 retry 恢复
- 超过 10 题拒绝且无部分写入
- 刷新后恢复当前 upload
- 图片缺失/非法 bbox
- API unavailable
- `/demo` 与 `/data` 无请求

## 11. 接受的残余与延后能力

- 多图片批量、PDF、文件管理和生产级内容安全延后。
- 多 OCR Provider 和自动重试平台延后。
- 不建设图像预处理、旋转校正或复杂后处理。
- E6 shared-password gate 和公网激活策略由 E6 完成。
- #93 未完成前不冻结 real adapter 字段，不进行真实 walkthrough 收口。

## 12. 需要 Architect 或项目负责人决定的问题

1. 原始文件上限改为 7 MiB，是否接受。
2. 确认结果最小字段改为 `selected / student_answer_text(仅OCR缺失) / note`，是否接受。
3. 增加独立 migration 脚本和旧 E1 SQLite 升级验证，是否接受。
4. OCR job 状态集合和 attempt/retry/并发控制规则，是否接受。
5. 私有图片 endpoint 的路径 confinement、magic byte、no-store 和 E6 gate 前置要求，是否接受。
6. real adapter 冻结、真实 walkthrough 和 E4 收口等待 #93，是否接受。

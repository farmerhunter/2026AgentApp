# E3 教材知识底图与扩展边界设计

Status: Proposed
Epic: E3 / GitHub Issue #87
Owner: David (LaoLiuHaHaHaHaXiao)
Updated: 2026-08-26

> 本文遵循 `docs/epic-design-guidelines.md` 与 `docs/epic-collaboration-protocol.md`。它只记录 E3 的跨模块边界、数据契约、失败处理和验收策略；实时任务与状态以 #87 和 GitHub Project 为准。

## 1. 成果与用户场景

E3 结束后，项目得到一份只读、可版本管理、可被 E4/E5 稳定引用的数学教材知识地图：

- 面向产品：E5 分析错题时，能把一道题关联到明确的知识点，而不是只输出一段没有依据的中文描述。
- 面向开发：E4 的题目确认、E5 的分析结果，都能用稳定的 `knowledge_point_id` 引用同一份知识地图。
- 面向评审：可以解释知识地图如何生成、如何抽查、如何更新，并且机器校验通过。

当前只做人教版八年级下册数学，但数据结构保留 `subject / grade / semester / publisher / map_id / map_version` 等边界，未来可以扩展教材和学科。

## 2. 范围与非目标

### 当前负责

- 在仓库内建立权威、版本化、只读的知识地图 JSON。
- 定义 `textbook_knowledge_map` 数据 contract。
- 建立最小的只读查询 API，供 E4/E5 使用。
- 在 SQLite 中保存知识地图版本 registry，不复制教材内容。
- 提供知识地图校验脚本、current 切换机制和版本说明。

### 非目标

- 不实现在线教材导入、PDF 上传、OCR、切页、进度、重试或教材管理后台。
- 不实现多学科 UI、多教材选择或知识地图编辑后台。
- 不把教材原文或大段内容复制进 SQLite。
- 不实现 E4 的 OCR、E5 的 Hermes 分析或周报生成。
- 不改变 `/demo` 和 `/app` 的展示路由。
- 不建立复制整份节点目录的 `knowledge_nodes` 内容表。

## 3. 已验证基线

以下事实来自当前仓库，不是设计假设：

- 仓库中已存在 `textbook_content_summary.contract.json`，但它是 V1 示例形状，用于旧的语文/数学 demo 摘要，不是 V2 知识地图契约。
- `src/api/db/schema.sql` 已有 14 类 E1 业务表，但不存在知识地图 registry。
- `src/api/server.js` 已注册 `sessions / findings / notes / reports` 路由，但没有知识地图路由。
- `data/` 下已有 `contracts/`、`sample_inputs/`、`sample_outputs/`，但还没有 `knowledge_maps/` 权威目录。
- `.gitignore` 已忽略 `*.pdf`、`.env`、`.env.*`、`*.key` 等敏感文件；源教材 PDF 默认不进入 Git。
- `docs/v2/architecture.md` 和 ADR-021 已把 E3 边界定义为“线下处理、仓库版本化只读 JSON、SQLite 只保存引用”。

## 4. 核心不变量

1. 知识地图 JSON 是知识内容的权威来源；SQLite 只保存版本 registry，不复制节点名称、层级、描述或排序。
2. 地图版本身份是 `(map_id, map_version)`；所有下游持久化引用至少绑定 `map_id + map_version + knowledge_point_id`。
3. 权威 JSON 文件路径带版本，版本升级不覆盖上一版本文件。
4. `knowledge_point_id` 在 V2 内稳定；废弃节点必须通过 `status` 和 `superseded_by` 表达，不允许静默删除。
5. API 只读且 fail closed：artifact 缺失、损坏、校验失败或 current 指针不一致时，不返回空成功，也不回退到 demo JSON。
6. 源教材 PDF 和加工中间产物不进入 Git；仓库只保存已脱敏、可版本化的 JSON。
7. E3 不引入 `/demo` 或 `/app` 的前端改动。

## 5. 边界和数据流

```text
合法教材来源（项目负责人确认）
  -> 人工/辅助工具整理
  -> data/knowledge_maps/<map_id>/<map_version>.json
  -> 校验脚本
  -> SQLite knowledge_map_registry 标记 current
  -> API 进程校验 artifact hash 后构建只读内存索引
  -> GET /api/knowledge-map/*

E4 题目确认：可保留 knowledge_point_ids 为空，不伪造引用
E5 错题分析：提出并写入经服务端验证的 knowledge_point_ids
```

### 5.1 目录归属

- 权威 JSON 放在 `data/knowledge_maps/<map_id>/<map_version>.json`，不放在 `src/web_ui/public/data/`，避免把 V2 产品知识地图误当成公开 demo 数据。
- contract 示例放在 `data/contracts/textbook_knowledge_map.contract.json`。
- 校验脚本放在 `src/api/scripts/validate-knowledge-map.mjs`。
- current 切换脚本放在 `src/api/scripts/promote-knowledge-map.mjs`。

### 5.2 权威 JSON 形状

顶层字段：

```json
{
  "contract": "textbook_knowledge_map",
  "contract_version": "1.0",
  "map_id": "renjiao_math_grade8_v2",
  "map_version": "1.0.0",
  "subject": "math",
  "subject_label": "数学",
  "textbook": {
    "title": "义务教育教科书 数学 八年级下册",
    "publisher": "人民教育出版社",
    "grade": "八年级",
    "semester": "下册",
    "edition": "2013 版",
    "isbn": null
  },
  "generated_by": "offline-textbook-knowledge-map",
  "generated_at": "2026-08-26T00:00:00+08:00",
  "review_status": "proposed",
  "chapters": []
}
```

章节、小节、知识点：

```json
{
  "chapter_id": "ch16_quadratic_radical",
  "chapter_number": 16,
  "title": "二次根式",
  "sections": [
    {
      "section_id": "sec_8b_ch16_1",
      "section_number": "16.1",
      "title": "二次根式",
      "knowledge_points": [
        {
          "knowledge_point_id": "kp_8b_ch16_radical_concept",
          "name": "二次根式的概念",
          "description": "识别二次根式，并理解被开方数的非负条件。",
          "prerequisite_point_ids": [],
          "coverage": "detailed",
          "status": "active",
          "superseded_by": null
        }
      ]
    }
  ]
}
```

### 5.3 覆盖策略

本设计采用“全册目录 + 重点章节细化”：

- 全册五章都建立章节、小节和知识点名称目录。
- 对演示要使用的重点章节，为知识点补充 `description` 和 `prerequisite_point_ids`。
- 未细化的节点使用 `coverage: "catalog"`；重点节点使用 `coverage: "detailed"`。

重点章节在项目负责人确认终评故事和合法教材来源前不写入最终 map。

### 5.4 ID 规则

采用可读语义 ID，并继续沿用既有 `knowledge_point_id(s)` 词汇：

```text
chapter_id        = ch<两位数>_<英文短slug>
section_id        = sec_8b_ch<两位数>_<节序号>
knowledge_point_id = kp_8b_ch<两位数>_<英文短slug>
```

例如：

```text
ch17_pythagorean_theorem
kp_8b_ch17_pythagorean_theorem
```

`knowledge_point_id` 一旦进入 JSON 即视为稳定引用，后续不因文字标题微调而改变；需要替换时使用 `status: "superseded"` 和 `superseded_by`。

## 6. API、SQLite 与 contract 映射

### 6.1 新增 SQLite registry

E3 只新增一张 registry，不复制知识地图内容：

```sql
CREATE TABLE IF NOT EXISTS knowledge_map_registry (
  map_id TEXT NOT NULL,
  map_version TEXT NOT NULL,
  subject TEXT NOT NULL,
  artifact_path TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL,
  status TEXT NOT NULL,
  textbook_title TEXT,
  publisher TEXT,
  grade TEXT,
  semester TEXT,
  edition TEXT,
  isbn TEXT,
  activated_at TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  PRIMARY KEY (map_id, map_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_current_knowledge_map
  ON knowledge_map_registry(subject)
  WHERE status = 'current';
```

registry 只描述 artifact 身份、位置、hash 和当前状态；节点名称、层级、`description` 和 `prerequisite_point_ids` 只存在于 JSON 中。

### 6.2 current pointer 与切换

- `status = 'current'` 的行是唯一 current pointer。
- 每个 `subject` 最多只能有一个 current map，由上面的部分唯一索引保证。
- `status` 的允许集合固定为 `proposed | current | superseded`。
- 切换脚本的可执行顺序：
  1. 在事务外读取新 artifact，并完成 contract 校验和 `artifact_sha256` 校验。
  2. `BEGIN IMMEDIATE`。
  3. 将同一 `subject` 的旧 `current` 降为 `superseded`。
  4. `INSERT ... ON CONFLICT(map_id, map_version) DO UPDATE` 写入新 `(map_id, map_version)` 为 `current`。
  5. `COMMIT`。
- 任一步失败则 `ROLLBACK`，旧 current 自动恢复为当前版本。
- 重复 promote 同一个 `(map_id, map_version)` 是幂等成功，不产生重复 current。
- `artifact_sha256` 只用于检测“已 promote 的版本文件后来被改写”，不用于证明教材内容正确性、安全来源或权威性。

### 6.3 只读 API

| 端点 | 作用 | 失败语义 |
| --- | --- | --- |
| `GET /api/knowledge-map/current` | 返回当前地图摘要 | 无 current、artifact 缺失/损坏/校验失败 -> 503 |
| `GET /api/knowledge-map/chapters` | 返回章节和小节目录 | 同上 -> 503 |
| `GET /api/knowledge-map/points?chapter_id=...&coverage=...` | 按章节查询知识点 | 非法参数 -> 400；无匹配 -> `[]` |
| `GET /api/knowledge-map/points/:knowledge_point_id` | 返回单个知识点详情 | 未知 ID -> 404 |

统一 envelope：

```json
{
  "contract": "textbook_knowledge_map",
  "contract_version": "1.0",
  "map_id": "renjiao_math_grade8_v2",
  "map_version": "1.0.0",
  "data": {}
}
```

API 进程启动或首次请求时从 current registry 读取 artifact path/hash，校验通过后构建只读内存索引；节点列表和详情都来自同一份已校验 artifact。

#### current summary 的最小 `data` shape

```json
{
  "map_id": "renjiao_math_grade8_v2",
  "map_version": "1.0.0",
  "subject": "math",
  "subject_label": "数学",
  "textbook": {
    "title": "义务教育教科书 数学 八年级下册",
    "publisher": "人民教育出版社",
    "grade": "八年级",
    "semester": "下册",
    "edition": "2013 版",
    "isbn": null
  },
  "chapter_count": 5,
  "knowledge_point_count": 0
}
```

#### chapter/section list 的最小 `data` shape

```json
{
  "chapters": [
    {
      "chapter_id": "ch16_quadratic_radical",
      "chapter_number": 16,
      "title": "二次根式",
      "sections": [
        {
          "section_id": "sec_8b_ch16_1",
          "section_number": "16.1",
          "title": "二次根式"
        }
      ]
    }
  ]
}
```

#### point list 的最小 `data` shape

```json
{
  "knowledge_points": [
    {
      "knowledge_point_id": "kp_8b_ch16_radical_concept",
      "name": "二次根式的概念",
      "status": "active",
      "coverage": "detailed"
    }
  ]
}
```

#### point detail 的最小 `data` shape

```json
{
  "knowledge_point_id": "kp_8b_ch16_radical_concept",
  "name": "二次根式的概念",
  "description": "识别二次根式，并理解被开方数的非负条件。",
  "prerequisite_point_ids": [],
  "chapter_id": "ch16_quadratic_radical",
  "section_id": "sec_8b_ch16_1",
  "coverage": "detailed",
  "status": "active",
  "superseded_by": null
}
```

### 6.4 接口与 contract 映射

| 接口或输出 | 权威 contract | 版本与兼容规则 | 验证方式 |
| --- | --- | --- | --- |
| `data/knowledge_maps/<map_id>/<map_version>.json` | `data/contracts/textbook_knowledge_map.contract.json` | `contract_version=1.0`；新增字段允许，删除必需字段属于破坏性变更 | `npm run validate:knowledge-map` |
| `GET /api/knowledge-map/*` | 同一份知识地图 JSON + 上述 envelope | 只读响应；字段缺失则 API 失败，不静默兜底 | API smoke test |
| `knowledge_map_registry` | 由 `promote-knowledge-map.mjs` 生成 | 只存版本身份、hash 和状态；`(map_id,map_version)` 唯一 | 切换脚本幂等 + 重启后查询 |

### 6.5 E4/E5 consumer mapping

跨 Epic 最小兼容形状固定为：

```json
{
  "knowledge_map_ref": {
    "map_id": "renjiao_math_grade8_v2",
    "map_version": "1.0.0"
  },
  "knowledge_point_ids": ["kp_8b_ch16_radical_concept"]
}
```

规则：

- 只要知识 ID 列表非空，`knowledge_map_ref` 必须存在。
- 知识 ID 为空时，`knowledge_map_ref` 可以为空或省略。
- 现有单数 `knowledge_point_id` 和复数 `related_knowledge_point_ids` 字段不改名，继续保留。
- E3 只冻结这个跨 Epic contract；具体 schema migration 由实际写入 owner 的 E4/E5 完成。

| 消费方 | `knowledge_map_ref` 所在层级 | 现有知识 ID 字段 | 何时 required | owner | 未知版本/ID 行为 |
| --- | --- | --- | --- | --- | --- |
| E4 question confirmation | confirmation 或 batch 顶层 | `knowledge_point_ids` / `knowledge_point_ids_json` | ID 列表非空时 required | E4 | E4 阶段可留空，不伪造；OCR 不生成知识点 |
| E5 finding/action | finding batch 顶层 | `concept_links`、`related_knowledge_point_ids` | 写入知识引用时 required | E5 | 写入前服务端验证 `(map_id,map_version,knowledge_point_id)`，未知则拒绝 |
| weekly report | report 或 subject 分区顶层 | `knowledge_point_id`、`related_knowledge_point_ids` | 报告出现知识引用时 required | E5 | 引用不存在时整份报告不保存 |

## 7. 失败与恢复

- 知识地图 JSON 缺失、语法错误、hash 不匹配或 contract 不合法：API 返回 `503`，错误信息说明原因；不返回空成功。
- current pointer 缺失或多个 current：API 返回 `503`，不自行猜测地图。
- `knowledge_point_id` 不存在：返回 `404`，不允许临时编造节点。
- 过滤参数非法：返回 `400`；合法但无匹配：返回 `[]`。
- current 切换失败：事务回滚，旧 current 继续可用。
- 进程重启：registry 和 JSON 都是持久化事实；API 重新校验 artifact 并重建内存索引。
- E3 不产生外部写入、费用或用户数据风险；失败只影响后续 E4/E5 查询，不影响 `/demo`。

## 8. 当前阶段实施映射

### 8.1 数据与 contract

- 新增 `data/contracts/textbook_knowledge_map.contract.json`。
- 新增 `data/knowledge_maps/renjiao_math_grade8_v2/1.0.0.json`；在 Ready condition 满足前，只提交结构占位/样例，不提交猜测目录作为最终 map。
- 源 PDF 保留在仓库外，不提交；文档记录线下生成和抽查方法。

### 8.2 API 与 SQLite

- 在 `src/api/db/schema.sql` 增加 `knowledge_map_registry` 表和 current 唯一索引。
- 新增 `src/api/scripts/validate-knowledge-map.mjs`。
- 新增 `src/api/scripts/promote-knowledge-map.mjs` 负责 current 切换。
- 新增 `src/api/routes/knowledgeMap.js`，并在 `src/api/server.js` 注册。
- 在 `src/api/package.json` 增加 `validate:knowledge-map` 脚本。

### 8.3 前端

- E3 不新增前端页面或状态组件；`/app` 当前四页继续沿用 E2 骨架。
- 前端不直接读取 `data/knowledge_maps/`；知识地图只通过 API 暴露给未来 E4/E5。

## 9. 验收与证据

### 9.1 正向验证

- `node src/api/db/init.js` 成功创建 registry 表。
- `npm run validate:knowledge-map` 通过。
- 启动 `src/api` 后：

  ```text
  GET /api/knowledge-map/current                         -> 200
  GET /api/knowledge-map/chapters                        -> 200
  GET /api/knowledge-map/points?chapter_id=ch17_...      -> 200
  GET /api/knowledge-map/points/kp_8b_ch17_...           -> 200
  ```

- 重复执行切换脚本结果幂等，current 不重复增加。
- 重启 API 后仍能查询同一份当前地图。
- `cd src/web_ui && npm run build` 仍通过；`npm run validate:data` 仍 120/120，证明 E3 不影响 demo 基线。

### 9.2 负向验证

- 重复 `knowledge_point_id`：校验失败。
- 非法 `map_version`：校验失败。
- 悬空 `prerequisite_point_ids` 或 `superseded_by`：校验失败。
- current artifact 缺失或损坏：API 返回 503。
- 存在旧 current 时切换新版本：成功，且旧 current 变为 `superseded`。
- 新版本写入失败：rollback 后旧 current 仍为 `current`。
- 重复 promote 同一版本：幂等成功，current 不重复增加。
- 非法 filter 参数：400。
- 合法但无匹配：空数组。
- 未知 `knowledge_point_id`：404。
- E4/E5 consumer fixture 使用正确 `(map_id, map_version, knowledge_point_id)` 成功；错误版本或错误 ID 被拒绝。

## 10. 接受的残余与延后能力

- 在线教材导入、PDF OCR、切页、进度和教材后台延后到 V3。
- 多教材、多学科、知识地图编辑 UI 延后到 V3。
- 知识点的完整课程大纲、例题和教师讲义不属于 V2。
- 知识地图内容仍需要一次人工抽查；抽查结果在 Epic Issue 记录，不单独建设后台。
- 不建立复制知识地图内容的 `knowledge_nodes` 表；若未来出现 JSON/内存索引无法满足的查询需求，再单独回到 Architect 讨论。

## 11. 需要 ADR 的决定

E3 暂不新增长期 ADR。ADR-021 已经覆盖“单科离线知识底图”方向；本次设计主要把 ADR-021 落实为文件、contract、registry 和只读 API。

若以后要把 `knowledge_point_id` 升级为跨教材全局 ID，或引入知识地图编辑平台，再新增 ADR。

## 12. Ready condition 与待 Architect / 项目负责人决定的问题

实际知识地图内容开始制作前，必须先满足：

1. 项目负责人提供或确认合法可用的教材来源及准确版本。
2. 项目负责人确认终评故事对应的重点两章。
3. 设计确认不在仓库保存教材原文、扫描页或加工中间文本。
4. 人工抽查范围包含来源身份、目录对应、重点知识点含义和前置引用悬空检查。

待 Architect / 项目负责人确认：

1. 重点细化章节选哪两章。
2. 源教材 PDF/文本由谁提供，并确认线下加工中间产物不提交。
3. 上述 registry + 只读 API 方案是否接受。
4. 首版 `map_version` 是否固定为 `1.0.0`。
5. 是否接受沿用 `knowledge_point_id(s)`，章节/小节使用 `chapter_id / section_id`。

# E3 教材知识底图与扩展边界设计

Status: Proposed
Epic: E3 / GitHub Issue #87
Owner: David (LaoLiuHaHaHaHaXiao)
Updated: 2026-08-26

> 本文遵循 `docs/epic-design-guidelines.md` 与 `docs/epic-collaboration-protocol.md`。它只记录 E3 的跨模块边界、数据契约、失败处理和验收策略；实时任务与状态以 #87 和 GitHub Project 为准。

## 1. 成果与用户场景

E3 结束后，项目得到一份只读、可版本管理、可被 E4/E5 稳定引用的数学教材知识地图：

- 面向产品：E5 分析错题时，能把一道题关联到明确的知识节点，而不是只输出一段没有依据的中文描述。
- 面向开发：E4 的题目确认、E5 的分析结果，都能用稳定的 `knowledge_node_id` 引用同一份知识地图。
- 面向评审：可以解释知识地图如何生成、如何抽查、如何更新，并且机器校验通过。

当前只做人教版八年级下册数学，但数据结构保留 `subject / grade / semester / publisher / map_version` 等边界，未来可以扩展教材和学科。

## 2. 范围与非目标

### 当前负责

- 在仓库内建立权威知识地图 JSON。
- 定义 `textbook_knowledge_map` 数据 contract。
- 建立最小的只读查询 API，供 E4/E5 使用。
- 在 SQLite 中保存地图版本、章节和知识节点引用，不保存教材全文。
- 提供知识地图校验脚本、种子写入和版本说明。

### 非目标

- 不实现在线教材导入、PDF 上传、OCR、切页、进度、重试或教材管理后台。
- 不实现多学科 UI、多教材选择或知识地图编辑后台。
- 不把教材原文或大段内容复制进 SQLite。
- 不实现 E4 的 OCR、E5 的 Hermes 分析或周报生成。
- 不改变 `/demo` 和 `/app` 的展示路由。

## 3. 已验证基线

以下事实来自当前仓库，不是设计假设：

- 仓库中已存在 `textbook_content_summary.contract.json`，但它是 V1 示例形状，用于旧的语文/数学 demo 摘要，不是 V2 知识地图契约。
- `src/api/db/schema.sql` 已有 14 类 E1 业务表，但不存在 `knowledge_maps` 或 `knowledge_nodes`。
- `src/api/server.js` 已注册 `sessions / findings / notes / reports` 路由，但没有知识地图路由。
- `data/` 下已有 `contracts/`、`sample_inputs/`、`sample_outputs/`，但还没有 `knowledge_maps/` 权威目录。
- `.gitignore` 已忽略 `*.pdf`、`.env`、`.env.*`、`*.key` 等敏感文件；源教材 PDF 默认不进入 Git。
- `docs/v2/architecture.md` 和 ADR-021 已把 E3 边界定义为“线下处理、仓库版本化只读 JSON、SQLite 只保存引用”。

## 4. 核心不变量

1. 知识地图 JSON 是知识内容的权威来源；SQLite 只保存版本、章节和节点引用，不复制教材正文。
2. `knowledge_node_id` 在 V2 内稳定且唯一；内容更新时保留旧 ID，新增或废弃节点也必须可追踪。
3. 所有知识地图 API 只读，不提供创建、修改或删除端点。
4. 源教材 PDF 和加工中间产物不进入 Git；仓库只保存已脱敏、可版本化的 JSON。
5. E3 不引入 `/demo` 或 `/app` 的前端改动，也不让 API 失败时回退到 demo JSON。

## 5. 边界和数据流

```text
离线教材 PDF / 文本
  -> 人工/辅助工具整理
  -> data/knowledge_maps/<map_id>.json
  -> 校验脚本
  -> SQLite knowledge_maps / knowledge_nodes
  -> GET /api/knowledge-map/*

E4 题目确认：只引用 knowledge_node_id
E5 错题分析：通过 API 查询知识节点
```

### 5.1 目录归属

- 权威 JSON 放在 `data/knowledge_maps/`，不放在 `src/web_ui/public/data/`，避免把 V2 产品知识地图误当成公开 demo 数据。
- contract 示例放在 `data/contracts/textbook_knowledge_map.contract.json`。
- 校验脚本放在 `src/api/scripts/validate-knowledge-map.mjs`。

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
  "grade": "八年级",
  "semester": "下册",
  "publisher": "人教版",
  "source_type": "offline_textbook",
  "source_ref": null,
  "generated_by": "offline-textbook-knowledge-map",
  "generated_at": "2026-08-26T00:00:00+08:00",
  "review_status": "proposed",
  "chapters": []
}
```

章节、小节、知识节点：

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
      "knowledge_nodes": [
        {
          "knowledge_node_id": "kp_8b_ch16_radical_concept",
          "name": "二次根式的概念",
          "description": "识别二次根式，并理解被开方数的非负条件。",
          "prerequisite_node_ids": [],
          "depth": "detailed"
        }
      ]
    }
  ]
}
```

### 5.3 覆盖策略

本设计采用“全册目录 + 重点章节细化”：

- 全册五章都建立章节、小节和知识节点名称目录。
- 对演示要使用的重点章节，为知识节点补充 `description` 和 `prerequisite_node_ids`。
- 未细化的节点使用 `depth: "catalog"`；重点节点使用 `depth: "detailed"`。

当前重点章节待项目负责人结合终评故事确定，设计阶段暂不锁定。

### 5.4 ID 规则

采用可读语义 ID：

```text
chapter_id   = ch<两位数>_<英文短slug>
section_id   = sec_8b_ch<两位数>_<节序号>
knowledge_node_id = kp_8b_ch<两位数>_<英文短slug>
```

例如：

```text
ch17_pythagorean_theorem
kp_8b_ch17_pythagorean_theorem
```

ID 一旦进入 JSON 即视为稳定引用，后续不因文字标题微调而改变。

## 6. API、SQLite 与 contract 映射

### 6.1 新增 SQLite 表

```sql
CREATE TABLE IF NOT EXISTS knowledge_maps (
  map_id TEXT PRIMARY KEY,
  map_version TEXT NOT NULL,
  subject TEXT NOT NULL,
  subject_label TEXT,
  grade TEXT,
  semester TEXT,
  publisher TEXT,
  file_path TEXT,
  status TEXT DEFAULT 'proposed',
  reviewed_at TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS knowledge_nodes (
  knowledge_node_id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  map_version TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  section_id TEXT,
  parent_node_id TEXT,
  name TEXT NOT NULL,
  node_type TEXT DEFAULT 'knowledge_point',
  depth TEXT DEFAULT 'catalog',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_kn_map ON knowledge_nodes(map_id, map_version);
CREATE INDEX IF NOT EXISTS idx_kn_chapter ON knowledge_nodes(chapter_id);
```

说明：`description` 和 `prerequisite_node_ids` 保留在 JSON 中，不复制进 SQLite；SQLite 只保存节点注册表，便于按章节/版本查询。

### 6.2 只读 API

| 端点 | 作用 | 失败语义 |
| --- | --- | --- |
| `GET /api/knowledge-map/current` | 返回当前 map 摘要 | 地图不存在或未标记 current -> 503 |
| `GET /api/knowledge-map/chapters` | 返回章节和小节目录 | 地图不存在 -> 503 |
| `GET /api/knowledge-map/nodes?chapter_id=...&depth=...` | 按章节查询节点注册表 | 空结果 -> `[]` |
| `GET /api/knowledge-map/nodes/:node_id` | 返回单个节点详情，含 JSON 中的描述/前置关系 | 未知节点 -> 404 |

响应采用稳定的 JSON envelope：

```json
{
  "contract": "textbook_knowledge_map",
  "contract_version": "1.0",
  "map_id": "renjiao_math_grade8_v2",
  "map_version": "1.0.0",
  "data": {}
}
```

### 6.3 接口与 contract 映射

| 接口或输出 | 权威 contract | 版本与兼容规则 | 验证方式 |
| --- | --- | --- | --- |
| `data/knowledge_maps/<map_id>.json` | `data/contracts/textbook_knowledge_map.contract.json` | `contract_version=1.0`；新增字段允许，删除必需字段属于破坏性变更 | `npm run validate:knowledge-map` |
| `GET /api/knowledge-map/*` | 同一份知识地图 JSON + 上述 envelope | 只读响应；字段缺失则 API 失败，不静默兜底 | API smoke test |
| `knowledge_maps` / `knowledge_nodes` 表 | 由 JSON 种子生成 | 只存引用，不复制描述；`map_id`/`node_id` 唯一 | seed 幂等 + 重启后查询 |

## 7. 失败与恢复

- 知识地图 JSON 缺失、语法错误或 contract 不合法：API 返回 `503`，错误信息说明原因；不返回空成功。
- `knowledge_node_id` 不存在：返回 `404`，不允许临时编造节点。
- 种子写入失败：在一个事务中写入 `knowledge_maps` 和 `knowledge_nodes`；失败不留下半套当前地图。
- 进程重启：数据库重建后，只要重新执行 seed 脚本即可恢复引用表；知识内容仍以 JSON 为准。
- E3 不产生外部写入、费用或用户数据风险；失败只影响后续 E4/E5 查询，不影响 `/demo`。

## 8. 当前阶段实施映射

### 8.1 数据与 contract

- 新增 `data/contracts/textbook_knowledge_map.contract.json`。
- 新增 `data/knowledge_maps/renjiao_math_grade8_v2.json`，先建立全册目录，再对确认后的重点章节补 `detailed` 内容。
- 源 PDF 保留在仓库外，不提交；文档记录线下生成和抽查方法。

### 8.2 API 与 SQLite

- 在 `src/api/db/schema.sql` 增加 `knowledge_maps` 和 `knowledge_nodes` 表。
- 在 `src/api/db/seed.js` 或独立 `seed-knowledge-map.js` 增加幂等种子逻辑。
- 新增 `src/api/routes/knowledgeMap.js`，并在 `src/api/server.js` 注册。
- 在 `src/api/package.json` 增加 `validate:knowledge-map` 脚本。

### 8.3 前端

- E3 不新增前端页面或状态组件；`/app` 当前四页继续沿用 E2 骨架。
- 前端不直接读取 `data/knowledge_maps/`；知识地图只通过 API 暴露给未来 E4/E5。

## 9. 验收与证据

- `node src/api/db/init.js` 成功创建新增表。
- `npm run validate:knowledge-map` 通过，校验 JSON 结构、ID 唯一性、必需字段和禁止本地绝对路径。
- 启动 `src/api` 后：

  ```text
  GET /api/knowledge-map/current          -> 200
  GET /api/knowledge-map/chapters         -> 200
  GET /api/knowledge-map/nodes            -> 200
  GET /api/knowledge-map/nodes/未知id      -> 404
  ```

- 种子脚本重复执行结果幂等，节点数量不重复增加。
- 重启 API 后仍能查询同一份知识地图。
- `cd src/web_ui && npm run build` 仍通过；`npm run validate:data` 仍 120/120，证明 E3 不影响 demo 基线。

## 10. 接受的残余与延后能力

- 在线教材导入、PDF OCR、切页、进度和教材后台延后到 V3。
- 多教材、多学科、知识地图编辑 UI 延后到 V3。
- 知识节点的完整课程大纲、例题和教师讲义不属于 V2。
- 知识地图内容仍需要一次人工抽查；抽查结果在 Epic Issue 记录，不单独建设后台。

## 11. 需要 ADR 的决定

E3 暂不新增长期 ADR。ADR-021 已经覆盖“单科离线知识底图”方向；本次设计主要把 ADR-021 落实为文件、contract、SQLite 和只读 API。

若以后要把 `knowledge_node_id` 升级为跨教材全局 ID，或引入知识地图编辑平台，再新增 ADR。

## 12. 需要 Architect 或项目负责人决定的问题

1. 重点细化章节选哪两章：需和终评故事、E5 示例错题一起确定；当前提案只确定“全册目录 + 重点章节细化”的机制。
2. 源教材 PDF/文本由谁提供，线下加工完成后是否只保留 JSON、不提交任何中间产物。
3. API 端点是否采用 `GET /api/knowledge-map/*` 这一组最小只读接口；是否还需要 `GET /api/knowledge-map/nodes/:node_id`。
4. `map_version` 首版是否固定为 `1.0.0`，后续内容修订是否必须递增版本。
5. 知识节点粒度的最终确认：是否以“节”为父级，以“可被错题引用的知识点”为叶子节点。

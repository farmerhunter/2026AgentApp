# E2 双线入口与稳定真实工作台设计

Status: Implementing
Epic: E2 / GitHub Issue #68
Owner: David (LaoLiuHaHaHaHaXiao)
Updated: 2026-08-25

> 本文遵循 `docs/epic-design-guidelines.md` 与 `docs/epic-collaboration-protocol.md`。它只记录 E2 的跨模块边界、关键取舍、失败处理和验收策略；实时任务与状态以 #68 和 GitHub Project 为准。

## 1. 成果与用户场景

E2 结束后，评审和开发者在同一前端代码库中能清楚区分两条互不混用的展示线：

- `/demo`：V1 静态完整流程，只读、脱敏，不依赖 API、OCR 或 Hermes。
- `/app`：V2 真实能力主线，只通过 API 读写；外部能力未接入时明确显示 loading、empty、not_ready、failed 或 saved，不静默读取 demo JSON。

真实能力尚未接入的四页工作台先稳定下来：

1. 本周概览
2. 练习导入与确认
3. 分析与记忆
4. 周报与打印

E4 的 OCR、E5 的 Hermes 后续只需填入对应 ViewModel 和交互槽位，不必再重排页面主结构。

## 2. 范围与非目标

### 当前负责

- 建立 `/demo` 与 `/app` 路由和数据访问边界。
- 保留并冻结 V1 的 `/demo` 页面行为。
- 建立 `/app` 四页 UI 骨架和统一状态组件。
- 为 E4/E5 预留数据模型、页面槽位和 API 客户端入口。
- 确保 `/app` 在 API 不可用或尚未实现时显式失败，不 fallback 到 `/data`。

### 非目标

- 不实现 OCR、Hermes Skill、腾讯 SDK、周报生成算法或 VPS systemd/Nginx 部署。
- 不在 `/app` 中接 V1 静态数据作为成功结果。
- 不建设多用户、权限系统、客户端展示密码或生产级设计系统。
- 不决定 E4/E5 的具体知识故事和展示数据。

## 3. 已验证基线

以下事实来自当前代码，不是设计假设：

- `src/web_ui/` 是单个 Vite + React 应用，当前没有路径路由；`App.jsx` 用 `useState` 在 5 个 view 间切换。
- 当前静态数据读取集中在 `src/web_ui/src/lib/api.js`，包含 `/data` 读取与 Hermes job API 调用。
- E1 已提供 `/api/sessions`、`/api/findings`、`/api/memories`、`/api/notes`、`/api/reports` 和 Hermes job 端点。
- `src/web_ui/scripts/validate-demo-data.mjs` 是 V1 demo 数据校验入口。
- Vite 当前没有 `react-router-dom` 依赖。

## 4. 核心不变量

1. `/demo` 是 static-only 路线，只读取 `/data`，不提供任何可触达 `/api` 的交互。
2. `/app` 只读取 `/api`，不读取 `/data`；失败时返回明确错误状态。
3. 两条线可以复用视觉组件和布局，但不能共享可变数据源或写入逻辑。
4. E2 不实现 OCR、Hermes 或部署；对应位置只保留明确的 `not_ready` 状态。
5. 四页主流程在 E2 冻结后，后续 Epic 只补充数据和交互，不随意改变页面主结构。

## 5. 边界和数据流

```text
浏览器
  -> /demo
       -> demoApi
       -> /data 静态 JSON

浏览器
  -> /app
       -> appApi
       -> /api REST
       -> E1 SQLite / 私有文件
```

### 5.1 数据 transport 边界

E2 将现有 `api.js` 拆成两个互不 import 的模块：

- `src/web_ui/src/lib/demoApi.js`：只允许请求 `/data/*`。
- `src/web_ui/src/lib/appApi.js`：只允许请求 `/api/*`，并抛出可区分的 `ApiUnavailableError`。

禁止 app transport 用 `null`、fixture 或静态 JSON 伪装 API 成功。demo transport 不得 import app transport，反之亦然。

### 5.2 app API base 约定

- 应用代码默认使用相对路径 `/api`，由 `VITE_APP_API_BASE_URL` 覆盖。
- 本地开发由 Vite dev proxy 将 `/api` 转发到 `http://localhost:8000`；该 proxy 只在开发配置中生效。
- 生产同源部署由 E6 的 Nginx 完成 `/api` 代理，E2 不实现生产 proxy，也不把生产默认写死为 `http://localhost:8000`。

### 5.3 路由策略

采用单一 Vite 应用 + `react-router-dom`：

- `/demo/*`：挂载现有 V1 view 树。
- `/app`：重定向到 `/app/overview`。
- `/app/overview`：本周概览。
- `/app/import`：练习导入与确认。
- `/app/analysis`：分析与记忆。
- `/app/report`：周报与打印。
- 未知路径返回应用内明确的 `not_found` 状态，不渲染成 demo 内容。

理由：避免维护两套 Vite 构建和部署链；Nginx 在 E6 只需要统一 SPA fallback 和两条路径前缀规则。

## 6. 当前阶段实施映射

### 6.1 Demo 线冻结

- 将现有 V1 view、`Navigation` 和 demo 数据读取逻辑归入 `/demo` 路径。
- 保持当前视觉和行为，不在此次改造中重做 demo 页面。
- `/demo` 必须 static-only：移除 `HermesModeSwitch`，或将其替换为不可交互的“静态演示模式”标识；任何用户路径都不得发起 `/api`。
- `HermesModeSwitch` 不得出现在 `/app`。

### 6.2 App 四页与 E1 endpoint 映射

| 页面 | 路径 | E2 允许读取的 E1 endpoint | 当前能力状态 | 不得在本 Epic 调用 |
| --- | --- | --- | --- | --- |
| 本周概览 | `/app/overview` | `GET /api/sessions`、`GET /api/findings`、`GET /api/memories`、`GET /api/reports` | 数据已由 E1 提供；无数据时 `empty` | OCR、Hermes job |
| 练习导入与确认 | `/app/import` | `GET /api/sessions`、`GET /api/sessions/:upload_id/split`、`GET /api/sessions/:upload_id/confirmation` | E4 未交付，显示 `not_ready`；已有 session 可读取 | 伪造上传、伪造 OCR 成功 |
| 分析与记忆 | `/app/analysis` | `GET /api/findings`、`GET /api/findings/:batch_id`、`GET /api/memories` | E5 未交付，显示 `not_ready`；已有 E1 数据可读取 | 伪造 Hermes 分析结果 |
| 周报与打印 | `/app/report` | `GET /api/reports`、`GET /api/reports/:report_id` | 只显示 API 返回的 report；无数据显示 `empty` | 读取 `/data/week_reports/*` |

### 6.3 四页最小 ViewModel 与状态组合规则

#### Overview

- 页面 ViewModel：

  ```text
  OverviewViewModel {
    session_count
    recent_sessions: SessionSummary[]
    finding_batch_count
    accepted_memory_count
    latest_report: ReportSummary | null
  }
  ```

- 数据来源：
  - `GET /api/sessions` -> `session_count`、`recent_sessions`
  - `GET /api/findings` -> `finding_batch_count`
  - `GET /api/memories?status=accepted` -> `accepted_memory_count`
  - `GET /api/reports` -> `latest_report`
- 规则：
  - 任一接口非 2xx 时页面进入 `failed`。
  - 所有接口成功但汇总字段均为零/空时进入 `empty`。
  - E4/E5 尚未交付不影响 overview；它只展示 E1 已有数据。

#### Import

- 页面 ViewModel：

  ```text
  ImportViewModel {
    sessions: SessionSummary[]
    selected_session_id: string | null
    selected_split: QuestionSplitResult | null
    selected_confirmation: QuestionConfirmationResult | null
    import_action_state: not_ready | ready
  }
  ```

- 数据来源：
  - `GET /api/sessions`
  - `GET /api/sessions/:upload_id/split`
  - `GET /api/sessions/:upload_id/confirmation`
- 规则：
  - E1 已有 session 可列出；选中 session 后可读取 split/confirmation。
  - E4 的真实上传/OCR 动作未交付，`import_action_state = not_ready`，页面显示 `NotReadyState`，不得伪造上传成功。
  - `saved` 只有在 E4 后续调用真实上传/OCR API 并返回成功后出现，E2 不触发该写入。

#### Analysis

- 页面 ViewModel：

  ```text
  AnalysisViewModel {
    finding_batches: FindingBatchSummary[]
    selected_batch_id: string | null
    selected_findings: Finding[]
    memories: MemoryDecision[]
    analysis_action_state: not_ready | ready
  }
  ```

- 数据来源：
  - `GET /api/findings`
  - `GET /api/findings/:batch_id`
  - `GET /api/memories`
- 规则：
  - E1 已有 finding/memory 可显示。
  - E5 的真实 Hermes 生成动作未交付，`analysis_action_state = not_ready`，显示 `NotReadyState`，不得伪造 Hermes 分析。
  - `saved` 只在 E5 后续真实分析成功写入后出现。

#### Report

- 页面 ViewModel：

  ```text
  ReportViewModel {
    reports: ReportSummary[]
    selected_report_id: string | null
    selected_report: WeeklyReport | null
    printable: boolean
  }
  ```

- 数据来源：
  - `GET /api/reports`
  - `GET /api/reports/:report_id`
- 规则：
  - 只读取 API 返回的 report；`/data/week_reports/*` 被禁止。
  - API 成功且 reports 为空时进入 `empty`。
  - `printable = selected_report !== null`；只有加载到真实 report 后才允许打印。

### 6.4 统一状态语义

- `loading`：已发出 app API 请求，尚未完成。
- `empty`：API 成功，但没有领域数据。
- `not_ready`：E4/E5 尚未交付的能力，且不创建假数据。
- `failed`：网络、timeout 或非 2xx；保留用户已输入但未成功提交的内容，不读取 `/data` 回退。
- `saved`：只有现有 API 已确认写入时才出现；E2 若不引入写入动作，不得用 demo 状态模拟 saved。

### 6.5 共享状态组件

复用现有 `DataState`，并补充：

- `ApiUnavailableState`：仅在 `/app` 使用，显示真实错误，不 fallback。
- `SavedState`：表示 API 写入已成功。
- `EmptyState`：API/能力已可用，但查询结果为空。
- `NotReadyState`：依赖的 E4/E5 能力尚未交付。

页面级状态优先级：

```text
loading
  -> failed（任一必要请求非 2xx）
  -> not_ready（能力未交付）
  -> empty（能力已可用但无数据）
  -> ready（存在可展示数据）
```

`saved` 不是页面级初始状态，只在真实 API 写入成功后作为区块反馈出现。

## 7. 失败与恢复

- `/app` API 不可用：页面显示 `failed` 状态和重试入口，不读取 `/data`。
- `/app` 未实现的 E4/E5 模块：显示明确的 `not_ready` placeholder，不伪装为成功。
- `/demo` 外部服务完全不可用：仍然可用，因为只依赖静态文件。
- 写入失败：保留当前表单内容，显示保存失败；不自动清空或部分提交。

## 8. 验收与证据

- `cd src/web_ui && npm run build` 通过。
- `cd src/web_ui && npm run validate:data` 仍 120/120。
- 本地启动前端：
  - 打开 `/demo`，完成 V1 主要页面浏览，浏览器 Network 无 `/api` 请求，且没有可切换 API mode 的交互。
  - 打开 `/app`，浏览器 Network 无 `/data` 请求。
  - 关闭 API 后，`/app` 显示 `failed` 或 `not_ready`，不是 V1 内容。
- 手工检查 `/app` 四页均可导航，URL 可刷新、可分享。

## 9. 接受的残余与延后能力

- Nginx 路径规则和真实 `/app` API 代理在 E6 完成。
- OCR、Hermes、真实周报生成分别由 E4/E5 完成。
- 访问控制由 E6 Nginx/部署决定，E2 不实现客户端密码或伪认证。
- `react-router-dom` 是否引入属于低风险实现选择，Architect Gate 已接受单应用双路由方向。

## 10. 需要 Architect 或项目负责人决定的问题

1. 单 Vite 应用 + 双路由树：已接受。
2. `/demo` 必须 static-only：移除或禁用 `HermesModeSwitch`，`/app` 不出现该组件：已接受。
3. 客户端共享密码：已拒绝，改由 E6 部署层处理。
4. 四页命名与默认路由：接受 `/app/overview`、`/app/import`、`/app/analysis`、`/app/report`，`/app` 默认进入 overview。

## 11. 需要 ADR 的决定

E2 暂不新增长期 ADR。若“单应用双路由 vs 双应用构建”或“访问控制策略”在 E6 后成为长期部署约束，再提炼为 ADR。

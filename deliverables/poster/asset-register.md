# 展板素材登记表

| 素材 | 当前用途 | 来源与权利状态 | 当前状态 | 后续动作 |
| --- | --- | --- | --- | --- |
| 模拟练习 A 图片 | 展示第一次练习及错误线索 | 本项目原创合成练习，不含真实学生信息 | 最终采用 | 已核对题面与展示结果 |
| 模拟练习 B 图片 | 展示第二次练习及作答变化 | 本项目原创合成练习，不含真实学生信息 | 最终采用 | 已核对题面与展示结果 |
| 流程箭头和几何图标 | 表达作品流程与结果分类 | 在 SVG 中自行绘制 | 最终采用 | 已固化到送印 PNG |
| 系统架构图 | 说明作品边界与智能体流程 | 本项目生成并维护的架构视觉资产 | 最终采用 | 已固化到送印 PNG |
| 导入与确认界面截图 | 关键程序截图 1 | `main@3ccefce` Web UI；原创 A 卷和隔离回放 DB | 最终采用 | 保留原始图和展板裁切图 |
| 分析与记忆界面截图 | 关键程序截图 2 | `main@3ccefce` Web UI；已验收 A/B Hermes 输出回放 | 最终采用 | 展板图由同页两段未改内容组合，见裁切清单 |
| 学习周报界面截图 | 关键程序截图 3 | `main@3ccefce` Web UI；已验收周报输出回放 | 最终采用 | 保留原始图和展板裁切图 |
| 公开体验地址 | 现场体验入口 | 项目公开地址 `jingyun.bj.cn` | 最终采用 | 使用文字地址，不加入二维码 |
| 字体 | 全板文字 | 使用本机系统中文无衬线字体回退，不分发字体文件 | 最终采用 | 字形已栅格化到送印 PNG |
| 活动统一标识 | 标题区（如要求） | 未使用 | 最终省略 | 不引入来源未确认的标识 |

## 原始文件

- 模拟练习 A 原始文件：`experiments/hermes-quality/two-batch-learning-fixture/worksheet-a-v1.png`
- 模拟练习 B 原始文件：`experiments/hermes-quality/two-batch-learning-fixture/worksheet-b-v1.png`
- 展板交付副本：`deliverables/poster/assets/worksheet-a-v1.png`、`worksheet-b-v1.png`
- 三张原始程序截图：`deliverables/poster/assets/screenshots/*-full.png`
- 三张展板裁切图：`deliverables/poster/assets/screenshots/*-poster.png`
- 浏览器核验清单：`deliverables/poster/assets/screenshots/capture-manifest.json`
- 裁切方式清单：`deliverables/poster/assets/screenshots/crop-manifest.json`

## 使用原则

- 展板不放源代码、终端日志、GitHub Issue/PR 截图或无法说明来源的网络图片。
- 截图只保留能支撑主线的界面，并遮盖任何账号、地址、令牌或真实个人信息。
- 对实践结果只描述当前材料能够支持的现象，不扩展成准确率、普遍效果或成绩提升声明。
- 阶段 B 截图属于“已验收结果回放”：没有新增 OCR/Hermes 调用，不把回放时间写成新的实验时间。

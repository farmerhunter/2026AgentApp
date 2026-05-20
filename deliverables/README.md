# 比赛交付物目录

本目录用于集中管理“AI 智能体应用”比赛最终提交材料。比赛要求以
[`design_docs/01_competition_rules.md`](../design_docs/01_competition_rules.md) 为准；本目录只保存可公开提交或可公开说明的材料，不保存真实学生隐私数据、账号密码、未脱敏原始试卷或私人报名信息。

## 目录结构

建议按以下结构准备材料：

```text
deliverables/
  README.md
  submission_checklist.md
  docs/
    technical_document.md
    agent_description.md
  video_assets/
    demo_script.md
    shot_list.md
    raw_clips/
  final_submission/
    work_name.md
    public_link.md
    creator_statement.md
    final_video.mp4
    final_report.pdf
```

说明：

- `docs/`：放技术文档、智能体说明等可版本管理的文字稿。
- `video_assets/`：放演示脚本、镜头清单和视频制作说明；大型视频素材不要提交到 Git。
- `final_submission/`：放最终提交版本或提交入口需要填写的信息。大型 MP4/PDF 可能被 `.gitignore` 忽略，应保存在本机、VPS 私有目录或比赛提交系统中。
- `submission_checklist.md`：提交前逐项核对，避免遗漏作品链接、视频时长、创作者声明和隐私合规。

## 最终提交材料

根据比赛指南，本项目至少需要准备：

1. 作品名称。
2. 技术文档。
3. 智能体说明。
4. MP4 演示视频，时长不超过 2 分钟。
5. 已公开发布且可访问的作品链接。
6. 《创作者声明》。

## 使用规则

- 所有示例数据必须脱敏，只使用虚构学生、虚构题目和虚构学习记录。
- 如需记录真实报名信息或私人联系方式，应放在本机私有目录，不进入 Git 仓库。
- 提交前必须按 `submission_checklist.md` 完成核对。

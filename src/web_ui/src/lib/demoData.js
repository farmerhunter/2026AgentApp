export const studentSnapshot = {
  displayName: "Demo Student",
  status: "本周学习进行中",
};

export const navigationItems = [
  {
    id: "results",
    label: "学习成果",
    description: "上传作业试卷，进入重点题确认",
  },
  {
    id: "notes",
    label: "输入备注",
    description: "记录课堂提醒和自己的疑问",
  },
  {
    id: "reports",
    label: "历史周报",
    description: "查看阶段分析和下周行动",
  },
  {
    id: "content",
    label: "学习内容",
    description: "理解教材章节并比对进度",
  },
];

export const learningResultSteps = [
  {
    step: "01",
    title: "上传材料",
    description: "上传试卷、作业、练习册或错题本图片，记录学科、日期和来源。",
  },
  {
    step: "02",
    title: "自动切题",
    description: "后续接入 Tencent QuestionSplitOCR，展示题目框、识别文字和切题列表。",
  },
  {
    step: "03",
    title: "确认重点题",
    description: "学生选择需要记录的题，补充得分、错因、知识点、备注和优先级。",
  },
];

export const recentUploads = [
  {
    id: "upload_20260518_001",
    title: "反比例函数课堂练习示例页",
    subject: "数学",
    type: "试卷页",
    date: "2026-05-18",
    status: "等待确认",
  },
  {
    id: "upload_20260517_001",
    title: "函数图像作业摘录",
    subject: "数学",
    type: "作业",
    date: "2026-05-17",
    status: "已记录",
  },
];

export const weeklyReportPreview = {
  week: "2026-05-18 至 2026-05-24",
  title: "本周学习状况分析",
  summary:
    "本周重点关注反比例函数图像与象限判断。学生能够识别题目条件，但 k 的正负与图像象限关系仍需专项巩固。",
  metrics: [
    { label: "上传材料", value: "2" },
    { label: "重点题", value: "3" },
    { label: "下周行动", value: "4" },
  ],
};

export const contentCards = [
  {
    kicker: "Textbook",
    title: "课本 PDF 理解",
    description: "提取章节、学习单元和知识点，为后续进度比对建立上下文。",
  },
  {
    kicker: "Progress",
    title: "学习进度比对",
    description: "把作业、试卷和备注关联到对应章节，判断已覆盖内容和薄弱点。",
  },
  {
    kicker: "Memory",
    title: "Hermes 记忆更新",
    description: "把确认后的重点题和备注沉淀为可追踪的学习记忆。",
  },
];

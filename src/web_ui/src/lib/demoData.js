export const studentSnapshot = {
  displayName: "小明",
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

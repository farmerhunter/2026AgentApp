# 带批改试卷的图片生成记录

状态：内置 image_gen 两次请求均网络失败，没有获得图片文件。文字稿是内容权威，图片须逐题核对后才能用于上传测试。图片生成不等于 OCR 或 Hermes 验证通过。

## 2026-08-31 实际尝试

- A 卷首次请求失败；同一提示词重试一次，仍失败。错误均为 `image generation failed: network error: error sending request for url (https://chatgpt.com/backend-api/codex/images/generations)`。
- 没有可检查或保存的图片，不能声称完成 A 卷样张、可上传文件或切题验证。
- B 卷按“先验证 A 再复用版式”的顺序尚未请求。
- 没有切换 CLI/API 后备路径，没有使用或索要额外 API Key，也没有把 HTML/SVG/PDF 冒充已生成的试卷照片。后备路径或改用可打印文档需用户选择。
- 以下保存实际提交的完整 A 卷提示词，供服务恢复或用户选择后续方式后复用；不是图片产物。

## A 卷首稿提示词

````text
Use case: scientific-educational. Asset: one high-resolution portrait photo-scan of a single Chinese middle-school mathematics practice paper for OCR/question-segmentation testing.
Create a realistic completed-and-graded paper, full page visible, portrait A4 proportions, nearly orthogonal overhead view, bright neutral illumination, very slight natural paper texture. Paper almost fills image. No props, hands, names, school logos, watermarks, harsh shadows or blur.
Layout: clean Chinese exercise-book typography in black, centered title, compact header, two columns with a generous clear gutter; left column questions 1–8 (choice then fill), right column questions 9–10 with working space. A small grading summary/footer and a blank correction box fit below. Font and mathematical radicals/fractions must be large and legible. Use proper math typesetting for printed expressions and realistically handwritten forms for answers. Do not let annotation marks cross the gutter or cover printed text or student working.
Three distinct layers: PRINTED black question statements/options; STUDENT blue-black slightly irregular handwriting exactly as supplied (including intentional mathematical errors); TEACHER red pen ticks/crosses/partial-credit triangles, small scores and only the short phrase 订正. Do not correct the student's wrong results. Do not add reasoning or explanatory teacher text not specified.
Exact visible header: 八年级数学综合练习 A / 第16章 二次根式 · 第19章 一次函数 / 建议用时25分钟 · 每题5分 · 满分50分. Red handwritten total 39/50.
Footer printed small: 仿真练习 · 非真实学生记录. Red grading summary: 选择20/20　填空15/20　解答4/10. Red note: 请订正第6、9、10题，保留原作答。 Printed labels 订正区 with BLANK area, 首次批改，待订正. Do not fabricate dates/signatures/finished corrections.
SOURCE below is authoritative for all 10 questions, printed choices, blue handwritten answers/work, and red grading. Strip markdown and metadata, use question numbers 1–10 only, not A01 labels. Do NOT print instruction strings such as 学生作答：/纸上演算：/教师红笔：/制图说明 or provenance paragraphs; render their CONTENT in its appropriate visual layer. Teacher note descriptions like 不代写... are constraints, not image text. Section headings 一、选择题 二、填空题 三、解答题 as supplied. Preserve EVERY question and answer, no additions or omissions, no rewrites of mathematical signs.
# 八年级数学综合练习 A

范围：第 16 章二次根式、第 19 章一次函数。建议用时：25 分钟。

材料属性：原创仿真练习，包含模拟学生作答与模拟教师批改，不是真实学生或教师记录。编号 A01–A10 仅用于材料对应，排版时显示为第 1–10 题。不附标准答案或详细错因分析。

卷首批改栏（模拟红笔）：得分 **39 / 50**；每题 5 分。首次批改，待订正。

制图说明：题干为印刷黑字，学生作答为黑/蓝笔，教师批改为红笔。下面的“教师红笔”文字说明用于制作痕迹，不整段印在试卷上；✓ 表示正确，× 表示错误，△ 表示部分正确。学生原始作答保持不变。

## 一、选择题（每题只有一个正确选项）

### A01｜第 1 题

式子 √(x－2) 在实数范围内有意义，则 x 的取值范围是（　）。

- A. x＞2
- B. x≥2
- C. x≤2
- D. x≠2

学生作答：B。

教师红笔：答案右侧 ✓；5/5。

### A02｜第 2 题

下列二次根式中，是最简二次根式的是（　）。

- A. √12
- B. √(1/2)
- C. √7
- D. √18

学生作答：C。

教师红笔：答案右侧 ✓；5/5。

### A03｜第 3 题

对于一次函数 y＝－2x＋3，下列说法正确的是（　）。

- A. y 随 x 的增大而增大
- B. y 随 x 的增大而减小
- C. y 的值始终为 3
- D. 无法判断 y 随 x 的变化情况

学生作答：B。

教师红笔：答案右侧 ✓；5/5。

### A04｜第 4 题

下列各点中，在直线 y＝2x＋1 上的是（　）。

- A. (1，2)
- B. (1，3)
- C. (2，3)
- D. (0，0)

学生作答：B。

教师红笔：答案右侧 ✓；5/5。

## 二、填空题

### A05｜第 5 题

化简：√50＝________。

学生作答：5√2。

纸上演算：√50＝√(25×2)＝5√2。

教师红笔：答案右侧 ✓；5/5。

### A06｜第 6 题

计算：√18＋√8＝________。

学生作答：√26。

纸上演算：√18＋√8＝√(18＋8)＝√26。

教师红笔：答案右侧 ×；0/5；题旁写“订正”。不覆盖原答案或演算。

### A07｜第 7 题

直线 y＝3x－4 与 y 轴交点的坐标是________。

学生作答：(0，－4)。

教师红笔：答案右侧 ✓；5/5。

### A08｜第 8 题

某自行车租赁点收取固定服务费 6 元，另按每小时 2 元计费。设租车 x 小时的总费用为 y 元，则 y 与 x 的关系式为________；租车 5 小时的总费用为________元。

学生作答：y＝2x＋6；16。

纸上演算：2×5＋6＝16。

教师红笔：两处答案旁各 ✓；本题 5/5。

## 三、解答题（写出必要过程）

### A09｜第 9 题

将 3/(√5－√2) 的分母有理化，并化简。

学生作答：

```text
3/(√5－√2)
＝3(√5＋√2)/[(√5－√2)(√5＋√2)]
＝3(√5＋√2)/(5＋2)
＝3(√5＋√2)/7
```

教师红笔：题旁 △；2/5。共轭式乘法设置旁小 ✓，最后结果旁 ×；写“订正”。不代写正确分母或答案。

### A10｜第 10 题

已知一次函数的图像经过点 P(1，4) 和 Q(3，8)。

（1）求这个一次函数的表达式。

（2）求 x＝4 时的函数值。

学生作答：

```text
（1）k＝(8－4)/(3－1)＝2
所以 y＝2x。

（2）x＝4 时，y＝2×4＝8。
```

教师红笔：题旁 △；2/5。k＝2 旁小 ✓，两小问的最终答案旁各 ×；写“订正”。不补写求 b 的步骤。

## 本卷批改记录（仿真）

- 批改批次：A，首次批改；不填写真实姓名、签名或虚构实际日期。
- 分项得分：选择题 20/20，填空题 15/20，解答题 4/10；合计 39/50。
- 待订正：第 6、9、10 题；第 9、10 题为部分得分，不算全对。
- 卷末红笔留言：“请订正第 6、9、10 题，保留原作答。”
- 订正区：留白；订正状态：未完成；复批记录：无。留言是要求，不代表学生已经订正。

````

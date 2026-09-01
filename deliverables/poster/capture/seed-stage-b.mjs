import { copyFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const dbUrl = process.env.DATABASE_URL ?? "";
const dbPath = dbUrl.replace("sqlite:///", "");
const uploadsRoot = process.env.HERMES_PRIVATE_UPLOADS_DIR ?? "";

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!dbPath.endsWith("/deliverables/poster/capture/runtime/stage-b.db")) {
  fail("DATABASE_URL must target deliverables/poster/capture/runtime/stage-b.db");
}
if (!uploadsRoot.endsWith("/deliverables/poster/capture/runtime/uploads")) {
  fail("HERMES_PRIVATE_UPLOADS_DIR must target deliverables/poster/capture/runtime/uploads");
}

mkdirSync(dirname(dbPath), { recursive: true });
mkdirSync(uploadsRoot, { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) rmSync(`${dbPath}${suffix}`, { force: true });
rmSync(uploadsRoot, { recursive: true, force: true });
mkdirSync(uploadsRoot, { recursive: true });

const { getDb, closeDb } = await import("../../../src/api/db/init.js");
const { runE4Migrations } = await import("../../../src/api/db/migrate-e4.js");
const { runE5Migrations } = await import("../../../src/api/db/migrate-e5.js");

const db = getDb();
db.defaultSafeIntegers(false);
runE4Migrations(db);
runE5Migrations(db);

const studentId = "student_demo";
const now = "2026-09-02T09:00:00.000+08:00";

db.prepare(
  `INSERT INTO students (student_id, display_name, grade, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?)`,
).run(studentId, "模拟学习者", "八年级", now, now);

const batches = [
  {
    code: "a",
    uploadId: "upload_stage_b_a",
    title: "原创模拟练习 A · 首次练习",
    image: "worksheet-a-v1.png",
    capturedAt: "2026-08-31T09:00:00.000+08:00",
    selected: new Set([6, 9, 10]),
    bboxes: [
      [40, 170, 440, 175], [40, 350, 440, 145], [40, 500, 440, 215], [40, 720, 440, 115],
      [40, 840, 440, 125], [40, 965, 440, 135], [40, 1100, 440, 75], [40, 1175, 440, 150],
      [505, 170, 470, 470], [505, 835, 470, 330],
    ],
    questions: [
      ["式子 √(x－2) 在实数范围内有意义，求 x 的范围。", "B：x≥2"],
      ["判断最简二次根式。", "C：√7"],
      ["判断一次函数 y＝－2x＋3 的增减性。", "y 随 x 增大而减小"],
      ["判断点是否在直线 y＝2x＋1 上。", "B：(1，3)"],
      ["化简 √50。", "5√2"],
      ["计算：√18＋√8。", "√26；演算为 √(18＋8)＝√26"],
      ["求直线 y＝3x－4 与 y 轴交点。", "(0，－4)"],
      ["自行车租赁费用关系式与 5 小时费用。", "y＝2x＋6；16"],
      ["将 3/(√5－√2) 的分母有理化并化简。", "把共轭乘积的分母写成 5＋2"],
      ["由 P(1，4)、Q(3，8) 求一次函数，并求 x＝4 时函数值。", "求得 k＝2 后直接写 y＝2x；y＝8"],
    ],
  },
  {
    code: "b",
    uploadId: "upload_stage_b_b",
    title: "原创模拟练习 B · 后续练习",
    image: "worksheet-b-v1.png",
    capturedAt: "2026-09-02T09:00:00.000+08:00",
    selected: new Set([6, 9, 10]),
    bboxes: [
      [40, 170, 440, 175], [40, 350, 440, 145], [40, 500, 440, 215], [40, 720, 440, 115],
      [40, 840, 440, 125], [40, 965, 440, 135], [40, 1100, 440, 75], [40, 1175, 440, 150],
      [505, 170, 470, 470], [505, 835, 470, 330],
    ],
    questions: [
      ["式子 √(3x＋6) 在实数范围内有意义，求 x 的范围。", "A：x≥－2"],
      ["判断最简二次根式。", "B：√11"],
      ["判断一次函数 y＝3x－2 的增减性。", "y 随 x 增大而增大"],
      ["判断点是否在直线 y＝－x＋4 上。", "C：(3，1)"],
      ["化简 √72。", "6√2"],
      ["计算：√27＋√12。", "√39；演算为 √(27＋12)＝√39"],
      ["求直线 y＝－2x＋5 与 y 轴交点。", "(0，5)"],
      ["自行车租赁费用关系式与 4 小时费用。", "y＝3x＋8；20"],
      ["计算：(√7＋2)(√7－2)。", "－3；没有演算过程"],
      ["由 P(1，5)、Q(3，9) 求一次函数，并求 x＝－2 时函数值。", "正确求得 y＝2x＋3；最后把 －4＋3 算成 －7"],
    ],
  },
];

const insertUpload = db.prepare(
  `INSERT INTO uploads
   (upload_id, student_id, subject, subject_label, source_type, source_title, captured_at,
    uploaded_at, storage_provider, storage_key, file_name, file_size, mime_type,
    image_width, image_height, ocr_status, status, created_at, updated_at)
   VALUES (?, ?, 'math', '数学', 'exercise', ?, ?, ?, 'local', ?, ?, ?, 'image/png',
           1024, 1536, 'succeeded', 'active', ?, ?)`,
);
const insertOcrJob = db.prepare(
  `INSERT INTO ocr_jobs
   (upload_id, provider, status, attempt, is_latest, provider_request_id, provider_metadata_json,
    created_at, updated_at)
   VALUES (?, 'tencent_question_split_ocr', 'succeeded', 1, 1, ?, ?, ?, ?)`,
);
const insertQuestion = db.prepare(
  `INSERT INTO questions
   (question_id, upload_id, page, question_index, question_text, student_answer_text,
    question_type, ocr_confidence, bbox_json, created_at, updated_at)
   VALUES (?, ?, 1, ?, ?, ?, 'math', 0.99, ?, ?, ?)`,
);
const insertConfirmation = db.prepare(
  `INSERT INTO question_confirmations
   (question_id, selected, review_priority, review_status, note, created_at, updated_at)
   VALUES (?, 1, 'high', 'confirmed', ?, ?, ?)`,
);

for (const batch of batches) {
  const sourceImage = resolve(
    REPO_ROOT,
    "experiments/hermes-quality/two-batch-learning-fixture",
    batch.image,
  );
  const relativeStorageKey = `${batch.uploadId}/${batch.image}`;
  const storedImage = resolve(uploadsRoot, relativeStorageKey);
  mkdirSync(dirname(storedImage), { recursive: true });
  copyFileSync(sourceImage, storedImage);
  insertUpload.run(
    batch.uploadId,
    studentId,
    batch.title,
    batch.capturedAt,
    batch.capturedAt,
    relativeStorageKey,
    batch.image,
    statSync(sourceImage).size,
    now,
    now,
  );
  insertOcrJob.run(
    batch.uploadId,
    `stage-b-replay-${batch.code}`,
    JSON.stringify({ source: "accepted E4/E5 evidence replay", image_width: 1024, image_height: 1536 }),
    batch.capturedAt,
    batch.capturedAt,
  );

  batch.questions.forEach(([questionText, answer], index) => {
    const questionNumber = index + 1;
    const exactStoryId = batch.selected.has(questionNumber)
      ? `exp_story_${batch.code}${String(questionNumber).padStart(2, "0")}`
      : `stage_b_${batch.code}${String(questionNumber).padStart(2, "0")}`;
    const [x, y, width, height] = batch.bboxes[index];
    insertQuestion.run(
      exactStoryId,
      batch.uploadId,
      questionNumber,
      questionText,
      answer,
      JSON.stringify({ x, y, width, height }),
      now,
      now,
    );
    if (batch.selected.has(questionNumber)) {
      insertConfirmation.run(exactStoryId, `模拟批改中标记为需要分析的第 ${questionNumber} 题`, now, now);
    }
  });
}

const aOutput = JSON.parse(
  await import("node:fs").then(({ readFileSync }) =>
    readFileSync(resolve(REPO_ROOT, "experiments/hermes-quality/learning-story/results/a/Q1/stdout.txt"), "utf8"),
  ),
);
const bOutput = JSON.parse(
  await import("node:fs").then(({ readFileSync }) =>
    readFileSync(resolve(REPO_ROOT, "experiments/hermes-quality/learning-story/results/b/Q2/stdout.txt"), "utf8"),
  ),
);
const weeklyOutput = JSON.parse(
  await import("node:fs").then(({ readFileSync }) =>
    readFileSync(resolve(REPO_ROOT, "experiments/hermes-quality/learning-story/results/weekly/Q3/stdout.txt"), "utf8"),
  ),
);

const insertBatch = db.prepare(
  `INSERT INTO learning_findings
   (finding_batch_id, student_id, subject, subject_label, generated_by, generated_at,
    source_refs_json, created_at, updated_at)
   VALUES (?, ?, 'math', '数学', ?, ?, ?, ?, ?)`,
);
const insertFinding = db.prepare(
  `INSERT INTO findings
   (finding_batch_id, finding_id, question_id, upload_id, scope, finding_type, statement,
    evidence_summary, confidence, is_recurring, mistake_reasons_json, concept_links_json,
    source_memory_ids_json, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertAction = db.prepare(
  `INSERT INTO action_candidates
   (finding_id, action_type, description, priority, target_week, created_at, updated_at)
   VALUES (?, ?, ?, 'medium', NULL, ?, ?)`,
);
const insertWeeklyContext = db.prepare(
  `INSERT INTO weekly_context_candidates
   (finding_id, relevance, priority, include_in_summary, created_at, updated_at)
   VALUES (?, ?, 'medium', 1, ?, ?)`,
);
const insertMemory = db.prepare(
  `INSERT INTO memory_decisions
   (memory_id, finding_id, finding_batch_id, student_id, subject, subject_label, statement,
    reason, candidate_type, priority, note, status, accepted_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, 'math', '数学', ?, ?, 'short_term', 'medium', ?, ?, ?, ?, ?)`,
);

const storyBatches = [
  {
    code: "a",
    id: "findings_stage_b_a",
    uploadId: "upload_stage_b_a",
    generatedAt: "2026-08-31T10:00:00.000+08:00",
    output: aOutput,
  },
  {
    code: "b",
    id: "findings_stage_b_b",
    uploadId: "upload_stage_b_b",
    generatedAt: "2026-09-02T10:00:00.000+08:00",
    output: bOutput,
  },
];

for (const batch of storyBatches) {
  insertBatch.run(
    batch.id,
    studentId,
    "Hermes · E5 已验收输出回放",
    batch.generatedAt,
    JSON.stringify([
      { ref_type: "original_synthetic_fixture", batch: batch.code.toUpperCase() },
      { ref_type: "accepted_hermes_output", path: `learning-story/results/${batch.code}` },
    ]),
    now,
    now,
  );
  for (const finding of batch.output.findings) {
    const shortId = finding.question_id.replace("exp_story_", "");
    const findingId = `finding_${shortId}`;
    insertFinding.run(
      batch.id,
      findingId,
      finding.question_id,
      batch.uploadId,
      finding.scope,
      finding.finding_type,
      finding.statement,
      finding.evidence_summary,
      finding.confidence,
      finding.is_recurring ? 1 : 0,
      JSON.stringify(finding.mistake_reasons ?? []),
      JSON.stringify(finding.concept_links ?? []),
      JSON.stringify(finding.source_memory_ids ?? []),
      now,
      now,
    );
    for (const action of finding.action_candidates ?? []) {
      insertAction.run(findingId, action.action_type, action.description, now, now);
    }
    insertWeeklyContext.run(findingId, finding.evidence_summary, now, now);
  }
}

const aByQuestion = new Map(aOutput.findings.map((finding) => [finding.question_id, finding]));
const memoryRows = [
  ["exp_story_memory_a06", "finding_a06", "findings_stage_b_a", "exp_story_a06", "accepted", "已接受：用于识别后续重复问题"],
  ["exp_story_memory_a10", "finding_a10", "findings_stage_b_a", "exp_story_a10", "accepted", "已接受：用于比较后续作答步骤"],
  ["exp_story_memory_a09", "finding_a09", "findings_stage_b_a", "exp_story_a09", "pending", "待本人确认：是否保留这条学习记忆"],
];
for (const [memoryId, findingId, batchId, questionId, status, note] of memoryRows) {
  const candidate = aByQuestion.get(questionId)?.memory_candidates?.[0];
  const statement = candidate?.statement ?? aByQuestion.get(questionId)?.statement;
  insertMemory.run(
    memoryId,
    findingId,
    batchId,
    studentId,
    statement,
    candidate?.statement ?? "来自已验收 A 批分析",
    note,
    status,
    status === "accepted" ? now : null,
    now,
    now,
  );
}

const reportId = "week_20260831_20260906";
const report = {
  contract: "weekly_learning_report",
  contract_version: "1.0",
  weekly_report_id: reportId,
  student: { student_id: studentId, display_name: "模拟学习者" },
  week: { title: "A/B 学习周报：重复、变化与下一步" },
  week_start: "2026-08-31",
  week_end: "2026-09-06",
  analysis: weeklyOutput.analysis,
  evidence_links: weeklyOutput.evidence_links,
  actions: weeklyOutput.actions,
  generated_by: "weekly-learning-report · 已验收输出回放",
  generated_at: now,
};
db.prepare(
  `INSERT INTO weekly_reports
   (weekly_report_id, student_id, week_start, week_end, title, summary, report_json_url,
    report_json, status, published_at, generated_by, created_at, updated_at)
   VALUES (?, ?, '2026-08-31', '2026-09-06', ?, ?, ?, ?, 'published', ?, ?, ?, ?)`,
).run(
  reportId,
  studentId,
  report.week.title,
  "发现二次根式加法的重复问题；看见一次函数步骤的局部变化；对只有答案的题保留原因未知。",
  `/data/week_reports/${reportId}.json`,
  JSON.stringify(report),
  now,
  report.generated_by,
  now,
  now,
);

const insertJob = db.prepare(
  `INSERT INTO hermes_jobs
   (job_id, job_type, status, payload_json, result_json, mode, created_at, started_at,
    completed_at, skill_version, skill_sha256, output_json)
   VALUES (?, ?, 'completed', ?, ?, 'real', ?, ?, ?, 'e5-wip-0.1', ?, ?)`,
);
insertJob.run(
  "job_stage_b_analysis_a",
  "confirmed_mistake_analysis",
  JSON.stringify({ source_ids: ["upload_stage_b_a"] }),
  JSON.stringify(aOutput),
  now,
  now,
  now,
  "019856d21bcdf079497ab927dd08d927d1bdd3d86fac32a91a28459014088ffc",
  JSON.stringify(aOutput),
);
insertJob.run(
  "job_stage_b_analysis_b",
  "confirmed_mistake_analysis",
  JSON.stringify({ source_ids: ["upload_stage_b_b"] }),
  JSON.stringify(bOutput),
  now,
  now,
  now,
  "019856d21bcdf079497ab927dd08d927d1bdd3d86fac32a91a28459014088ffc",
  JSON.stringify(bOutput),
);
insertJob.run(
  "job_stage_b_weekly",
  "weekly_learning_report",
  JSON.stringify({ week_start: "2026-08-31", week_end: "2026-09-06" }),
  JSON.stringify(report),
  now,
  now,
  now,
  "0d8972252eba9baf1a5aff0719b1bf498aa1be571c7a7baddc40ac35d62bcdd7",
  JSON.stringify(report),
);

closeDb();

console.log(JSON.stringify({
  database: dbPath,
  uploads_root: uploadsRoot,
  student_id: studentId,
  sessions: 2,
  confirmed_questions: 6,
  finding_batches: 2,
  memories: { accepted: 2, pending: 1 },
  weekly_reports: 1,
  source: "committed accepted E4/E5 synthetic evidence replay; no new OCR/Hermes call",
}, null, 2));

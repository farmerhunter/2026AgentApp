import QuestionReviewView from "./QuestionReviewView.jsx";
import UploadView from "./UploadView.jsx";
import { ErrorState, LoadingState } from "../components/DataState.jsx";
import { fetchQuestionSession } from "../lib/api.js";
import { learningResultSteps } from "../lib/demoData.js";
import useAsyncData from "../lib/useAsyncData.js";

const DEMO_UPLOAD_ID = "upload_20260518_001";

export default function LearningResultsView() {
  const { data, error, isLoading } = useAsyncData(() =>
    Promise.all([
      fetchQuestionSession(DEMO_UPLOAD_ID, "upload_meta.json"),
      fetchQuestionSession(DEMO_UPLOAD_ID, "question_split_result.json"),
      fetchQuestionSession(DEMO_UPLOAD_ID, "question_confirmation_result.json"),
    ]).then(([uploadMeta, splitResult, confirmationResult]) => ({
      uploadMeta,
      splitResult,
      confirmationResult,
    })),
  );

  return (
    <div className="space-y-5">
      <section className="aurora-panel rounded-2xl border border-white/80 bg-white/86 p-5 shadow-soft backdrop-blur-xl">
        <div className="relative">
          <p className="text-sm font-semibold text-aurora">用例 2</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-ink">
            学习成果整理
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
            上传试卷、作业或练习册页面后，学途智伴会先展示切题结果，再进入重点题确认。第一版用
            `/data/question_sessions/` 下的静态 JSON 展示顺序流程。
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {learningResultSteps.map((step) => (
          <article
            key={step.title}
            className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-aurora/10 text-sm font-bold text-aurora">
              {step.step}
            </div>
            <h3 className="text-base font-semibold text-ink">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {step.description}
            </p>
          </article>
        ))}
      </section>

      {isLoading && <LoadingState label="正在读取学习成果 demo 数据..." />}
      {error && <ErrorState error={error} label="学习成果数据读取失败" />}
      {data && (
        <>
          <UploadView uploadMeta={data.uploadMeta} />
          <QuestionReviewView
            splitResult={data.splitResult}
            confirmationResult={data.confirmationResult}
          />
        </>
      )}
    </div>
  );
}

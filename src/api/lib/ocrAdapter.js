const FIXTURE_RAW = {
  RequestId: "fixture-request-id",
  UseNewModel: false,
  ImageWidth: 600,
  ImageHeight: 400,
  QuestionInfo: [
    {
      Angle: 0,
      Width: 600,
      Height: 400,
      OrgWidth: 600,
      OrgHeight: 400,
      ResultList: [
        {
          Question: [{ Text: "计算 √8 + √18" }],
          Answer: [{ Text: "5√2" }],
          Coord: [
            {
              LeftTop: { X: 40, Y: 20 },
              RightTop: { X: 560, Y: 20 },
              LeftBottom: { X: 40, Y: 120 },
              RightBottom: { X: 560, Y: 120 },
            },
          ],
        },
      ],
    },
  ],
};

function coordToBbox(coord) {
  if (!Array.isArray(coord) || coord.length === 0) {
    throw new Error("OCR result contains invalid Coord");
  }

  const xs = [];
  const ys = [];
  for (const point of coord) {
    for (const key of ["LeftTop", "RightTop", "LeftBottom", "RightBottom"]) {
      if (point?.[key] && Number.isFinite(point[key].X) && Number.isFinite(point[key].Y)) {
        xs.push(point[key].X);
        ys.push(point[key].Y);
      }
    }
  }

  if (xs.length === 0 || ys.length === 0) {
    throw new Error("OCR result Coord has no valid points");
  }

  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;
  if (width <= 0 || height <= 0) {
    throw new Error("OCR result bbox is not positive");
  }

  return { x, y, width, height };
}

function joinText(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((block) => block?.Text ?? "")
    .filter(Boolean)
    .join(" ");
}

export function normalizeOcrResult(raw, imageMeta = {}) {
  if (!raw || !Array.isArray(raw.QuestionInfo)) {
    throw new Error("OCR raw response missing QuestionInfo");
  }

  const questions = [];
  let index = 0;
  for (const page of raw.QuestionInfo) {
    for (const item of page.ResultList ?? []) {
      questions.push({
        question_index: index + 1,
        question_text: joinText(item.Question),
        student_answer_text: joinText(item.Answer),
        question_type: null,
        ocr_confidence: null,
        bbox: coordToBbox(item.Coord),
      });
      index += 1;
    }
  }

  if (questions.length === 0) {
    throw new Error("OCR raw response produced zero questions");
  }

  return {
    provider: "tencent-question-split-ocr",
    request_id: raw.RequestId ?? null,
    use_new_model: Boolean(raw.UseNewModel),
    image_width: imageMeta.image_width ?? raw.ImageWidth ?? null,
    image_height: imageMeta.image_height ?? raw.ImageHeight ?? null,
    questions,
  };
}

export async function runOcrAdapter(buffer, meta) {
  const mode = process.env.OCR_PROVIDER_MODE ?? "fixture";
  if (mode === "real") {
    throw new Error("real OCR adapter is gated by #93 and not implemented until signed probe is complete");
  }
  return normalizeOcrResult(FIXTURE_RAW, meta);
}

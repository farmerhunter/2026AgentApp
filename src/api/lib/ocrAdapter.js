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
      ResultList: Array.from({ length: 11 }, (_, index) => ({
        Question: [{ Text: `计算 √8 + √18（第 ${index + 1} 题）` }],
        Answer: [{ Text: "5√2" }],
        Coord: [
          {
            LeftTop: { X: 40, Y: 20 },
            RightTop: { X: 560, Y: 20 },
            LeftBottom: { X: 40, Y: 120 },
            RightBottom: { X: 560, Y: 120 },
          },
        ],
      })),
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
  const text = blocks
    .map((block) => block?.Text ?? "")
    .filter(Boolean)
    .join(" ");
  const trimmed = text.trim();
  return trimmed || null;
}

export function normalizeOcrResult(raw, imageMeta = {}) {
  if (!raw || !Array.isArray(raw.QuestionInfo)) {
    throw new Error("OCR raw response missing QuestionInfo");
  }

  const questions = [];
  let index = 0;
  for (const page of raw.QuestionInfo) {
    if (Math.abs(page.Angle ?? 0) > 0.5) {
      throw new Error("OCR result with non-zero rotation is not supported until rotation normalization is implemented");
    }
    for (const item of page.ResultList ?? []) {
      const bbox = coordToBbox(item.Coord);
      const widthLimit = imageMeta.image_width ?? raw.ImageWidth ?? page.Width;
      const heightLimit = imageMeta.image_height ?? raw.ImageHeight ?? page.Height;
      if (widthLimit != null && (bbox.x < 0 || bbox.y < 0 || bbox.x + bbox.width > widthLimit + 1 || bbox.y + bbox.height > heightLimit + 1)) {
        throw new Error("OCR result bbox is outside source image bounds");
      }
      questions.push({
        question_index: index + 1,
        question_text: joinText(item.Question),
        student_answer_text: joinText(item.Answer),
        question_type: null,
        ocr_confidence: null,
        bbox,
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
  const mode = process.env.OCR_PROVIDER_MODE;
  if (!mode) {
    throw new Error("OCR_PROVIDER_MODE is not configured; set fixture or real explicitly");
  }
  if (mode === "real") {
    throw new Error("real OCR adapter is gated by #93 and not implemented until signed probe is complete");
  }
  if (mode !== "fixture") {
    throw new Error(`Unsupported OCR_PROVIDER_MODE: ${mode}`);
  }
  return normalizeOcrResult(FIXTURE_RAW, meta);
}

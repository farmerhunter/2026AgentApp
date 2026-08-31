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

    const originalWidth = Number(page.OrgWidth ?? raw.OrgWidth);
    const originalHeight = Number(page.OrgHeight ?? raw.OrgHeight);
    const providerWidth = Number(page.Width ?? raw.Width);
    const providerHeight = Number(page.Height ?? raw.Height);

    if (
      !Number.isFinite(originalWidth) || originalWidth <= 0 ||
      !Number.isFinite(originalHeight) || originalHeight <= 0 ||
      !Number.isFinite(providerWidth) || providerWidth <= 0 ||
      !Number.isFinite(providerHeight) || providerHeight <= 0
    ) {
      throw new Error("OCR result dimensions must be finite positive numbers");
    }
    if (
      (imageMeta.image_width != null && Math.abs(originalWidth - imageMeta.image_width) > 1) ||
      (imageMeta.image_height != null && Math.abs(originalHeight - imageMeta.image_height) > 1)
    ) {
      throw new Error("OCR result original dimensions do not match uploaded image bytes");
    }

    const scaleX = originalWidth / providerWidth;
    const scaleY = originalHeight / providerHeight;

    for (const item of page.ResultList ?? []) {
      const providerBbox = coordToBbox(item.Coord);
      const bbox = {
        x: providerBbox.x * scaleX,
        y: providerBbox.y * scaleY,
        width: providerBbox.width * scaleX,
        height: providerBbox.height * scaleY,
      };
      if (![bbox.x, bbox.y, bbox.width, bbox.height].every(Number.isFinite) || bbox.width <= 0 || bbox.height <= 0) {
        throw new Error("OCR result bbox is not a finite positive rectangle");
      }
      const questionText = joinText(item.Question);
      if (!questionText) {
        throw new Error("OCR result contains a question with empty question text");
      }
      if (bbox.x < 0 || bbox.y < 0 || bbox.x + bbox.width > originalWidth + 1 || bbox.y + bbox.height > originalHeight + 1) {
        throw new Error("OCR result bbox is outside source image bounds");
      }
      questions.push({
        question_index: index + 1,
        question_text: questionText,
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
    provider: "tencent_question_split_ocr",
    request_id: raw.RequestId ?? null,
    use_new_model: Boolean(raw.UseNewModel),
    image_width: imageMeta.image_width ?? raw.OrgWidth ?? raw.ImageWidth ?? null,
    image_height: imageMeta.image_height ?? raw.OrgHeight ?? raw.ImageHeight ?? null,
    questions,
  };
}

export async function callTencentQuestionSplitOcr(buffer, { useNewModel = false, meta = {} } = {}) {
  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
  const region = process.env.TENCENTCLOUD_REGION ?? "ap-guangzhou";
  if (!secretId || !secretKey) {
    throw new Error("missing TENCENTCLOUD_SECRET_ID or TENCENTCLOUD_SECRET_KEY");
  }

  const { default: tencentcloud } = await import("tencentcloud-sdk-nodejs");
  const OcrClient = tencentcloud.ocr.v20181119.Client;
  const client = new OcrClient({
    credential: { secretId, secretKey },
    region,
    profile: {
      httpProfile: {
        endpoint: "ocr.tencentcloudapi.com",
      },
    },
  });

  const response = await client.QuestionSplitOCR({
    ImageBase64: buffer.toString("base64"),
    UseNewModel: useNewModel,
  });

  return normalizeOcrResult({ ...response, UseNewModel: useNewModel }, meta);
}

export async function runOcrAdapter(buffer, meta) {
  const mode = process.env.OCR_PROVIDER_MODE;
  if (!mode) {
    throw new Error("OCR_PROVIDER_MODE is not configured; set fixture or real explicitly");
  }
  if (mode === "real") {
    return callTencentQuestionSplitOcr(buffer, {
      useNewModel: process.env.TENCENT_OCR_USE_NEW_MODEL !== "false",
      meta,
    });
  }
  if (mode !== "fixture") {
    throw new Error(`Unsupported OCR_PROVIDER_MODE: ${mode}`);
  }
  const fixtureRaw = {
    ...FIXTURE_RAW,
    ImageWidth: meta.image_width ?? FIXTURE_RAW.ImageWidth,
    ImageHeight: meta.image_height ?? FIXTURE_RAW.ImageHeight,
    QuestionInfo: FIXTURE_RAW.QuestionInfo.map((page) => ({
      ...page,
      Width: meta.image_width ?? page.Width,
      Height: meta.image_height ?? page.Height,
      OrgWidth: meta.image_width ?? page.OrgWidth,
      OrgHeight: meta.image_height ?? page.OrgHeight,
    })),
  };
  return normalizeOcrResult(fixtureRaw, meta);
}

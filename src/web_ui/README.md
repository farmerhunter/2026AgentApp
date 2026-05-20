# 学途智伴 Web UI

`src/web_ui/` contains the first Hermes Web UI scaffold for local development and later VPS deployment.

## Local Development

```bash
cd src/web_ui
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

The project includes `.npmrc` configured for Huawei Cloud npm mirror because it is currently the fastest tested registry from the local development environment.

## Build

```bash
npm run build
```

## Demo Data Validation

Run the lightweight data validator before local development or VPS deployment:

```bash
npm run validate:data
```

The validator checks:
- Week reports index and all referenced reports exist and are valid JSON
- Weekly reports have chinese/math/english subjects with correct codes
- Upload sessions have all required files (upload_meta, split_result, confirmation_result)
- All `subject` fields use internal codes (`chinese`/`math`/`english`) not Chinese text
- `subject_label` exists for display
- No local absolute paths in public data
- Textbooks have chapters
- Notes and focus question records are present

## Local Smoke Test

Run these steps in order to verify the full local demo:

```bash
cd src/web_ui
npm install
npm run validate:data   # verify demo data integrity
npm run build           # verify production build
npm run dev             # start dev server
```

Open `http://localhost:5173` and verify:

| View | Check |
|------|-------|
| 学习成果 | Toggle 全部/语文/数学/英语 filter. Click 上传材料 → 4-step wizard. Confirm step 3 shows question editor. |
| 输入备注 | Chinese and math notes displayed. 保存备注 button and subject selector present. English shows no-data state. |
| 历史周报 | Select between two reports. Toggle subject filter. Metrics and risk/suggestion lists render. English no-data state. |
| 学习内容 | Chinese and math textbook summaries with chapter cards. Upload/Analyze section with PDF selector and demo analysis flow. English no-data state. |

The data validator runs offline — no network, no backend, no VPS required.

## Static Data Path

Frontend code should fetch demo or production JSON from `/data/...`.

Local development can place files under:

```text
src/web_ui/public/data/
```

VPS deployment should expose equivalent data through Nginx:

```text
/var/www/html/data/
```

Do not hard-code localhost, VPS IPs, domain names, or private storage paths in frontend code.

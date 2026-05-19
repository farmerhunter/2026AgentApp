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

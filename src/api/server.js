import { createServer } from "node:http";
import { P0_REASON } from "./lib/p0Protection.js";

const server = createServer((req, res) => {
  const health = req.method === "GET" && req.url === "/api/health";
  res.writeHead(health ? 200 : 503, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(health
    ? { status: "protected_disabled" }
    : { error: P0_REASON, message: "真实功能已暂停，请使用公开演示。" }));
});

server.listen(process.env.HERMES_API_PORT ?? 8000, "127.0.0.1", () => {
  console.log(`API protected_disabled on 127.0.0.1:${server.address().port}`);
});

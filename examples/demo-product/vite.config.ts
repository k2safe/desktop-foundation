import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function demoApiPlugin(): Plugin {
  return {
    name: "demo-product-api",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.startsWith("/capabilities/health") && request.method === "GET") {
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ ok: true, runtime: "vite-dev", requestId: request.headers["x-request-id"] ?? null }));
          return;
        }

        if (request.url?.startsWith("/capabilities/upload") && request.method === "POST") {
          const chunks: Buffer[] = [];
          request.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          request.on("end", () => {
            const body = Buffer.concat(chunks);
            const contentType = request.headers["content-type"] ?? "";
            response.setHeader("Content-Type", "application/json");
            response.end(
              JSON.stringify({
                ok: true,
                runtime: "vite-dev",
                bodyKind: String(contentType).startsWith("multipart/form-data") ? "multipart" : "raw",
                bytes: body.byteLength,
                requestId: request.headers["x-request-id"] ?? null
              })
            );
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [demoApiPlugin(), react()],
  server: {
    host: "127.0.0.1"
  },
  preview: {
    host: "127.0.0.1"
  }
});

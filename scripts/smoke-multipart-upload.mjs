#!/usr/bin/env node
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bridgeEntry = resolve(repoRoot, "packages/desktop-bridge/dist/index.js");

const expected = {
  release: "0.1.20",
  fieldName: "release",
  fileFieldName: "package",
  fileName: "desktop-release.zip",
  fileContentType: "application/zip",
  fileBody: "zip bytes from desktop foundation demo"
};

if (!existsSync(bridgeEntry)) {
  throw new Error("Missing packages/desktop-bridge/dist/index.js. Run pnpm --filter @desktop-foundation/bridge build first.");
}

function memoryStore() {
  const values = new Map();
  return {
    get: (key) => (values.has(key) ? values.get(key) : null),
    set: (key, value) => values.set(key, value),
    remove: (key) => values.delete(key)
  };
}

function memoryAsyncStore() {
  const store = memoryStore();
  return {
    get: async (key) => store.get(key),
    set: async (key, value) => {
      store.set(key, value);
    },
    remove: async (key) => {
      store.remove(key);
    }
  };
}

function demoSession() {
  let token = "demo-token";
  return {
    getToken: () => token,
    setToken: (nextToken) => {
      token = nextToken;
    },
    clearToken: () => {
      token = null;
    }
  };
}

function noopDesktop() {
  return {
    openExternal: async () => undefined,
    copyText: async () => undefined,
    notify: async () => undefined,
    getWindowState: async () => null,
    setWindowState: async () => undefined,
    setWindowTitle: async () => undefined
  };
}

function noopFiles() {
  return {
    openFileDialog: async () => ({ paths: [], canceled: true }),
    saveFileDialog: async () => ({ path: null, canceled: true }),
    readTextFile: async () => "",
    writeTextFile: async (path) => path,
    exportJson: async (fileName) => fileName,
    downloadFile: async () => ({ path: "download.bin", bytes: 0, status: 200 })
  };
}

function createUploadForm() {
  const form = new FormData();
  form.append(expected.fieldName, expected.release);
  form.append(
    expected.fileFieldName,
    new Blob([expected.fileBody], { type: expected.fileContentType }),
    expected.fileName
  );
  return form;
}

function containsAll(text, values) {
  return values.every((value) => text.includes(value));
}

function validateMultipartRequest(request) {
  const contentType = request.contentType;
  const bodyText = request.body.toString("latin1");
  const failures = [];
  if (!contentType.includes("multipart/form-data")) failures.push("missing multipart/form-data content type");
  if (!contentType.includes("boundary=")) failures.push("missing multipart boundary");
  if (!containsAll(bodyText, [`name="${expected.fieldName}"`, expected.release])) failures.push("missing release field");
  if (!containsAll(bodyText, [`name="${expected.fileFieldName}"`, `filename="${expected.fileName}"`])) failures.push("missing file part");
  if (!bodyText.includes(expected.fileContentType)) failures.push("missing file content type");
  if (!bodyText.includes(expected.fileBody)) failures.push("missing file body");
  return failures;
}

async function startMultipartServer() {
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const captured = {
      method: request.method,
      url: request.url,
      contentType: String(request.headers["content-type"] || ""),
      body: Buffer.concat(chunks)
    };
    captured.failures = validateMultipartRequest(captured);
    requests.push(captured);

    const ok = request.method === "POST" && request.url === "/upload" && captured.failures.length === 0;
    const payload = ok
      ? { code: 200, data: { ok: true, bytes: captured.body.length, contentType: captured.contentType } }
      : { code: 500, message: captured.failures.join("; ") || "invalid multipart request" };
    response.writeHead(ok ? 200 : 400, {
      "Content-Type": "application/json",
      "x-request-id": "demo-multipart-upload"
    });
    response.end(JSON.stringify(payload));
  });

  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to bind local multipart smoke server");

  return {
    baseURL: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise((resolvePromise) => server.close(resolvePromise))
  };
}

async function runWebClientSmoke(createDesktopClient, server) {
  const client = createDesktopClient({
    product: "multipart-demo",
    apiBaseURL: server.baseURL,
    session: demoSession(),
    storage: memoryStore(),
    secureStorage: memoryAsyncStore(),
    desktop: noopDesktop(),
    files: noopFiles(),
    security: {
      allowedRequestOrigins: ["127.0.0.1"]
    }
  });

  const reply = await client.http.post("/upload", createUploadForm(), {
    auth: false,
    requestId: "demo-web-multipart"
  });
  if (!reply?.ok) throw new Error("Web multipart upload did not return ok=true");
  const request = server.requests.at(-1);
  if (!request) throw new Error("Local multipart server did not receive a request");
  return { bytes: request.body.length, contentType: request.contentType };
}

async function runTauriSerializationSmoke(createTauriHttpTransport) {
  let capturedRequest = null;
  const transport = createTauriHttpTransport(async (_command, args) => {
    capturedRequest = args?.request;
    return {
      status: 200,
      body: { code: 200, data: { ok: true } },
      requestId: "demo-tauri-multipart"
    };
  });

  const reply = await transport.request({
    method: "POST",
    url: "http://127.0.0.1/upload",
    body: createUploadForm(),
    requestId: "demo-tauri-multipart"
  });
  if (!reply?.ok) throw new Error("Tauri multipart serialization did not return ok=true");
  if (!capturedRequest?.multipart) throw new Error("Tauri transport did not serialize FormData into multipart");
  if (capturedRequest.body !== undefined || capturedRequest.bodyBase64 !== undefined || capturedRequest.bodyContentType !== undefined) {
    throw new Error("Tauri transport kept a raw body alongside multipart");
  }

  const field = capturedRequest.multipart.fields?.find((item) => item.name === expected.fieldName);
  if (field?.value !== expected.release) throw new Error("Tauri multipart field was not serialized correctly");

  const file = capturedRequest.multipart.files?.find((item) => item.name === expected.fileFieldName);
  if (!file) throw new Error("Tauri multipart file was not serialized");
  if (file.fileName !== expected.fileName) throw new Error("Tauri multipart fileName was not preserved");
  if (file.contentType !== expected.fileContentType) throw new Error("Tauri multipart contentType was not preserved");
  if (Buffer.from(file.bodyBase64, "base64").toString("utf8") !== expected.fileBody) {
    throw new Error("Tauri multipart file bodyBase64 did not match the demo payload");
  }

  return {
    fields: capturedRequest.multipart.fields?.length ?? 0,
    files: capturedRequest.multipart.files?.length ?? 0
  };
}

const { createDesktopClient, createTauriHttpTransport } = await import(pathToFileURL(bridgeEntry).toString());
const server = await startMultipartServer();

try {
  const web = await runWebClientSmoke(createDesktopClient, server);
  const tauri = await runTauriSerializationSmoke(createTauriHttpTransport);
  console.log("desktop-foundation multipart smoke: ok");
  console.log(`- web FormData upload reached local server (${web.bytes} bytes, ${web.contentType})`);
  console.log(`- Tauri bridge serialized FormData (${tauri.fields} field, ${tauri.files} file)`);
} finally {
  await server.close();
}

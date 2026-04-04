import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFile } from "./src/env.js";
import { HttpError, assertAdminAccess } from "./src/http.js";
import {
  listBookingsForAdmin,
  processAdminDecision,
  submitBookingRequest,
} from "./src/services.js";
import { ensureDataFiles } from "./src/storage.js";

loadEnvFile();
await ensureDataFiles();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number.parseInt(process.env.PORT || "3000", 10);

const staticRoutes = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/admin", "admin.html"],
  ["/admin.html", "admin.html"],
  ["/app.js", "app.js"],
  ["/admin.js", "admin.js"],
  ["/pcg-logo.png", "pcg-logo.png"],
  ["/styles.css", "styles.css"],
  ["/favicon.ico", "favicon.svg"],
  ["/favicon.svg", "favicon.svg"],
]);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === "/api/health") {
      if (request.method !== "GET") {
        throw new HttpError(405, "Method not allowed.");
      }

      return sendJson(response, 200, {
        ok: true,
        storage: process.env.BLOB_READ_WRITE_TOKEN ? "vercel_blob" : "local_file",
      });
    }

    if (pathname === "/api/bookings") {
      if (request.method !== "POST") {
        throw new HttpError(405, "Method not allowed.");
      }

      const body = await readJsonBody(request);
      const result = await submitBookingRequest(body);
      return sendJson(response, result.statusCode, result.body);
    }

    if (pathname === "/api/admin/bookings") {
      if (request.method !== "GET") {
        throw new HttpError(405, "Method not allowed.");
      }

      assertAdminAccess(request.headers);
      const result = await listBookingsForAdmin();
      return sendJson(response, result.statusCode, result.body);
    }

    if (pathname === "/api/admin/bookings/decision") {
      if (request.method !== "POST") {
        throw new HttpError(405, "Method not allowed.");
      }

      assertAdminAccess(request.headers);
      const body = await readJsonBody(request);
      const result = await processAdminDecision(url.searchParams.get("id"), body);
      return sendJson(response, result.statusCode, result.body);
    }

    if (staticRoutes.has(pathname)) {
      return serveFile(response, path.join(__dirname, staticRoutes.get(pathname)));
    }

    return sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    if (!(error instanceof HttpError)) {
      console.error(error);
    }

    return sendJson(response, statusCode, {
      error: error instanceof HttpError ? error.message : "Something went wrong on the server.",
      ...(error instanceof HttpError ? error.details : {}),
    });
  }
});

server.listen(port, () => {
  console.log(`Bus Booker is running at http://localhost:${port}`);
});

async function serveFile(response, filePath) {
  try {
    const file = await readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
    });
    response.end(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      return sendJson(response, 404, { error: "Not found." });
    }

    throw error;
  }
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

export class HttpError extends Error {
  constructor(statusCode, message, details = {}) {
    super(message);
    this.name = "HttpError";
    this.details = details;
    this.statusCode = statusCode;
  }
}

export function assertAdminAccess(requestHeaders) {
  const adminAccessCode = process.env.ADMIN_ACCESS_CODE || "church-bus-2026";
  const providedCode = readHeader(requestHeaders, "x-admin-key");

  if (providedCode !== adminAccessCode) {
    throw new HttpError(401, "Invalid admin access code.");
  }
}

export async function parseRequestJson(request) {
  const raw = (await request.text()).trim();

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export function json(payload, statusCode = 200) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
    status: statusCode,
  });
}

export function handleError(error) {
  if (error instanceof HttpError) {
    return json(
      {
        error: error.message,
        ...error.details,
      },
      error.statusCode,
    );
  }

  console.error(error);
  return json({ error: "Something went wrong on the server." }, 500);
}

function readHeader(headers, key) {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof Headers) {
    return headers.get(key) || undefined;
  }

  return headers[key];
}

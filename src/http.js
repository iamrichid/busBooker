import { createHmac, timingSafeEqual } from "node:crypto";

export class HttpError extends Error {
  constructor(statusCode, message, details = {}) {
    super(message);
    this.name = "HttpError";
    this.details = details;
    this.statusCode = statusCode;
  }
}

const ADMIN_SESSION_COOKIE = "admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;
const FINANCE_SESSION_COOKIE = "finance_session";
const FINANCE_SESSION_TTL_SECONDS = 60 * 60 * 12;

export function createAdminSession(adminName) {
  const safeName = String(adminName || "").trim();
  if (!safeName) {
    throw new HttpError(400, "Admin name is required.");
  }

  const payload = {
    exp: nowInSeconds() + ADMIN_SESSION_TTL_SECONDS,
    name: safeName,
  };

  return encodeSignedSession(payload, getAdminSessionSecret());
}

export function clearAdminSessionCookie(options = {}) {
  const attributes = ["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (options.secure) {
    attributes.push("Secure");
  }

  return `${ADMIN_SESSION_COOKIE}=; ${attributes.join("; ")}`;
}

export function buildAdminSessionCookie(sessionToken, options = {}) {
  const attributes = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${ADMIN_SESSION_TTL_SECONDS}`];
  if (options.secure) {
    attributes.push("Secure");
  }

  return `${ADMIN_SESSION_COOKIE}=${sessionToken}; ${attributes.join("; ")}`;
}

export function authenticateAdminCredentials(accessCode, adminName) {
  const adminAccessCode = process.env.ADMIN_ACCESS_CODE || "church-bus-2026";
  const providedCode = String(accessCode || "").trim();
  const providedName = String(adminName || "").trim();

  if (!providedCode) {
    throw new HttpError(400, "Admin access code is required.", {
      fields: {
        accessCode: "Please enter the admin access code.",
      },
    });
  }

  if (!providedName) {
    throw new HttpError(400, "Admin name is required.", {
      fields: {
        adminName: "Please enter the admin name for this session.",
      },
    });
  }

  if (!safeEqual(providedCode, adminAccessCode)) {
    throw new HttpError(401, "Invalid admin access code.");
  }
}

export function createFinanceSession(financeName) {
  const safeName = String(financeName || "").trim();
  if (!safeName) {
    throw new HttpError(400, "Finance officer name is required.");
  }

  const payload = {
    exp: nowInSeconds() + FINANCE_SESSION_TTL_SECONDS,
    name: safeName,
  };

  return encodeSignedSession(payload, getFinanceSessionSecret());
}

export function buildFinanceSessionCookie(sessionToken, options = {}) {
  const attributes = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${FINANCE_SESSION_TTL_SECONDS}`];
  if (options.secure) {
    attributes.push("Secure");
  }

  return `${FINANCE_SESSION_COOKIE}=${sessionToken}; ${attributes.join("; ")}`;
}

export function clearFinanceSessionCookie(options = {}) {
  const attributes = ["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (options.secure) {
    attributes.push("Secure");
  }

  return `${FINANCE_SESSION_COOKIE}=; ${attributes.join("; ")}`;
}

export function authenticateFinanceCredentials(accessCode, financeName) {
  const financeAccessCode = process.env.FINANCE_ACCESS_CODE || process.env.ADMIN_ACCESS_CODE || "church-bus-2026";
  const providedCode = String(accessCode || "").trim();
  const providedName = String(financeName || "").trim();

  if (!providedCode) {
    throw new HttpError(400, "Finance access code is required.", {
      fields: {
        accessCode: "Please enter the finance access code.",
      },
    });
  }

  if (!providedName) {
    throw new HttpError(400, "Finance officer name is required.", {
      fields: {
        financeName: "Please enter your name for this session.",
      },
    });
  }

  if (!safeEqual(providedCode, financeAccessCode)) {
    throw new HttpError(401, "Invalid finance access code.");
  }
}

export function assertAdminAccess(requestHeaders) {
  const session = readAdminSession(requestHeaders);

  if (!session) {
    throw new HttpError(401, "Admin authentication is required.");
  }

  return session;
}

export function assertFinanceAccess(requestHeaders) {
  const session = readFinanceSession(requestHeaders);

  if (!session) {
    throw new HttpError(401, "Finance authentication is required.");
  }

  return session;
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

export function readAdminSession(requestHeaders) {
  const cookieHeader = readHeader(requestHeaders, "cookie");
  const token = readCookie(cookieHeader, ADMIN_SESSION_COOKIE);

  if (!token) {
    return null;
  }

  const payload = decodeSignedSession(token, getAdminSessionSecret());
  if (!payload || payload.exp <= nowInSeconds() || !payload.name) {
    return null;
  }

  return {
    adminName: payload.name,
    expiresAt: payload.exp,
  };
}

export function readFinanceSession(requestHeaders) {
  const cookieHeader = readHeader(requestHeaders, "cookie");
  const token = readCookie(cookieHeader, FINANCE_SESSION_COOKIE);

  if (!token) {
    return null;
  }

  const payload = decodeSignedSession(token, getFinanceSessionSecret());
  if (!payload || payload.exp <= nowInSeconds() || !payload.name) {
    return null;
  }

  return {
    financeName: payload.name,
    expiresAt: payload.exp,
  };
}

export function json(payload, statusCode = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
    status: statusCode,
  });
}

export function shouldUseSecureCookies(requestHeaders, requestUrl = "") {
  const forwardedProto = readHeader(requestHeaders, "x-forwarded-proto");
  if (forwardedProto) {
    return String(forwardedProto).includes("https");
  }

  if (String(process.env.NODE_ENV || "").toLowerCase() === "production") {
    return true;
  }

  try {
    if (requestUrl) {
      return new URL(requestUrl).protocol === "https:";
    }
  } catch {
    // ignore invalid urls
  }

  return false;
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

function encodeSignedSession(payload, secret) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

function decodeSignedSession(token, secret) {
  const parts = String(token).split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = signValue(encodedPayload, secret);

  if (!safeEqual(expectedSignature, providedSignature)) {
    return null;
  }

  try {
    const payloadJson = fromBase64Url(encodedPayload);
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

function signValue(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_ACCESS_CODE || "church-bus-2026";
}

function getFinanceSessionSecret() {
  return (
    process.env.FINANCE_SESSION_SECRET ||
    process.env.FINANCE_ACCESS_CODE ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_ACCESS_CODE ||
    "church-bus-2026"
  );
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function readCookie(cookieHeader, key) {
  if (!cookieHeader) {
    return "";
  }

  return String(cookieHeader)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((value, pair) => {
      if (value) {
        return value;
      }

      const separator = pair.indexOf("=");
      if (separator === -1) {
        return "";
      }

      const name = pair.slice(0, separator).trim();
      const cookieValue = pair.slice(separator + 1).trim();
      return name === key ? cookieValue : "";
    }, "");
}

function toBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

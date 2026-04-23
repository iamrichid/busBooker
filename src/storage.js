import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./http.js";

const dataDir = path.join(process.cwd(), "data");
const bookingsFile = path.join(dataDir, "bookings.json");
const notificationsFile = path.join(dataDir, "notifications.log");
const notificationSettingsFile = path.join(dataDir, "notification-settings.json");
const accessSettingsFile = path.join(dataDir, "access-settings.json");
const bookingBlobPrefix = "bus-booker/bookings/";
const notificationBlobPrefix = "bus-booker/notifications/";
const notificationSettingsBlobPath = "bus-booker/settings/notification-settings.json";
const accessSettingsBlobPath = "bus-booker/settings/access-settings.json";

export async function ensureDataFiles() {
  if (usesBlobStorage()) {
    return;
  }

  assertWritableLocalStorage();

  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(bookingsFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeFile(bookingsFile, "[]\n", "utf8");
    } else {
      throw error;
    }
  }

  try {
    await readFile(notificationSettingsFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeFile(notificationSettingsFile, `${JSON.stringify(getDefaultNotificationSettings(), null, 2)}\n`, "utf8");
    } else {
      throw error;
    }
  }

  try {
    await readFile(accessSettingsFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeFile(accessSettingsFile, `${JSON.stringify(getDefaultAccessSettings(), null, 2)}\n`, "utf8");
      return;
    }

    throw error;
  }
}

export async function readBookings() {
  if (usesBlobStorage()) {
    return readBookingsFromBlob();
  }

  assertWritableLocalStorage();

  await ensureDataFiles();
  const raw = await readFile(bookingsFile, "utf8");
  return JSON.parse(raw);
}

export async function saveBooking(booking) {
  if (usesBlobStorage()) {
    await saveBookingToBlob(booking);
    return;
  }

  assertWritableLocalStorage();

  await ensureDataFiles();
  const bookings = await readBookings();
  const index = bookings.findIndex((item) => item.id === booking.id);
  const nextBookings =
    index === -1 ? [...bookings, booking] : bookings.toSpliced(index, 1, booking);
  await writeFile(bookingsFile, `${JSON.stringify(nextBookings, null, 2)}\n`, "utf8");
}

export async function appendNotificationLog(entry) {
  if (usesBlobStorage()) {
    await saveNotificationLogToBlob(entry);
    return;
  }

  assertWritableLocalStorage();

  await ensureDataFiles();
  await appendFile(notificationsFile, `${JSON.stringify(entry)}\n`, "utf8");
}

export async function readNotificationSettings() {
  if (usesBlobStorage()) {
    const blobSettings = await readBlobJson(notificationSettingsBlobPath);
    return normalizeNotificationSettings(blobSettings);
  }

  assertWritableLocalStorage();
  await ensureDataFiles();
  const raw = await readFile(notificationSettingsFile, "utf8");
  return normalizeNotificationSettings(JSON.parse(raw));
}

export async function saveNotificationSettings(settings) {
  const normalized = normalizeNotificationSettings(settings);

  if (usesBlobStorage()) {
    const { put } = await loadBlobSdk();
    await put(
      notificationSettingsBlobPath,
      `${JSON.stringify(normalized, null, 2)}\n`,
      {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
      },
    );
    return normalized;
  }

  assertWritableLocalStorage();
  await ensureDataFiles();
  await writeFile(notificationSettingsFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export async function readAccessSettings() {
  if (usesBlobStorage()) {
    const blobSettings = await readBlobJson(accessSettingsBlobPath);
    return normalizeAccessSettings(blobSettings);
  }

  assertWritableLocalStorage();
  await ensureDataFiles();
  const raw = await readFile(accessSettingsFile, "utf8");
  return normalizeAccessSettings(JSON.parse(raw));
}

export async function saveAccessSettings(settings) {
  const normalized = normalizeAccessSettings(settings);

  if (usesBlobStorage()) {
    const { put } = await loadBlobSdk();
    await put(
      accessSettingsBlobPath,
      `${JSON.stringify(normalized, null, 2)}\n`,
      {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
      },
    );
    return normalized;
  }

  assertWritableLocalStorage();
  await ensureDataFiles();
  await writeFile(accessSettingsFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export function usesBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function assertWritableLocalStorage() {
  if (!process.env.VERCEL) {
    return;
  }

  throw new HttpError(
    500,
    "Storage is not configured for Vercel. Add a Blob store so BLOB_READ_WRITE_TOKEN is available.",
  );
}

async function readBookingsFromBlob() {
  const blobs = await listAllBlobs(bookingBlobPrefix);
  const latestById = new Map();

  for (const blob of blobs) {
    const parsed = parseBookingBlobPath(blob.pathname);

    if (!parsed) {
      continue;
    }

    const previous = latestById.get(parsed.id);

    if (!previous || parsed.version > previous.version) {
      latestById.set(parsed.id, parsed);
    }
  }

  const bookings = await Promise.all(
    [...latestById.values()].map((entry) => readBlobJson(entry.pathname)),
  );

  return bookings.filter(Boolean);
}

async function saveBookingToBlob(booking) {
  const { put } = await loadBlobSdk();

  await put(
    `${bookingBlobPrefix}${booking.id}/${createVersionKey()}`,
    `${JSON.stringify(booking, null, 2)}\n`,
    {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json",
    },
  );
}

async function saveNotificationLogToBlob(entry) {
  const { put } = await loadBlobSdk();

  await put(
    `${notificationBlobPrefix}${createVersionKey()}`,
    `${JSON.stringify(entry)}\n`,
    {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json",
    },
  );
}

async function listAllBlobs(prefix) {
  const { list } = await loadBlobSdk();
  const blobs = [];
  let cursor;

  do {
    const page = await list({
      cursor,
      limit: 1000,
      prefix,
    });

    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return blobs;
}

async function readBlobJson(pathname) {
  const { get } = await loadBlobSdk();
  const blob = await get(pathname, { access: "private" });

  if (!blob) {
    return null;
  }

  return new Response(blob.stream).json();
}

function parseBookingBlobPath(pathname) {
  if (!pathname.startsWith(bookingBlobPrefix)) {
    return null;
  }

  const relative = pathname.slice(bookingBlobPrefix.length);
  const [id, version] = relative.split("/", 2);

  if (!id || !version) {
    return null;
  }

  return {
    id,
    pathname,
    version,
  };
}

function createVersionKey() {
  return `${String(Date.now()).padStart(13, "0")}-${randomUUID()}.json`;
}

export function normalizeNotificationSettings(settings) {
  const safeSettings = settings && typeof settings === "object" ? settings : {};
  const fallback = getDefaultNotificationSettings();
  return {
    adminPhones: normalizePhoneList(safeSettings.adminPhones, fallback.adminPhones),
    financePhones: normalizePhoneList(safeSettings.financePhones, fallback.financePhones),
  };
}

export function normalizeAccessSettings(settings) {
  const safeSettings = settings && typeof settings === "object" ? settings : {};
  const fallback = getDefaultAccessSettings();
  return {
    admin: normalizeDeskAccessSettings(safeSettings.admin, fallback.admin),
    finance: normalizeDeskAccessSettings(safeSettings.finance, fallback.finance),
  };
}

function normalizePhoneList(value, fallback = []) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const phones = value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

  return [...new Set(phones)];
}

function getDefaultNotificationSettings() {
  return {
    adminPhones: readEnvPhoneList(process.env.ADMIN_NOTIFICATION_PHONES),
    financePhones: readEnvPhoneList(process.env.FINANCE_NOTIFICATION_PHONES),
  };
}

function normalizeDeskAccessSettings(settings, fallback) {
  const safeSettings = settings && typeof settings === "object" ? settings : {};
  return {
    accessCode: String(safeSettings.accessCode || fallback.accessCode || "").trim(),
    name: String(safeSettings.name || fallback.name || "").trim(),
  };
}

function getDefaultAccessSettings() {
  return {
    admin: {
      accessCode: String(process.env.ADMIN_ACCESS_CODE || "church-bus-2026").trim(),
      name: String(process.env.ADMIN_LOGIN_NAME || process.env.ADMIN_NAME || "Transport secretary").trim(),
    },
    finance: {
      accessCode: String(
        process.env.FINANCE_ACCESS_CODE || process.env.ADMIN_ACCESS_CODE || "church-bus-2026",
      ).trim(),
      name: String(process.env.FINANCE_LOGIN_NAME || process.env.FINANCE_NAME || "Finance officer").trim(),
    },
  };
}

function readEnvPhoneList(value) {
  return String(value || "")
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function loadBlobSdk() {
  try {
    return await import("@vercel/blob");
  } catch (error) {
    throw new Error(
      "Blob storage is enabled, but @vercel/blob is not installed. Run `npm install` before previewing or deploying.",
      { cause: error },
    );
  }
}

import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./http.js";

const dataDir = path.join(process.cwd(), "data");
const bookingsFile = path.join(dataDir, "bookings.json");
const notificationsFile = path.join(dataDir, "notifications.log");
const notificationSettingsFile = path.join(dataDir, "notification-settings.json");
const smsCreditStatusFile = path.join(dataDir, "sms-credit-status.json");
const termsDocumentFile = path.join(dataDir, "terms-document.json");
const hiringRatesFile = path.join(dataDir, "hiring-rates.json");
const bookingBlobPrefix = "bus-booker/bookings/";
const notificationBlobPrefix = "bus-booker/notifications/";
const notificationSettingsBlobPath = "bus-booker/settings/notification-settings.json";
const smsCreditStatusBlobPath = "bus-booker/settings/sms-credit-status.json";
const termsDocumentBlobPath = "bus-booker/settings/terms-document.json";
const hiringRatesBlobPath = "bus-booker/settings/hiring-rates.json";

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
    await readFile(smsCreditStatusFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeFile(smsCreditStatusFile, `${JSON.stringify(getDefaultSmsCreditStatus(), null, 2)}\n`, "utf8");
    } else {
      throw error;
    }
  }

  try {
    await readFile(termsDocumentFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeFile(termsDocumentFile, `${JSON.stringify(getDefaultTermsDocument(), null, 2)}\n`, "utf8");
    } else {
      throw error;
    }
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

export async function readSmsCreditStatus() {
  if (usesBlobStorage()) {
    const blobStatus = await readBlobJson(smsCreditStatusBlobPath);
    return normalizeSmsCreditStatus(blobStatus);
  }

  assertWritableLocalStorage();
  await ensureDataFiles();
  const raw = await readFile(smsCreditStatusFile, "utf8");
  return normalizeSmsCreditStatus(JSON.parse(raw));
}

export async function saveSmsCreditStatus(status) {
  const normalized = normalizeSmsCreditStatus(status);

  if (usesBlobStorage()) {
    const { put } = await loadBlobSdk();
    await put(
      smsCreditStatusBlobPath,
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
  await writeFile(smsCreditStatusFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export async function readTermsDocument() {
  if (usesBlobStorage()) {
    const blobTerms = await readBlobJson(termsDocumentBlobPath);
    return normalizeTermsDocument(blobTerms);
  }

  assertWritableLocalStorage();
  await ensureDataFiles();
  const raw = await readFile(termsDocumentFile, "utf8");
  return normalizeTermsDocument(JSON.parse(raw));
}

export async function saveTermsDocument(document) {
  const normalized = normalizeTermsDocument(document);

  if (usesBlobStorage()) {
    const { put } = await loadBlobSdk();
    await put(
      termsDocumentBlobPath,
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
  await writeFile(termsDocumentFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export async function readHiringRatesDocument() {
  if (usesBlobStorage()) {
    return readBlobJson(hiringRatesBlobPath);
  }

  assertWritableLocalStorage();

  try {
    const raw = await readFile(hiringRatesFile, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function saveHiringRatesDocument(document) {
  const safe = document && typeof document === "object" ? document : {};
  const payload = {
    routes: Array.isArray(safe.routes) ? safe.routes : [],
    updatedAt: String(safe.updatedAt || "").trim(),
    updatedBy: String(safe.updatedBy || "").trim(),
  };

  if (usesBlobStorage()) {
    const { put } = await loadBlobSdk();
    await put(
      hiringRatesBlobPath,
      `${JSON.stringify(payload, null, 2)}\n`,
      {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
      },
    );
    return payload;
  }

  assertWritableLocalStorage();
  await ensureDataFiles();
  await writeFile(hiringRatesFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
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

export function normalizeTermsDocument(document) {
  const safeDocument = document && typeof document === "object" ? document : {};
  const fallback = getDefaultTermsDocument();

  return {
    content: normalizeLongText(safeDocument.content, fallback.content),
    fileName: normalizeShortText(safeDocument.fileName, fallback.fileName),
    updatedAt: normalizeShortText(safeDocument.updatedAt, fallback.updatedAt),
    updatedBy: normalizeShortText(safeDocument.updatedBy, fallback.updatedBy),
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

function normalizeLongText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeShortText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function getDefaultNotificationSettings() {
  const defaultAdminPhones = ["0262247767", "0242638289"];
  const defaultFinancePhones = ["+233243612760"];
  const envAdminPhones = readEnvPhoneList(process.env.ADMIN_NOTIFICATION_PHONES);
  const envFinancePhones = readEnvPhoneList(process.env.FINANCE_NOTIFICATION_PHONES);

  return {
    adminPhones: envAdminPhones.length > 0 ? envAdminPhones : defaultAdminPhones,
    financePhones: envFinancePhones.length > 0 ? envFinancePhones : defaultFinancePhones,
  };
}

function getDefaultSmsCreditStatus() {
  return {
    balanceAfter: null,
    balanceBefore: null,
    lastUpdatedAt: "",
    lowCredit: false,
    lowCreditThreshold: 100,
    perMessage: null,
    provider: "csms",
    recipientCount: null,
    segmentsPerMessage: null,
    totalCost: null,
  };
}

function getDefaultTermsDocument() {
  return {
    content: [
      "1. All bus requests are subject to review and approval by the transport desk.",
      "2. The requester is responsible for providing accurate dates, times, destination, and passenger count.",
      "3. Approved trips must follow the agreed departure and return times unless the transport desk grants a change.",
      "4. The bus must be used only for the stated church or authorised event.",
      "5. Any loss, damage, or late return must be reported to the transport desk immediately.",
      "Additional terms:",
      "- Price quoted is per day between 5am and 8pm. Price depends on the destination from pickup point.",
      "- Renter is responsible for fuel. Trip starts with a full tank; renter buys top ups as and when necessary and fills up the tank upon completion of trip.",
      "- Fuel cost and driver allowance could be added to the rental charge if renter so wish.",
    ].join("\n\n"),
    fileName: "default-terms.txt",
    updatedAt: "",
    updatedBy: "",
  };
}

function normalizeSmsCreditStatus(status) {
  const safeStatus = status && typeof status === "object" ? status : {};
  const fallback = getDefaultSmsCreditStatus();

  return {
    balanceAfter: normalizeNullableNumber(safeStatus.balanceAfter, fallback.balanceAfter),
    balanceBefore: normalizeNullableNumber(safeStatus.balanceBefore, fallback.balanceBefore),
    lastUpdatedAt: String(safeStatus.lastUpdatedAt || fallback.lastUpdatedAt || ""),
    lowCredit:
      typeof safeStatus.lowCredit === "boolean"
        ? safeStatus.lowCredit
        : normalizeNullableNumber(safeStatus.balanceAfter, fallback.balanceAfter) !== null &&
            normalizeNullableNumber(safeStatus.balanceAfter, fallback.balanceAfter) < getLowCreditThreshold(safeStatus),
    lowCreditThreshold: getLowCreditThreshold(safeStatus),
    perMessage: normalizeNullableNumber(safeStatus.perMessage, fallback.perMessage),
    provider: String(safeStatus.provider || fallback.provider),
    recipientCount: normalizeNullableNumber(safeStatus.recipientCount, fallback.recipientCount),
    segmentsPerMessage: normalizeNullableNumber(safeStatus.segmentsPerMessage, fallback.segmentsPerMessage),
    totalCost: normalizeNullableNumber(safeStatus.totalCost, fallback.totalCost),
  };
}

function getLowCreditThreshold(status) {
  const value = Number.parseInt(String(status?.lowCreditThreshold ?? 100), 10);
  return Number.isFinite(value) ? value : 100;
}

function normalizeNullableNumber(value, fallback = null) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
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

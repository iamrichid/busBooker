import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const bookingsFile = path.join(dataDir, "bookings.json");
const notificationsFile = path.join(dataDir, "notifications.log");
const bookingBlobPrefix = "bus-booker/bookings/";
const notificationBlobPrefix = "bus-booker/notifications/";

export async function ensureDataFiles() {
  if (usesBlobStorage()) {
    return;
  }

  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(bookingsFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeFile(bookingsFile, "[]\n", "utf8");
      return;
    }

    throw error;
  }
}

export async function readBookings() {
  if (usesBlobStorage()) {
    return readBookingsFromBlob();
  }

  await ensureDataFiles();
  const raw = await readFile(bookingsFile, "utf8");
  return JSON.parse(raw);
}

export async function saveBooking(booking) {
  if (usesBlobStorage()) {
    await saveBookingToBlob(booking);
    return;
  }

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

  await ensureDataFiles();
  await appendFile(notificationsFile, `${JSON.stringify(entry)}\n`, "utf8");
}

export function usesBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
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

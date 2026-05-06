import {
  assertAdminAccess,
  handleError,
  json,
  parseRequestJson,
} from "../../src/http.js";
import {
  listBookingsForAdmin,
  markBookingReturned,
  processAdminDecision,
} from "../../src/services.js";

export async function GET(request) {
  try {
    const session = assertAdminAccess(request.headers);
    const result = await listBookingsForAdmin();
    return json(
      {
        ...result.body,
        adminName: session.adminName,
      },
      result.statusCode,
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request) {
  try {
    const session = assertAdminAccess(request.headers);
    const body = await parseRequestJson(request);
    const url = new URL(request.url);
    const bookingId = url.searchParams.get("id");
    const action = url.searchParams.get("action");

    if (action === "decision") {
      const result = await processAdminDecision(bookingId, {
        ...body,
        adminName: session.adminName,
      });
      return json(result.body, result.statusCode);
    }

    if (action === "return") {
      const result = await markBookingReturned(bookingId, {
        ...body,
        adminName: session.adminName,
      });
      return json(result.body, result.statusCode);
    }

    return json({ error: "Unknown admin booking action." }, 404);
  } catch (error) {
    return handleError(error);
  }
}

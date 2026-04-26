import {
  assertAdminAccess,
  handleError,
  json,
  parseRequestJson,
} from "../../../src/http.js";
import { markBookingReturned } from "../../../src/services.js";

export async function POST(request) {
  try {
    const session = assertAdminAccess(request.headers);
    const body = await parseRequestJson(request);
    const url = new URL(request.url);
    const result = await markBookingReturned(url.searchParams.get("id"), {
      ...body,
      adminName: session.adminName,
    });
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

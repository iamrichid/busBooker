import { handleError, json, parseRequestJson } from "../src/http.js";
import { getBookingTracking, submitBookingPaymentReference } from "../src/services.js";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const result = await getBookingTracking(url.searchParams.get("code"));
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const body = await parseRequestJson(request);
    const result = await submitBookingPaymentReference(url.searchParams.get("code"), body);
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

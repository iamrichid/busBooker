import { handleError, json, parseRequestJson } from "../src/http.js";
import { submitBookingRequest } from "../src/services.js";

export async function POST(request) {
  try {
    const body = await parseRequestJson(request);
    const result = await submitBookingRequest(body);
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

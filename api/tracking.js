import { handleError, json } from "../src/http.js";
import { getBookingTracking } from "../src/services.js";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const result = await getBookingTracking(url.searchParams.get("code"));
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

import { assertFinanceAccess, handleError, json, parseRequestJson } from "../../../src/http.js";
import { confirmBookingPayment } from "../../../src/services.js";

export async function POST(request) {
  try {
    const session = assertFinanceAccess(request.headers);
    const body = await parseRequestJson(request);
    const url = new URL(request.url);
    const result = await confirmBookingPayment(url.searchParams.get("id"), {
      ...body,
      financeName: session.financeName,
    });
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

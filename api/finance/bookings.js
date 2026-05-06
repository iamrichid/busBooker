import {
  assertFinanceAccess,
  handleError,
  json,
  parseRequestJson,
} from "../../src/http.js";
import {
  confirmBookingPayment,
  listBookingsForFinance,
} from "../../src/services.js";

export async function GET(request) {
  try {
    const session = assertFinanceAccess(request.headers);
    const result = await listBookingsForFinance();
    return json(
      {
        ...result.body,
        financeName: session.financeName,
      },
      result.statusCode,
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request) {
  try {
    const session = assertFinanceAccess(request.headers);
    const body = await parseRequestJson(request);
    const url = new URL(request.url);

    if (url.searchParams.get("action") === "payment") {
      const result = await confirmBookingPayment(url.searchParams.get("id"), {
        ...body,
        financeName: session.financeName,
      });
      return json(result.body, result.statusCode);
    }

    return json({ error: "Unknown finance booking action." }, 404);
  } catch (error) {
    return handleError(error);
  }
}

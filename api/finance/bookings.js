import { assertFinanceAccess, handleError, json } from "../../src/http.js";
import { listBookingsForFinance } from "../../src/services.js";

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

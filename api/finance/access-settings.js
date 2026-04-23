import {
  assertFinanceAccess,
  handleError,
  json,
  parseRequestJson,
} from "../../src/http.js";
import {
  getAccessSettingsForFinance,
  updateAccessSettingsForFinance,
} from "../../src/services.js";

export async function GET(request) {
  try {
    assertFinanceAccess(request.headers);
    const result = await getAccessSettingsForFinance();
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request) {
  try {
    assertFinanceAccess(request.headers);
    const body = await parseRequestJson(request);
    const result = await updateAccessSettingsForFinance(body);
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

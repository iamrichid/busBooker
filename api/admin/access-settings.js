import {
  assertAdminAccess,
  handleError,
  json,
  parseRequestJson,
} from "../../src/http.js";
import {
  getAccessSettingsForAdmin,
  updateAccessSettingsForAdmin,
} from "../../src/services.js";

export async function GET(request) {
  try {
    assertAdminAccess(request.headers);
    const result = await getAccessSettingsForAdmin();
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request) {
  try {
    assertAdminAccess(request.headers);
    const body = await parseRequestJson(request);
    const result = await updateAccessSettingsForAdmin(body);
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

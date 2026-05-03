import {
  assertAdminAccess,
  handleError,
  json,
  parseRequestJson,
} from "../../src/http.js";
import {
  getTermsDocumentForAdmin,
  updateTermsDocumentForAdmin,
} from "../../src/services.js";

export async function GET(request) {
  try {
    assertAdminAccess(request.headers);
    const result = await getTermsDocumentForAdmin();
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request) {
  try {
    const session = assertAdminAccess(request.headers);
    const body = await parseRequestJson(request);
    const result = await updateTermsDocumentForAdmin({
      ...body,
      updatedBy: session.adminName,
    });
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

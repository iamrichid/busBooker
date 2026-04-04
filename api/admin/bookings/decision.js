import {
  assertAdminAccess,
  handleError,
  json,
  parseRequestJson,
} from "../../../src/http.js";
import { processAdminDecision } from "../../../src/services.js";

export async function POST(request) {
  try {
    assertAdminAccess(request.headers);
    const body = await parseRequestJson(request);
    const url = new URL(request.url);
    const result = await processAdminDecision(url.searchParams.get("id"), body);
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

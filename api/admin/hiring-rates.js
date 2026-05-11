import {
  assertAdminAccess,
  handleError,
  json,
  parseRequestJson,
} from "../../src/http.js";
import { loadHiringRatesAtStartup } from "../../src/hiring-rates.js";
import {
  getHiringRatesForAdmin,
  updateHiringRatesForAdmin,
} from "../../src/services.js";

export async function GET(request) {
  try {
    assertAdminAccess(request.headers);
    await loadHiringRatesAtStartup();
    const result = await getHiringRatesForAdmin();
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request) {
  try {
    const session = assertAdminAccess(request.headers);
    await loadHiringRatesAtStartup();
    const body = await parseRequestJson(request);
    const result = await updateHiringRatesForAdmin({
      ...body,
      updatedBy: session.adminName,
    });
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

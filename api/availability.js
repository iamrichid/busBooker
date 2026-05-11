import { handleError, json } from "../src/http.js";
import { listHiringRatesForApi, loadHiringRatesAtStartup } from "../src/hiring-rates.js";
import { listAvailability } from "../src/services.js";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("__hiring") === "1") {
      await loadHiringRatesAtStartup();
      return json(listHiringRatesForApi(), 200);
    }

    const result = await listAvailability();
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

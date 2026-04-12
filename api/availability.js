import { handleError, json } from "../src/http.js";
import { listAvailability } from "../src/services.js";

export async function GET() {
  try {
    const result = await listAvailability();
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

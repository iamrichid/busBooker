import { handleError, json } from "../src/http.js";
import { getTermsDocument } from "../src/services.js";

export async function GET() {
  try {
    const result = await getTermsDocument();
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

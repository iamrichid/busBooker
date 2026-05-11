import { handleError, json } from "../src/http.js";
import { getTermsDocument } from "../src/services.js";
import { usesBlobStorage } from "../src/storage.js";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("__health") === "1") {
      return json({
        ok: true,
        storage: usesBlobStorage() ? "vercel_blob" : "local_file",
      });
    }

    const result = await getTermsDocument();
    return json(result.body, result.statusCode);
  } catch (error) {
    return handleError(error);
  }
}

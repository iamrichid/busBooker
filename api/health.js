import { json } from "../src/http.js";
import { usesBlobStorage } from "../src/storage.js";

export function GET() {
  return json({
    ok: true,
    storage: usesBlobStorage() ? "vercel_blob" : "local_file",
  });
}

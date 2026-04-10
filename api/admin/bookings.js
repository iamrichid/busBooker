import { assertAdminAccess, handleError, json } from "../../src/http.js";
import { listBookingsForAdmin } from "../../src/services.js";

export async function GET(request) {
  try {
    const session = assertAdminAccess(request.headers);
    const result = await listBookingsForAdmin();
    return json(
      {
        ...result.body,
        adminName: session.adminName,
      },
      result.statusCode,
    );
  } catch (error) {
    return handleError(error);
  }
}

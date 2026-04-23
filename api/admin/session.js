import {
  assertAdminAccess,
  authenticateAdminCredentials,
  buildAdminSessionCookie,
  clearAdminSessionCookie,
  createAdminSession,
  handleError,
  json,
  parseRequestJson,
  shouldUseSecureCookies,
} from "../../src/http.js";

export async function POST(request) {
  try {
    const body = await parseRequestJson(request);
    await authenticateAdminCredentials(body.accessCode, body.adminName);
    const useSecureCookies = shouldUseSecureCookies(request.headers, request.url);

    const token = createAdminSession(body.adminName);
    return json(
      {
        authenticated: true,
        adminName: String(body.adminName || "").trim(),
      },
      200,
      {
        "Set-Cookie": buildAdminSessionCookie(token, { secure: useSecureCookies }),
      },
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(request) {
  try {
    const session = assertAdminAccess(request.headers);
    return json({
      adminName: session.adminName,
      authenticated: true,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request) {
  const useSecureCookies = shouldUseSecureCookies(request.headers, request.url);

  return json(
    {
      authenticated: false,
    },
    200,
    {
      "Set-Cookie": clearAdminSessionCookie({ secure: useSecureCookies }),
    },
  );
}

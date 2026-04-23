import {
  authenticateFinanceCredentials,
  assertFinanceAccess,
  buildFinanceSessionCookie,
  clearFinanceSessionCookie,
  createFinanceSession,
  handleError,
  json,
  parseRequestJson,
  shouldUseSecureCookies,
} from "../../src/http.js";

export async function POST(request) {
  try {
    const body = await parseRequestJson(request);
    await authenticateFinanceCredentials(body.accessCode, body.financeName);
    const useSecureCookies = shouldUseSecureCookies(request.headers, request.url);
    const token = createFinanceSession(body.financeName);

    return json(
      {
        authenticated: true,
        financeName: String(body.financeName || "").trim(),
      },
      200,
      {
        "Set-Cookie": buildFinanceSessionCookie(token, { secure: useSecureCookies }),
      },
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(request) {
  try {
    const session = assertFinanceAccess(request.headers);
    return json({
      authenticated: true,
      financeName: session.financeName,
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
      "Set-Cookie": clearFinanceSessionCookie({ secure: useSecureCookies }),
    },
  );
}

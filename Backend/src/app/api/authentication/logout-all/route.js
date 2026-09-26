import { clearSessionCookie, requireAuth, revokeSession } from "@/app/lib/authentication/session";
import { errorResponse, printExceptionLog, successResponse } from "@/app/lib/utils";

export async function POST() {
  try {
    const { session, response } = await requireAuth();

    if (response) return response;

    await revokeSession(session.userId);
    await clearSessionCookie();

    return successResponse({}, 200);
  } catch (err) {
    printExceptionLog("POST /api/authentication/logout-all", err);

    return errorResponse("Internal Server Error", 500);
  }
}

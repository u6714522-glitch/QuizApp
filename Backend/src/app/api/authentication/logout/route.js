import { clearSessionCookie } from "@/app/lib/authentication/session";
import { printExceptionLog, successResponse, errorResponse } from "@/app/lib/utils";

export async function POST() {
  try {
    await clearSessionCookie();

    return successResponse({}, 200);
  } catch (err) {
    printExceptionLog("POST /api/authentication/logout", err);

    return errorResponse("Internal Server Error", 500);
  }
}

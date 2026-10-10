import { errorResponse, successResponse, printExceptionLog } from "@/app/lib/utils";
import { requireAuth } from "@/app/lib/authentication/session";

function noStore(response) {
  response.headers.set("Cache-Control", "no-store");

  return response;
}

export async function GET() {
  try {
    const { session, response } = await requireAuth();
    if (response) return noStore(response);
    const { user } = session;

    return noStore(
      successResponse(
        {
          user: {
            id: session.userId,
            name: user.name,
            email: session.email,
            role: session.role,
            canInviteInstructors:
              session.role === "instructor" && user.canInviteInstructors === true,
          },
        },
        200,
      ),
    );
  } catch (error) {
    printExceptionLog("GET /api/me", error);

    return noStore(errorResponse("Internal Server Error", 500, "INTERNAL_ERROR"));
  }
}
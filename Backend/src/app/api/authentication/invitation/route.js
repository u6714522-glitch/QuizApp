import { getClientPromise } from "@/app/lib/mongodb";
import { hashInvitationToken, invitationStatus } from "@/app/lib/invitations";
import { invitationTokenSchema } from "@/app/lib/validation/invitation";
import { errorResponse, successResponse, printExceptionLog } from "@/app/lib/utils";

function noStore(response) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");

  return response;
}

export async function GET(request) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    const parsed = invitationTokenSchema.safeParse(token);

    if (!parsed.success) {
      return noStore(errorResponse("Invalid invitation token.", 400, "INVALID_INVITATION"));
    }

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);
    const tokenHash = hashInvitationToken(parsed.data);
    const invitation = await db.collection("invitations").findOne({ tokenHash });
    const state = invitationStatus(invitation);

    if (state === "invalid" || !invitation.userId) {
      return noStore(errorResponse("Invitation not found.", 404, "INVITATION_NOT_FOUND"));
    }

    if (state === "used") {
      return noStore(errorResponse("This invitation has already been used.", 410, "INVITATION_USED"));
    }

    if (state === "expired") {
      return noStore(errorResponse("This invitation has expired.", 410, "INVITATION_EXPIRED"));
    }

    const registered = await db.collection("users").findOne(
      { _id: invitation.userId },
      { projection: { _id: 1 } },
    );

    if (registered) {
      return noStore(errorResponse("This invitation has already been used.", 410, "INVITATION_USED"));
    }

    return noStore(
      successResponse(
        {
          invitation: {
            email: invitation.email,
            role: "instructor",
            expiresAt: new Date(invitation.expiresAt).toISOString(),
          },
        },
        200,
      ),
    );
  } catch (error) {
    printExceptionLog("GET /api/authentication/invitation", error);

    return noStore(errorResponse("Internal Server Error", 500, "INTERNAL_ERROR"));
  }
}
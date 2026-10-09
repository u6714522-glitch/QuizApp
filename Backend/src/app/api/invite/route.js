import { ObjectId } from "mongodb";
import { getClientPromise } from "@/app/lib/mongodb";
import { requireAdmin } from "@/app/lib/authentication/session";
import { errorResponse, successResponse, printExceptionLog } from "@/app/lib/utils";
import { INVITE_TTL_DAYS, hasInviteToken, newInviteToken } from "@/app/lib/invites";
import { createInviteSchema } from "@/app/lib/validation";

export async function POST(request) {
  try {
    const { session, response } = await requireAdmin(request, "admin");
    if (response) return response;

    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const parsed = createInviteSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Invalid JSON body", 400);
    const { email } = parsed.data;

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const existing = await db
      .collection("invites")
      .findOne({ email }, { collation: { locale: "en", strength: 2 }, projection: { _id: 1 } });

    if (existing) return errorResponse("Invite already exists", 400);

    const invites = db.collection("invites");

    await invites.deleteMany;

    const token = newInviteToken();
    const now = new Date();

    const invite = {
      email,
      tokenHash: hasInviteToken(token),
      invitedBy: new ObjectId(session.user.id),
      createdAt: now,
      expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      usedAt: null,
      usedBy: null,
    };

    await invites.insertOne(invite);

    const frontendUrl = (process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN ?? "").replace(
      /\/$/,
      "",
    );

    const link = `${frontendUrl}/web-page/register?invite=${encodeURIComponent(token)}`;

    return successResponse(
      {
        invite: { ide: invite._id.toString(), email, expiresAt: invite.expiresAt },
        link,
        emailSent: false,
      },
      201,
    );
  } catch (err) {
    printExceptionLog("POST /api/invite", err);

    return errorResponse("Internal Server Error", 500);
  }
}

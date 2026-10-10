import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";
import { getClientPromise } from "@/app/lib/mongodb";
import { issueSession } from "@/app/lib/authentication/session";
import { hashInvitationToken, invitationStatus } from "@/app/lib/invitations";
import { registerInstructorSchema } from "@/app/lib/validation/invitation";
import { errorResponse, successResponse, printExceptionLog } from "@/app/lib/utils";

function noStore(response) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");

  return response;
}

function fail(message, status, code) {
  return noStore(errorResponse(message, status, code));
}

export async function POST(request) {
  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return fail("Invalid JSON.", 400, "VALIDATION_ERROR");
    }

    const parsed = registerInstructorSchema.safeParse(body);

    if (!parsed.success) {
      return fail(parsed.error.issues[0].message, 400, "VALIDATION_ERROR");
    }

    const { name, email, password, token } = parsed.data;
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);
    const users = db.collection("users");
    const invitations = db.collection("invitations");
    const invitation = await invitations.findOne({ tokenHash: hashInvitationToken(token) });
    const state = invitationStatus(invitation);

    if (state === "invalid" || !(invitation.userId instanceof ObjectId)) {
      return fail("Invitation not found.", 404, "INVITATION_NOT_FOUND");
    }

    if (state === "used") {
      return fail("This invitation has already been used.", 410, "INVITATION_USED");
    }

    if (state === "expired") {
      return fail("This invitation has expired.", 410, "INVITATION_EXPIRED");
    }

    if (email !== invitation.email) {
      return fail("Use the email address specified in the invitation.", 400, "EMAIL_MISMATCH");
    }

    if (await users.findOne({ _id: invitation.userId }, { projection: { _id: 1 } })) {
      return fail("This invitation has already been used.", 410, "INVITATION_USED");
    }

    if (await users.findOne({ email }, { projection: { _id: 1 } })) {
      return fail("Email is already registered. Please sign in.", 409, "EMAIL_EXISTS");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    if (invitationStatus(invitation) === "expired") {
      return fail("This invitation has expired.", 410, "INVITATION_EXPIRED");
    }

    const now = new Date();

    const user = {
      _id: invitation.userId,
      name,
      email,
      password: passwordHash,
      role: "instructor",
      tokenVersion: 0,
      createdAt: now,
      updatedAt: now,
    };

    try {
      // The reserved _id allows only one account per invitation.
      await users.insertOne(user);
    } catch (error) {
      if (error.code !== 11000) throw error;

      const registered = await users.findOne(
        { _id: invitation.userId },
        { projection: { _id: 1 } },
      );

      if (registered) {
        return fail("This invitation has already been used.", 410, "INVITATION_USED");
      }

      return fail("Email is already registered. Please sign in.", 409, "EMAIL_EXISTS");
    }

    try {
      await invitations.updateOne(
        { _id: invitation._id, usedAt: null },
        { $set: { usedAt: now } },
      );
    } catch (error) {
      // The existing account also prevents reuse if this update fails.
      printExceptionLog("Mark instructor invitation used", error);
    }

    let requiresLogin = false;

    try {
      await issueSession(user);
    } catch (error) {
      requiresLogin = true;
      printExceptionLog("Create instructor session", error);
    }

    return noStore(
      successResponse(
        {
          user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
          requiresLogin,
        },
        201,
      ),
    );
  } catch (error) {
    printExceptionLog("POST /api/authentication/register-instructor", error);

    return fail("Internal Server Error", 500, "INTERNAL_ERROR");
  }
}
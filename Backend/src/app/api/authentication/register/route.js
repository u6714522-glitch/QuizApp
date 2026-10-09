import bcrypt from "bcrypt";
import { getClientPromise } from "@/app/lib/mongodb";
import { errorResponse, successResponse, printExceptionLog } from "@/app/lib/utils";
import { registerSchema } from "@/app/lib/validation/authentication";
import { issueSession } from "@/app/lib/authentication/session";
import { hashInviteToken } from "@/app/lib/invites";

export async function POST(request) {
  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON. Request body must be valid JSON.", 400);
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 400);
    const { name, email, password, inviteToken } = parsed.data;

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);
    const users = db.collection("users");
    const invites = db.collection("invites");

    const now = new Date();

    // Check and use up the invite in one atomic step, so a link only works once.
    let invite = null;

    if (inviteToken) {
      invite = await invites.findOneAndUpdate(
        {
          tokenHash: hashInviteToken(inviteToken),
          email: email.toLowerCase(),
          usedAt: null,
          expiresAt: { $gt: now },
        },
        { $set: { usedAt: now } },
        { returnDocument: "after" },
      );

      if (!invite) {
        return errorResponse(
          "This invitation link is invalid, expired, already used, or was sent to a different email",
          400,
        );
      }
    }

    const doc = {
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: invite ? "instructor" : "student", // decided by the server, never the request
      tokenVersion: 0,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await users.insertOne(doc); // adds doc._id
    } catch (err) {
      // Account creation failed, so give the invite back.
      if (invite) await invites.updateOne({ _id: invite._id }, { $set: { usedAt: null } });
      if (err.code === 11000) return errorResponse("Email is already registered", 409);
      throw err;
    }

    if (invite) await invites.updateOne({ _id: invite._id }, { $set: { usedBy: doc._id } });

    await issueSession(doc);

    return successResponse(
      { user: { id: doc._id.toString(), name: doc.name, email: doc.email, role: doc.role } },
      201,
    );
  } catch (err) {
    printExceptionLog("POST /api/authentication/register", err);

    return errorResponse("Internal Server Error", 500);
  }
}

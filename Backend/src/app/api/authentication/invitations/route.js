import { ObjectId } from "mongodb";
import { z } from "zod";
import { getClientPromise } from "@/app/lib/mongodb";
import { requireAuth } from "@/app/lib/authentication/session";
import {
  createInvitationToken,
  hashInvitationToken,
  INVITATION_TTL_MS,
} from "@/app/lib/invitations";
import { errorResponse, successResponse, printExceptionLog } from "@/app/lib/utils";

const createInvitationSchema = z.object({
  email: z.string().trim().email("Invalid email address.").max(254),
}).strict();

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
    const { session, response } = await requireAuth();
    if (response) return noStore(response);

    if (session.role !== "instructor" || session.user.canInviteInstructors !== true) {
      return fail("You do not have permission to invite instructors.", 403, "FORBIDDEN");
    }

    const origin = request.headers.get("origin");
    const frontendOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

    if (origin && origin !== frontendOrigin && origin !== request.nextUrl.origin) {
      return fail("Request origin is not allowed.", 403, "FORBIDDEN");
    }

    const contentType = (request.headers.get("content-type") || "")
      .split(";")[0].trim().toLowerCase();

    if (contentType !== "application/json") {
      return fail("Content-Type must be application/json.", 415, "UNSUPPORTED_MEDIA_TYPE");
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return fail("Invalid JSON.", 400, "VALIDATION_ERROR");
    }

    const parsed = createInvitationSchema.safeParse(body);

    if (!parsed.success) {
      return fail(parsed.error.issues[0].message, 400, "VALIDATION_ERROR");
    }

    const { email } = parsed.data;
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);
    const users = db.collection("users");
    const invitations = db.collection("invitations");

    if (await users.findOne({ email }, { projection: { _id: 1 } })) {
      return fail("This email already has an account.", 409, "EMAIL_EXISTS");
    }

    await users.createIndex({ email: 1 }, { unique: true });
    await invitations.createIndex({ tokenHash: 1 }, { unique: true });

    const token = createInvitationToken();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + INVITATION_TTL_MS);

    await invitations.insertOne({
      email,
      role: "instructor",
      userId: new ObjectId(),
      tokenHash: hashInvitationToken(token),
      createdBy: new ObjectId(session.userId),
      createdAt,
      expiresAt,
      usedAt: null,
    });

    return noStore(
      successResponse(
        {
          invitation: {
            email,
            role: "instructor",
            expiresAt: expiresAt.toISOString(),
          },
          token,
        },
        201,
      ),
    );
  } catch (error) {
    printExceptionLog("POST /api/authentication/invitations", error);

    return fail("Internal Server Error", 500, "INTERNAL_ERROR");
  }
}
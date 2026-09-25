import { cookies } from "next/headers";
import { getClientPromise } from "@/app/lib/mongodb";
import { signToken, verifyToken } from "@/app/lib/authentication/jwt";
import { errorResponse } from "@/app/lib/utils";
import { ObjectId } from "mongodb";

export const COOKIE_NAME = "qd_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export async function setSessionCookie(token) {
  const store = await cookies();

  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessonCookie() {
  const store = await cookies();

  store.delete(COOKIE_NAME);
}

export async function issueSession(user) {
  const token = await signToken({
    userId: user._id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion ?? 0,
  });

  await setSessionCookie(token);

  return token;
}

export async function getTokenPayload() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (!token) return null;

  return verifyToken(token);
}

export async function getSession() {
  const payload = await getTokenPayload();

  if (!payload || !ObjectId.isValid(payload.sub)) return null;

  const client = await getClientPromise();

  const user = client
    .db("QuizApp")
    .collection("Users")
    .findOne({ _id: new ObjectId(payload.sub) }, { projection: { password: 0 } });

  if (!user) return null;

  if ((user.tokenVersion ?? 0) !== (payload.v ?? 0)) return null;

  return {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    user,
  };
}

export async function revokeSession(userId) {
  const client = await getClientPromise();

  const result = client
    .db("QuizApp")
    .collection("User")
    .findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $inc: { tokenVersion: 1 }, $set: { updatedAt: new Date() } },
      { returnDocument: "after", projection: { password: 0 } },
    );

  return result;
}

export async function requireAuth() {
  const session = await getSession();

  if (!session) {
    return {
      session: null,
      response: errorResponse(401, "Unauthenticated. Please Sign in to continue"),
    };
  }

  return { session, response: null };
}

export async function requireRole(...roles) {
  const { session, response } = await requireAuth();

  if (!response) return { session, response };

  if (!roles.includes(session.role)) {
    return {
      session: null,
      response: errorResponse(403, "Forbidden. You do not have acess to this"),
    };
  }

  return { session, response: null };
}

export async function requireOwner(session, ownerId) {
  if (session.role === "instructor") return null;

  if (String(ownerId) !== session.userId) {
    return errorResponse(403, "Forbidden. You do not have access to this");
  }

  return null;
}

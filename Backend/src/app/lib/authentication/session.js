import { getClientPromise } from "@/app/lib/mongodb";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { errorResponse } from "@/app/lib/utils";
import { signToken, verifyToken } from "@/app/lib/authentication/jwt";

export const COOKIE_NAME = "qd_session";
const MAX_AGE = 60 * 60 * 24 * 7;

async function usersCollection() {
  const client = await getClientPromise();

  return client.db(process.env.DB_NAME).collection("users");
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.COOKIE_SAMESTIE ?? "lax",
    path: "/",
  }
}

export async function setSessionCookie(token) {
  const store = await cookies();

  store.set(COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();

  store.delete(COOKIE_NAME);
}

export async function issueSession(user)  {
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

  const users = await usersCollection();

  const user = await users.findOne(
    { _id: new ObjectId(payload.sub) },
    { projection: {password:0} },
  );

  if (!user) return null;
  if((user.tokenVersion ?? 0) !== (payload.v ?? 0)) return null;

  return {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    user,
  };
}

export async function revokeSession(userId) {
  const users = await usersCollection();

  return users.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $inc: {tokenVersion: 1}, $set: {updatedAt: new Date()} },
    { returnDocument: "after", projection: {password:0} }
  );
}

export async function requireAuth() {
  const session = await getSession();

  if (!session) {
    return {
      session: null,
      response: errorResponse("Unauthenticated. Please Sign In to continue.", 401),
    };
  }

  return { session, response: null };
}

export async function requireRole(...roles) {
  const { session, response } = await requireAuth()
  
  if (response) return { session: null, response };
  if (!roles.includes(session.role)) return { session: null, response: errorResponse("Unauthorized. You do not have permission to access this resource.", 403) };
  
  return { session, response:null }
}

export function requireOwner(session, ownerId) {
  if (String(ownerId) !== session.userId) {
    return { response: errorResponse("You do not have access to this", 403)};
  }
  
  return { response: null };
}

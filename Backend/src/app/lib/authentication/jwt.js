import { SignJWT, jwtVerify } from "jose";
import { printExceptionLog } from "@/app/lib/utils";

if (!process.env.JWT_SECRET) throw new Error("Missing JWT_SECRET in .env.local");

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function signToken({ userId, email, role, tokenVersion }) {
  return new SignJWT({ email, role, v: tokenVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret);

    return payload;
  } catch (error) {
    printExceptionLog("Can not verify token", error.message);

    return null;
  }
}

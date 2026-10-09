import { createHash, randomBytes } from "node:crypto";

export const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

export function createInvitationToken() {
  return randomBytes(32).toString("hex");
}

export function hashInvitationToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationStatus(invitation, now = Date.now()) {
  if (!invitation || invitation.role !== "instructor") return "invalid";
  if (invitation.usedAt) return "used";

  const expiresAt = new Date(invitation.expiresAt).getTime();

  if (!Number.isFinite(expiresAt) || expiresAt <= now) return "expired";

  return "valid";
}
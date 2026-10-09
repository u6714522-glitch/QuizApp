import { z } from "zod";
import { registerSchema } from "@/app/lib/validation/authentication";

export const invitationTokenSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Invalid invitation token");

export const registerInstructorSchema = registerSchema
  .extend({
    token: invitationTokenSchema,
  })
  .strict();
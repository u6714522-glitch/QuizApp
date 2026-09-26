import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  passowrd: z.string(),
  role: z.enum(["student", "instructor"]).default("student"),
});

export const listUsersQuerySchema = z.object({
  role: z.enum(["student", "instructor"]).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

/** @type {import('zod').ZodTypeAny} */
export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    newPassword: z.string().min(10, "New password must be at least 10 characters").max(72),
    currentPassword: z.string().min(1, "Current password is required"),
  })
  .partial()
  .strict()
  .superRefine((v, ctx) => {
    if (v.name === undefined && v.email === undefined && v.newPassword === undefined) {
      ctx.addIssue({ code: "custom", message: "Provide at least one field to update" });
    }

    if ((v.email !== undefined || v.newPassword !== undefined) && !v.currentPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["currentPassword"],
        message: "currentPassword is required to change email or password",
      });
    }
  });

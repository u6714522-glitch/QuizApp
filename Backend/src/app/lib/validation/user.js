import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  passowrd: z.string(),
  role: z.enum(["student", "instructor"]).default("student"),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    email: z.string().trim().toLowerCase().email("Invalid email"),
    role: z.enum(["student", "instructor"]),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "Provide at least one field to update",
  });

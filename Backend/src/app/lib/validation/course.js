import { z } from "zod";

// "csx 4107" is rejected, "csx4107" becomes "CSX4107".
export const courseCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{2,20}$/, "Course code must be 2-20 letters, digits or dashes");

const name = z.string().trim().min(1, "Course name is required").max(120);

export const courseCreateSchema = z.object({ code: courseCode, name }).strict();

// The code is fixed after creation because quizzes reference it.
export const courseUpdateSchema = z.object({ name }).strict();

export const addStudentsSchema = z
  .object({
    emails: z
      .array(z.string().trim().email("Invalid email address"))
      .min(1, "Add at least one email")
      .max(200, "Add at most 200 students at a time"),
  })
  .strict();

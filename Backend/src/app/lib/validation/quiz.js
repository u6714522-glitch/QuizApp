import { z } from "zod";
import { courseCode } from "@/app/lib/validation/course";

export const QUIZ_STATUSES = ["draft", "published", "closed"];

const title = z.string().trim().min(1, "Title is required").max(120);
const description = z.string().trim().max(1000);
const subject = z.string().trim().min(1, "Subject is required").max(120);
const timeLimitMinutes = z.number().int().min(0).max(180); // 0 = untimed
const passingScore = z.number().min(0).max(100);
const date = z.coerce.date(); // accepts ISO strings from JSON

export const quizCreateSchema = z
  .object({
    title,
    description: description.default(""),
    subject,
    courseCode: courseCode.nullable().default(null), // null = all students
    timeLimitMinutes: timeLimitMinutes.default(0),
    opensAt: date.optional(),
    closesAt: date.optional(),
    passingScore: passingScore.default(50),
  })
  .strict()
  .refine((d) => !d.opensAt || !d.closesAt || d.closesAt > d.opensAt, {
    message: "closesAt must be after opensAt",
    path: ["closesAt"],
  });

/** @type {import('zod').ZodTypeAny} */
export const quizUpdateSchema = z
  .object({
    title,
    description,
    subject,
    courseCode: courseCode.nullable(),
    timeLimitMinutes,
    opensAt: date.nullable(),
    closesAt: date.nullable(),
    passingScore,
    status: z.enum(QUIZ_STATUSES),
  })
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: "Provide at least one field to update" });

import { z } from "zod";

const title = z.string().trim().min(1, "Title is required").max(120);
const description = z.string().trim().max(1000);
const timeLimitMinutes = z.number().int().min(1).max(180);

export const quizCreateSchema = z
  .object({
    title,
    description: description.optional(),
    subject: z.string().trim().min(1, "Subject is required").max(120),
    ownerID: z.string().trim().min(1, "Owner ID is required").max(120),
    openAt: z.date(),
    closeAt: z.date().optional(),
    passingScore: z.number(),
    createdAt: z.date(),
    updatedAt: z.date(),
    timeLimitMinutes,
  })
  .strict();

/** @type {import('zod').ZodTypeAny} */
export const quizUpdateSchema = z
  .object({
    title,
    description: description.optional(),
    subject: z.string().trim().min(1, "Subject is required").max(120),
    availability: z.date(),
    passingScore: z.number(),
    timeLimitMinutes,
    isPublished: z.boolean(),
    updateAt: z.date(),
  })
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: "Provide at least one field to update" });

import { z } from "zod";
import { ObjectId } from "mongodb";

const objectIdField = z.instanceof(ObjectId);

export const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const ATTEMPT_STATUS = z.enum(["in_progress", "submitted", "graded"]);

export const attemptAnswerSchema = z
  .object({
    questionId: objectIdField,
    given: z.string().nullable(),
    isCorrect: z.boolean().nullable(),
    pointsAwarded: z.number().min(0).nullable(),
  })
  .strict();

/** @type {import('zod').ZodTypeAny} */
export const attemptSchema = z
  .object({
    _id: objectIdField.optional(),
    quizId: objectIdField,
    studentId: objectIdField,
    answers: z.array(attemptAnswerSchema),
    startedAt: z.date(),
    submittedAt: z.date().nullable(),
    score: z.number().min(0).nullable(),
    maxScore: z.number().min(0),
    status: ATTEMPT_STATUS,
    createdAt: z.date(),
    updatedAt: z.date().nullable(),
  })
  .strict()
  .superRefine((a, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: "custom", path: [path], message });

    if (a.status === "in_progress") {
      if (a.submittedAt !== null) issue("submittedAt", "An in-progress attempt has no submittedAt");
      if (a.score !== null) issue("score", "An in-progress attempt has no score");
    } else if (!a.submittedAt) {
      issue("submittedAt", `A ${a.status} attempt must have submittedAt`);
    }

    if (a.status === "graded") {
      if (a.score === null) issue("score", "A graded attempt must have a score");

      if (a.answers.some((x) => x.isCorrect === null || x.pointsAwarded === null)) {
        issue("answers", "Every answer in a graded attempt must be graded");
      }
    }

    if (a.score !== null && a.score > a.maxScore) issue("score", "score cannot exceed maxScore");
    if (a.submittedAt && a.submittedAt < a.startedAt)
      issue("submittedAt", "submittedAt is before startedAt");
  });

export const startAttemptSchema = z
  .object({
    quizId: objectIdString,
  })
  .strict();

/** @type {import('zod').ZodTypeAny} */
export const updateAttemptSchema = z
  .object({
    action: z.enum(["save", "submit"]),
    answers: z
      .array(
        z
          .object({
            questionId: objectIdString,
            given: z.string().trim().max(2000).nullable(),
          })
          .strict(),
      )
      .max(200)
      .default([]),
  })
  .strict()
  .refine((d) => new Set(d.answers.map((a) => a.questionId)).size === d.answers.length, {
    message: "Duplicate questionId in answers",
    path: ["answers"],
  });

export const listAttemptsQuerySchema = z.object({
  quizId: objectIdString.optional(),
});

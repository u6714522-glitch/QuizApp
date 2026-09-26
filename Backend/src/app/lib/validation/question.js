import { z } from "zod";

const questionTypes = ["multiple_choice", "true_false", "short_answer"];

const fields = {
  prompt: z.string().trim().min(1, "Prompt is required"),
  points: z.number().int().min(0).max(100),
  explanation: z.string().trim().max(2000),
  order: z.number().int().min(1)
};

const choiceSchema = z.object({
  key: z.string().trim().min(1).max(10),
  text: z.string().trim().min(1).max(500),
});

const common = {
  prompt: fields.prompt,
  points: fields.points.default(1),
  explanation: fields.explanation.default(""),
  order: fields.order.optional(),
}

export const questionSchema = z.discriminatedUnion("type",[
  z.object({
    ...common,
    type: z.literal("multiple_choice"),
    choices: z.array(choiceSchema).min(2, "At least 2 choices").max(10),
    correctAnswer: z.string().trim().min(1, "correctAnswer is required"),
  }),
  z.object({
    ...common,
    type: z.literal("true_false"),
    correctAnswer: z.union([z.boolean(), z.enum(["true", "false"])],{
      message: "correctAnswer must be true or false",
    }).transform((v) => String(v)),
  }),
  z.object({
    ...common,
    type: z.literal("short_answer"),
    correctAnswer: z.string().trim().min(1, "correctAnswer is required").max(200),
  })
]).superRefine((q, ctx) => {
  if (q.type !== "multiple_choice") return;
  const keys = q.choices.map((c) => c.key);

  if (new Set(keys).size !== keys.length) {
    ctx.addIssue({ code: "custom", path: ["choices"], message: "Choice keys must be unique"});
  }

  if (!keys.includes(q.correctAnswer)) {
    ctx.addIssue({code: "custom", path: ["correctAnswer"], message: "correctAnswer must match a choice key"});
  }
});

/** @type {import('zod').ZodTypeAny} */
export const questionPatchSchema = z.object({
  type: z.enum(questionTypes),
  prompt: fields.prompt,
  choices: z.array(choiceSchema).max(10),
  correctAnswer: z.union([z.string().trim().min(1).max(200), z.boolean()]),
  points: fields.points,
  explanation: fields.explanation,
  order: fields. order
})
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: "Provide at least one field to update" })

export const EDITABLE_FIELDS = ["type", "prompt", "choices", "correctAnswer", "points", "explanation", "order"];

export function toQuestionDoc(q) {
  return {
    type: q.type,
    prompt: q.prompt,
    choices: q.type === "multiple_choice" ? q.choices: [],
    correctAnswer: q.correctAnswer,
    points: q.points,
    explanation: q.explanation,
    order: q.order
  };
}

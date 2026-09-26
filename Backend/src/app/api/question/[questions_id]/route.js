import { getClientPromise } from "@/app/lib/mongodb";
import { quizAccess, READER_PROJECTION } from "@/app/lib/questions";
import { errorResponse, printExceptionLog, successResponse } from "@/app/lib/utils";
import { parseObjectId } from "@/app/lib/params";
import { serializeQuestion } from "@/app/lib/api";
import { requireAuth, requireOwner, requireRole } from "@/app/lib/authentication/session";
import {
  EDITABLE_FIELDS,
  questionPatchSchema,
  questionSchema,
  toQuestionDoc,
} from "@/app/lib/validation/question";
import corsHeaders from "@/app/lib/cors";

async function loadQuestionAndQuiz(db, id) {
  const question = await db.collection("questions").findOne({ _id: id });
  if (!question) return {};

  const quiz = await db
    .collection("quizzes")
    .findOne(
      { _id: question.quizId },
      { projection: { ownerId: 1, status: 1, opensAt: 1, closesAt: 1 } },
    );

  return { question, quiz };
}

export async function GET(request, { params }) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;

    const id = await parseObjectId(params, "questions_id");
    if (!id) return errorResponse("Invalid question id", 400);

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { question, quiz } = await loadQuestionAndQuiz(db, id);
    const access = quiz && quizAccess(session, quiz);
    if (!access) return errorResponse("Question not found", 404);

    if (access === "reader") {
      for (const key of Object.keys(READER_PROJECTION)) delete question[key];
    }

    return successResponse({ question: serializeQuestion(question) }, 200);
  } catch (err) {
    printExceptionLog("GET /api/question/[questions_id]", err);

    return errorResponse("Internal Server Error", 500);
  }
}

export async function PUT(request, { params }) {
  try {
    const { session, response } = await requireRole("instructor");
    if (response) return response;

    const id = await parseObjectId(params, "questions_id");
    if (!id) return errorResponse("Invalid question id", 400);

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { question, quiz } = await loadQuestionAndQuiz(db, id);
    if (!quiz) return errorResponse("Question not found", 404);

    const { response: denied } = requireOwner(session, quiz.ownerId);
    if (denied) return denied;

    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON", 400);
    }

    const parsed = questionPatchSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 400);

    // Merge with the stored question and re-validate the whole thing,
    // so e.g. a new correctAnswer must still match a choice key.
    const current = Object.fromEntries(EDITABLE_FIELDS.map((k) => [k, question[k]]));
    const merged = questionSchema.safeParse({ ...current, ...parsed.data });
    if (!merged.success) return errorResponse(merged.error.issues[0].message, 400);

    const updated = await db
      .collection("questions")
      .findOneAndUpdate(
        { _id: id },
        {
          $set: {
            ...toQuestionDoc(merged.data),
            order: merged.data.order ?? question.order,
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" },
      );

    if (!updated) return errorResponse("Question not found", 404);

    return successResponse({ question: serializeQuestion(updated) }, 200);
  } catch (err) {
    printExceptionLog("PUT /api/question/[questions_id]", err);

    return errorResponse("Internal Server Error", 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { session, response } = await requireRole("instructor");
    if (response) return response;

    const id = await parseObjectId(params, "questions_id");
    if (!id) return errorResponse("Invalid question id", 400);

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { quiz } = await loadQuestionAndQuiz(db, id);
    if (!quiz) return errorResponse("Question not found", 404);

    const { response: denied } = requireOwner(session, quiz.ownerId);
    if (denied) return denied;

    await db.collection("questions").deleteOne({ _id: id });

    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (err) {
    printExceptionLog("DELETE /api/question/[questions_id]", err);

    return errorResponse("Internal Server Error", 500);
  }
}

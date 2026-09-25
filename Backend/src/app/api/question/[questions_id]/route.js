import {getClientPromise} from "@/app/lib/mongodb";
import {quizAccess, READER_PROJECTION} from "@/app/lib/questions";
import {errorResponse, printExceptionLog, successResponse} from "@/app/lib/utils";
import {parseObjectId} from "@/app/lib/params";
import {serializeQuestion} from "@/app/lib/api";
import {requireAuth, requireOwner, requireRole} from "@/app/lib/authentication/session";
import {EDITABLE_FIELDS, questionPatchSchema, questionSchema, toQuestionDoc} from "@/app/lib/validation/question";

async function loadQuestionAndQuiz(db, id) {
  const question = await db.collection("questions").findOne({ _id: id });
  if (!question) return {};

  const quiz = await db.collection("quizzes").findOne(
    { _id: question.quiId },
    { projection: {ownerId: 1, status: 1, opensAt: 1, closesAt: 1} }
  );

  return { question, quiz };
}

export async function GET(request, { params }) {
  try {
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { session, response: unauth } = await requireAuth();
    if (unauth) return unauth;

    const { id , response: badId } = await parseObjectId(params, "id");
    if (badId) return badId;

    const { question, quiz } = await loadQuestionAndQuiz(db, id);
    const access = quiz && quizAccess(session, quiz);
    if (!access) return errorResponse("Question not found", 404)

    if (access === "reader") {
      for (const key of Object.keys(READER_PROJECTION)) delete question[key];
    }

    return successResponse({ question: serializeQuestion(question) }, 200)
  } catch (err) {
    printExceptionLog("GET /api/question/[questions_id]", err.message);

    return errorResponse("Internal server error", 500)
  }
}

export async function PUT(request, { params }) {
  try {
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { session, response: notInstructor } = await requireRole("instructor");
    if (notInstructor) return notInstructor;

    const { id, response: badId } = await parseObjectId(params, "id");
    if (badId) return badId;

    const { question, quiz } = await loadQuestionAndQuiz(db, id);
    if (!quiz) return errorResponse("Question not found", 404);

    const { response: denied } = await requireOwner(quiz.ownerId)
    if (denied) return denied;

    let body;

    try{
      body = request.json();
    } catch  {
      return errorResponse("Invalid JSON", 400);
    }

    const parsed = questionPatchSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Invalid Body", 400);
    const data = parsed.data

    const current = Object.fromEntries((EDITABLE_FIELDS.map((k) => [k, question[k]])));
    const result = questionSchema.safeParse({ ...current, ...data });

    if (!result.success) {
      return errorResponse("Validation Error for the question", 400)
    }

    const updated = await db.collection("questions").findOneAndUpdate(
      { _id: id },
      {$set: { ...toQuestionDoc(result.data), order: result.data.order ?? question.order, updatedAt: new Date()} },
      { returnDocument: "after" }
    );
 
    if (!updated) return errorResponse("Question not found", 404);
    
    return successResponse({ question: serializeQuestion(updated) }, 201); 
  } catch (err) { 
    printExceptionLog("PUT /api/question/[questions_id]", err.message); 
    
    return errorResponse("Internal Server Error", 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { id, response: badId } = await parseObjectId(params, "id");
    if (badId) return badId;

    const { quiz } = await loadQuestionAndQuiz(db, id);
    if (!quiz) return errorResponse("Quiz not found", 404);

    const { response: denied } = await requireOwner(quiz.ownerId);
    if (denied) return denied;

    const deleted = await db.collection("questions").deleteOne({ _id: id });
    if (deleted.deletedCount === 0) return errorResponse("Question not found", 404);

    return successResponse({ message: serializeQuestion(deleted) }, 204);
  } catch (err) {
    printExceptionLog("DELETE /api/question/[questions_id]", err.message);

    return errorResponse("Internal Server Error", 500);
  }
}

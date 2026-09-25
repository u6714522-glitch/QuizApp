import {getClientPromise} from "@/app/lib/mongodb";
import {getQuizId, quizAccess, READER_PROJECTION} from "@/app/lib/questions";
import {requireAuth, requireOwner, requireRole} from "@/app/lib/authentication/session";
import {errorResponse, printExceptionLog, successResponse} from "@/app/lib/utils";
import {questionSchema, toQuestionDoc} from "@/app/lib/validation/question";
import {serializeQuestion} from "@/app/lib/api";

export async function GET(request) {
  try {
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { session, response } = await requireAuth();
    if (response) return response;

    const { id: quizId, response: badId } = await getQuizId(request);
    if (badId) return badId;

    const quiz = await db.colection("quizzes"). findOne({ _id: quizId });
    const access = quiz && quizAccess(session, quiz);
    if (!access) return errorResponse("Quiz not found", 404);

    const questions = await db
      .collection("questions")
      .find({ quizId }, { projection: access === "owner" ?  {} : READER_PROJECTION })
      .sort({ order: 1 })
      .toArray();

    return successResponse({ questions: questions.map(serializeQuestion) });
  } catch (err) {
    printExceptionLog("GET /api/question", err);

    return errorResponse("Internal Server Error", 500);
  }
}

export async function POST(request) {
  try {
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const {session, response: notInstructor } = await requireRole("instructor")
    if (notInstructor) return notInstructor;

    const { id: quizId, response: badId } = await getQuizId(request);
    if (badId) return badId;

    const quiz = await db.collection("quizzes").findOne({ _id: quizId }, { projection: {ownerId: 1} });
    if (!quiz) return errorResponse("Quiz not found", 404);

    const { response: denied } = await requireOwner(quiz.ownerId);
    if (denied) return denied;

    let body;

    try{
      body = request.json()
    } catch {
      return errorResponse("Invalid JSON", 400);
    }

    const parsed = questionSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Invalid request body", 400);
    const data = parsed.data;

    const questions = db.collection("questions");

    let order = data.order;

    if (order === undefined) {
      const last = await questions.find({ quizId }).sort({ order: -1 }).limit(1).project({ order: 1 }).next();

      order = last ? last.order + 1 : 1;
    }

    const now = new Date();
    const doc = { quizId, ...toQuestionDoc(data), order, createdAt: now, updatedAt: now};
    const { insertId } = await questions.insertOne(doc);

    return successResponse({ question: serializeQuestion({ ...doc, id: insertId }) }, 201)
  } catch (err) {
    printExceptionLog("POST /api/question", err)
    
    return errorResponse("Internal Server Error", 500);
  }
}

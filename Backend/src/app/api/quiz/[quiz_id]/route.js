import { getClientPromise } from "@/app/lib/mongodb";
import { requireAuth, requireRole } from "@/app/lib/authentication/session";
import { parseObjectId } from "@/app/lib/params";
import { serializeQuiz, serializeQuestion } from "@/app/lib/api";
import { isEnrolled, ownsCourse } from "@/app/lib/courses";
import { errorResponse, successResponse, printExceptionLog } from "@/app/lib/utils";
import { quizUpdateSchema } from "@/app/lib/validation/quiz";
import corsHeaders from "@/app/lib/cors";

export async function GET(request, { params }) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;

    const quizId = await parseObjectId(params, "quiz_id");
    if (!quizId) return errorResponse("Invalid quiz id", 400);

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const quiz = await db.collection("quizzes").findOne({ _id: quizId });
    if (!quiz) return errorResponse("Quiz not found", 404);

    const isOwner = quiz.ownerId.toString() === session.userId;

    const studentCanView =
      session.role === "student" &&
      quiz.status === "published" &&
      (!quiz.courseCode || (await isEnrolled(db, session.userId, quiz.courseCode)));

    // 404 rather than 403 so drafts and other courses' quizzes aren't revealed.
    if (!isOwner && !studentCanView) return errorResponse("Quiz not found", 404);

    const hideAnswers = !isOwner || request.nextUrl.searchParams.get("for") === "attempt";

    const questions = await db
      .collection("questions")
      .find({ quizId }, hideAnswers ? { projection: { correctAnswer: 0, explanation: 0 } } : {})
      .sort({ order: 1 })
      .toArray();

    return successResponse(
      { quiz: serializeQuiz(quiz), questions: questions.map(serializeQuestion) },
      200,
    );
  } catch (err) {
    printExceptionLog("GET /api/quiz/[quiz_id]", err);

    return errorResponse("Internal Server Error", 500);
  }
}

export async function PUT(request, { params }) {
  try {
    const { session, response } = await requireRole("instructor");
    if (response) return response;

    const quizId = await parseObjectId(params, "quiz_id");
    if (!quizId) return errorResponse("Invalid quiz id", 400);

    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON", 400);
    }

    const parsed = quizUpdateSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 400);
    const data = parsed.data;

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);
    const quizzes = await db.collection("quizzes");
    const quiz = await quizzes.findOne({ _id: quizId });

    if (!quiz) return errorResponse("Quiz not found", 404);

    if (quiz.ownerId.toString() !== session.userId) {
      return errorResponse("You can only edit your own quizzes", 403);
    }

    if (data.courseCode && !(await ownsCourse(db, session.userId, data.courseCode))) {
      return errorResponse("You can only assign quizzes to your own courses", 403);
    }

    // Check the date window using the values after this update.
    const opensAt = data.opensAt !== undefined ? data.opensAt : quiz.opensAt;
    const closesAt = data.closesAt !== undefined ? data.closesAt : quiz.closesAt;

    if (opensAt && closesAt && closesAt <= opensAt) {
      return errorResponse("closesAt must be after opensAt", 400);
    }

    if (data.status === "published" && quiz.status !== "published") {
      const count = await db.collection("questions").countDocuments({ quizId }, { limit: 1 });
      if (count === 0) return errorResponse("Add at least one question before publishing", 409);
    }

    const updated = await quizzes.findOneAndUpdate(
      { _id: quizId },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: "after" },
    );

    return successResponse(serializeQuiz(updated), 200);
  } catch (err) {
    printExceptionLog("PUT /api/quiz/[quiz_id]", err);

    return errorResponse("Internal Server Error", 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { session, response } = await requireRole("instructor");
    if (response) return response;

    const quizId = await parseObjectId(params, "quiz_id");
    if (!quizId) return errorResponse("Invalid quiz id", 400);

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);
    const quizzes = await db.collection("quizzes");
    const quiz = await quizzes.findOne({ _id: quizId });

    if (!quiz) return errorResponse("Quiz not found", 404);

    if (quiz.ownerId.toString() !== session.userId) {
      return errorResponse("You can only delete your own quizzes", 403);
    }

    // Cascade: attempts and questions belong to the quiz.
    await db.collection("attempts").deleteMany({ quizId });
    await db.collection("questions").deleteMany({ quizId });
    await quizzes.deleteOne({ _id: quizId });

    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (err) {
    printExceptionLog("DELETE /api/quiz/[quiz_id]", err);

    return errorResponse("Internal Server Error", 500);
  }
}

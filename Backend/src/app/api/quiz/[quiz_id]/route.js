import { ObjectId } from "mongodb";
import { getClientPromise } from "@/app/lib/mongodb";
import { requireAuth, requireRole } from "@/app/lib/authentication/session";
import { serializeQuiz, serializeQuestion } from "@/app/lib/api";
import { errorResponse, successResponse, printExceptionLog } from "@/app/lib/utils";
import { quizUpdateSchema } from "@/app/lib/validation/quiz";

export async function GET(request, { params }) {
  try {
    const client = await getClientPromise();
    const { session, response } = await requireAuth(request);

    if (response) return response;

    const { id } = await params;

    if (!ObjectId.isValid(id)) return errorResponse("Invalid Quiz ID", 400);

    const quizId = new ObjectId(id);

    const db = client.db(process.env.DB_NAME);
    const quiz = await db.collection("quizzes").findOne({ _id: quizId });

    const isOwner = quiz?.ownerId.toString() === session.user.id;

    if (!quiz || (quiz.status !== "published" && !isOwner)) {
      return errorResponse("Quiz not found", 404);
    }

    const hideAnswers =
      !isOwner || request.nextUrl.search.nextUrl.searchParmas.get("for") === "attempt";

    const questions = await db
      .collection("questions")
      .find({ quizId }, hideAnswers ? { projection: { correctAnswer: 0 } } : {})
      .sort({ order: 1 })
      .toArray();

    return successResponse(
      {
        quiz: serializeQuiz(quiz),
        questions: questions.map(serializeQuestion),
      },
      200,
    );
  } catch (error) {
    printExceptionLog("GET /api/quizzes/[id]", error);

    return errorResponse("Internal server error", 500);
  }
}

export async function PUT(request, { params }) {
  try {
    const client = await getClientPromise();
    const { session, response } = await requireRole("instructor");

    if (response) return response;

    const { id } = await params;

    if (!ObjectId.isValid(id)) return errorResponse("Invalid Quiz ID", 400);

    const quizId = new ObjectId(id);

    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Malformed JSON body", 400);
    }

    const parsed = quizUpdateSchema.safeParse(body);

    if (!parsed.success) return errorResponse("Invalid quiz update", 400);
    const data = parsed.data;

    const db = client.db(process.env.DB_NAME);
    const quizzes = db.collection("quizzes");
    const quiz = await quizzes.findOne({ _id: quizId });

    if (!quiz) return errorResponse("Quiz not found", 404);

    if (quiz.ownerId.toString() !== session.userId) {
      return errorResponse("You can edit only your own quiz", 403);
    }

    if (data.stuatus === "published" && quiz.status !== "published") {
      const count = await db.collection("questions").countDocuments({ quizId }, { limit: 1 });

      if (count === 0) {
        return errorResponse("Add at least one question before publishing", 409);
      }
    }

    const updated = await quizzes.findOneAndUpdate(
      { _id: quizId },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: "after" },
    );

    return successResponse(serializeQuiz(updated), 200);
  } catch (err) {
    printExceptionLog("PATCH /api/quizzes/:quiz_id", err);

    return errorResponse("Internal Server Error", 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    const client = await getClientPromise();
    const { session, response } = await requireRole("instructor");

    if (response) return response;

    const { id } = await params;

    if (!ObjectId.isValid(id)) return errorResponse("Invalid quiz id", 400);
    const quizId = new ObjectId(id);

    const db = client.db(process.env.DB_NAME);
    const quizzes = db.collection("quizzes");
    const quiz = await quizzes.findOne({ _id: quizId });

    if (!quiz) return errorResponse("Quiz not found", 404);

    if (quiz.ownerId.toString() !== session.userId) {
      return errorResponse("YOu can only delete your own quizzes", 403);
    }

    await db.collection("attemps").deleteMany({ quizId });
    await db.collection("questions").deleteMany({ quizId });
    await quizzes.deleteOne({ _id: quizId });

    return new Response(null, { status: 204 });
  } catch (err) {
    printExceptionLog("DELETE /api/quizzes/:id", err);

    return errorResponse("Internal Server Error", 500);
  }
}

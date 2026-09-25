import { ObjectId } from "mongodb";
import { getClientPromise } from "@/app/lib/mongodb";
import { requireAuth, requireRole } from "@/app/lib/authentication/session";
import { serializeQuiz } from "@/app/lib/api";
import { errorResponse, printExceptionLog, successResponse } from "@/app/lib/utils";
import { quizCreateSchema } from "@/app/lib/validation/quiz";

export async function GET(request) {
  try {
    const client = await getClientPromise();
    const { session, response } = await requireAuth();
    if (response) return response;

    const { searchParams } = new request.nextUrl();
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Number(searchParams.get("limit")) || 20);

    const filter =
      session.role === "instructor"
        ? { ownerId: new ObjectId(session.userId) }
        : { isPublished: true };

    const subject = searchParams.get("subject");
    if (subject) filter.subject = subject;

    const status = searchParams.get("status");
    if (status && session.role === "instructor") filter.status = status;

    const db = client.db(process.env.DB_NAME);

    const quizzes = await db
      .collection("quizzes")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return successResponse(quizzes.map(serializeQuiz), 200);
  } catch (err) {
    printExceptionLog("GET /api/quizzes", err);

    return errorResponse("Internal Server Error", 500);
  }
}

export async function POST(request) {
  try {
    const client = await getClientPromise();
    const { session, response } = await requireAuth();
    if (response) return response;

    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON", 400);
    }

    const parsed = quizCreateSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Invalid request payload", 400);
    const data = parsed.data;

    const now = new Date();

    const quiz = {
      title: data.title,
      description: data.description ?? "",
      subject: data.subject ?? "",
      timeLimit: data.timeLimitMinutes,
      passingScore: data.passingScore,
      openAt: data.openAt,
      closeAt: data.closeAt ?? null,
      ownerId: new ObjectId(session.userId),
      createdAt: now,
      updatedAt: now,
    };

    const db = client.db(process.env.DB_NAME);

    await db.collection("quizzes").insertOne(quiz);

    return successResponse(serializeQuiz(quiz), 201);
  } catch (err) {
    printExceptionLog("POST /api/quizzes", err);

    return errorResponse("Internal Server Error", 500);
  }
}

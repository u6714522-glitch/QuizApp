import { ObjectId } from "mongodb";
import { getClientPromise } from "@/app/lib/mongodb";
import { requireAuth, requireRole } from "@/app/lib/authentication/session";
import { serializeQuiz } from "@/app/lib/api";
import { errorResponse, printExceptionLog, successResponse } from "@/app/lib/utils";
import { quizCreateSchema, QUIZ_STATUSES } from "@/app/lib/validation/quiz";

export async function GET(request) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

    // Instructors see their own quizzes; students see published ones.
    const filter =
      session.role === "instructor"
        ? { ownerId: new ObjectId(session.userId) }
        : { status: "published" };

    const subject = searchParams.get("subject");
    if (subject) filter.subject = subject;

    const status = searchParams.get("status");

    if (status && session.role === "instructor") {
      if (!QUIZ_STATUSES.includes(status)) return errorResponse("Invalid status filter", 400);
      filter.status = status;
    }

    const client = await getClientPromise();
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
    printExceptionLog("GET /api/quiz", err);

    return errorResponse("Internal Server Error", 500);
  }
}

export async function POST(request) {
  try {
    const { session, response } = await requireRole("instructor");
    if (response) return response;

    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON", 400);
    }

    const parsed = quizCreateSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 400);
    const data = parsed.data;

    const now = new Date();

    const quiz = {
      title: data.title,
      description: data.description,
      subject: data.subject,
      ownerId: new ObjectId(session.userId), // from the session, never the body
      timeLimitMinutes: data.timeLimitMinutes,
      opensAt: data.opensAt ?? null,
      closesAt: data.closesAt ?? null,
      status: "draft",
      passingScore: data.passingScore,
      createdAt: now,
      updatedAt: now,
    };

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    await db.collection("quizzes").insertOne(quiz); // adds quiz._id

    return successResponse(serializeQuiz(quiz), 201);
  } catch (err) {
    printExceptionLog("POST /api/quiz", err);

    return errorResponse("Internal Server Error", 500);
  }
}

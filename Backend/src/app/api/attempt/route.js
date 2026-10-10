import { ObjectId } from "mongodb";
import { getClientPromise } from "@/app/lib/mongodb";
import { requireAuth, requireRole } from "@/app/lib/authentication/session";
import { errorResponse, printExceptionLog, successResponse } from "@/app/lib/utils";
import { serializeAttempt } from "@/app/lib/api";
import { isEnrolled } from "@/app/lib/courses";
import {
  attemptSchema,
  listAttemptsQuerySchema,
  startAttemptSchema,
} from "@/app/lib/validation/attempt";

export async function GET(request) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;

    const parsed = listAttemptsQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    if (!parsed.success) return errorResponse("Invalid quizId", 400);
    const { quizId } = parsed.data;

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);
    const userId = new ObjectId(session.userId);
    const filter = {};

    if (session.role === "student") {
      filter.studentId = userId; // students only ever see their own
      if (quizId) filter.quizId = new ObjectId(quizId);
    } else if (quizId) {
      const quiz = await db
        .collection("quizzes")
        .findOne({ _id: new ObjectId(quizId) }, { projection: { ownerId: 1 } });

      if (!quiz) return errorResponse("Quiz not found", 404);
      if (!quiz.ownerId.equals(userId)) return errorResponse("You do not own this quiz", 403);
      filter.quizId = quiz._id;
    } else {
      const owned = await db
        .collection("quizzes")
        .find({ ownerId: userId }, { projection: { _id: 1 } })
        .toArray();

      filter.quizId = { $in: owned.map((q) => q._id) };
    }

    const items = await db
      .collection("attempts")
      .aggregate([
        { $match: filter },
        { $sort: { startedAt: -1 } },
        { $project: { answers: 0 } },
        {
          $lookup: {
            from: "users",
            localField: "studentId",
            foreignField: "_id",
            as: "student",
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        {
          $lookup: {
            from: "quizzes",
            localField: "quizId",
            foreignField: "_id",
            as: "quiz",
            pipeline: [{ $project: { title: 1 } }],
          },
        },
        { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$quiz", preserveNullAndEmptyArrays: true } },
      ])
      .toArray();

    return successResponse(items.map(serializeAttempt), 200);
  } catch (err) {
    printExceptionLog("GET /api/attempt", err);

    return errorResponse("Internal Server Error", 500);
  }
}

export async function POST(request) {
  try {
    const { session, response } = await requireRole("student");
    if (response) return response;

    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON", 400);
    }

    const parsed = startAttemptSchema.safeParse(body);
    if (!parsed.success) return errorResponse("quizId must be a valid id", 400);

    const quizId = new ObjectId(parsed.data.quizId);
    const studentId = new ObjectId(session.userId);
    const now = new Date();

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const quiz = await db.collection("quizzes").findOne({ _id: quizId });
    if (!quiz) return errorResponse("Quiz not found", 404);

    if (quiz.courseCode && !(await isEnrolled(db, session.userId, quiz.courseCode))) {
      return errorResponse("Quiz not found", 404);
    }

    if (quiz.status !== "published") return errorResponse("This quiz is not published", 409);
    if (quiz.opensAt && now < new Date(quiz.opensAt))
      return errorResponse("This quiz is not open yet", 409);
    if (quiz.closesAt && now > new Date(quiz.closesAt))
      return errorResponse("This quiz is already closed", 409);

    const questions = await db
      .collection("questions")
      .find({ quizId }, { projection: { points: 1 } })
      .toArray();

    if (questions.length === 0) return errorResponse("This quiz has no questions", 409);

    const doc = attemptSchema.parse({
      quizId,
      studentId,
      answers: [],
      startedAt: now,
      submittedAt: null,
      score: null,
      maxScore: questions.reduce((sum, q) => sum + (q.points ?? 1), 0),
      status: "in_progress",
      createdAt: now,
      updatedAt: now,
    });

    try {
      await db.collection("attempts").insertOne(doc); // adds doc._id
    } catch (err) {
      // needs the partial unique index on { quizId, studentId } where status is in_progress
      if (err.code === 11000)
        return errorResponse("You already have an attempt in progress on this quiz", 409);
      throw err;
    }

    return successResponse(serializeAttempt(doc), 201);
  } catch (err) {
    printExceptionLog("POST /api/attempt", err);

    return errorResponse("Internal Server Error", 500);
  }
}

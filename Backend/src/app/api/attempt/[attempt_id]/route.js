import { ObjectId } from "mongodb";
import { getClientPromise } from "@/app/lib/mongodb";
import { requireAuth } from "@/app/lib/authentication/session";
import { parseObjectId } from "@/app/lib/params";
import { serializeAttempt } from "@/app/lib/api";
import { attemptSchema, updateAttemptSchema } from "@/app/lib/validation/attempt";
import { gradeAttempt, isPastDeadline } from "@/app/lib/grading";
import { errorResponse, printExceptionLog, successResponse } from "@/app/lib/utils";
import corsHeaders from "@/app/lib/cors";

// Loads the attempt and its quiz, and works out who the caller is to it.
async function loadForUser(db, attemptId, session) {
  const attempt = await db.collection("attempts").findOne({ _id: attemptId });
  if (!attempt) return { response: errorResponse("Attempt not found", 404) };

  const quiz = await db.collection("quizzes").findOne({ _id: attempt.quizId });
  const isStudent = attempt.studentId.toString() === session.userId;
  const isQuizOwner = !!quiz && quiz.ownerId.toString() === session.userId;

  if (!isStudent && !isQuizOwner) {
    return { response: errorResponse("You do not have access to this attempt", 403) };
  }

  return { attempt, quiz, isStudent, isQuizOwner, response: null };
}

export async function GET(request, { params }) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;

    const id = await parseObjectId(params, "attempt_id");
    if (!id) return errorResponse("Invalid attempt id", 400);

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { attempt, response: denied } = await loadForUser(db, id, session);
    if (denied) return denied;

    const body = serializeAttempt(attempt);

    // Correct answers and explanations only once the attempt is graded.
    if (attempt.status === "graded") {
      const questions = await db
        .collection("questions")
        .find({ quizId: attempt.quizId }, { projection: { quizId: 0, createdAt: 0, updatedAt: 0 } })
        .sort({ order: 1 })
        .toArray();

      body.questions = questions.map(({ _id, ...q }) => ({ id: _id.toString(), ...q }));
    }

    return successResponse(body, 200);
  } catch (err) {
    printExceptionLog("GET /api/attempt/[attempt_id]", err);

    return errorResponse("Internal Server Error", 500);
  }
}

export async function PUT(request, { params }) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;

    const id = await parseObjectId(params, "attempt_id");
    if (!id) return errorResponse("Invalid attempt id", 400);

    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON", 400);
    }

    const parsed = updateAttemptSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 400);
    const { action, answers: incoming } = parsed.data;

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { attempt, quiz, isStudent, response: denied } = await loadForUser(db, id, session);
    if (denied) return denied;
    if (!isStudent)
      return errorResponse("Only the student who started this attempt can change it", 403);
    if (attempt.status !== "in_progress")
      return errorResponse("This attempt has already been submitted", 409);
    if (!quiz) return errorResponse("Quiz not found", 404);

    // Time limit is checked against the stored startedAt, never a client timer.
    const now = new Date();
    const expired = quiz.status !== "published" || isPastDeadline(attempt, quiz, now);
    if (action === "save" && expired) return errorResponse("Time is up for this attempt", 409);

    const questions = await db
      .collection("questions")
      .find({ quizId: attempt.quizId })
      .sort({ order: 1 })
      .toArray();

    const validIds = new Set(questions.map((q) => q._id.toString()));

    if (incoming.some((a) => !validIds.has(a.questionId))) {
      return errorResponse("Answer references a question that is not in this quiz", 400);
    }

    // New answers replace saved ones for the same question; ignored once time is up.
    const merged = new Map(attempt.answers.map((a) => [a.questionId.toString(), a]));

    if (!expired) {
      for (const a of incoming) {
        merged.set(a.questionId, {
          questionId: new ObjectId(a.questionId),
          given: a.given,
          isCorrect: null,
          pointsAwarded: null,
        });
      }
    }

    const savedAnswers = [...merged.values()];
    const attempts = db.collection("attempts");

    if (action === "save") {
      const updated = await attempts.findOneAndUpdate(
        { _id: attempt._id, status: "in_progress" },
        { $set: { answers: savedAnswers, updatedAt: now } },
        { returnDocument: "after" },
      );

      if (!updated) return errorResponse("This attempt has already been submitted", 409);

      return successResponse(serializeAttempt(updated), 200);
    }

    // Submit: grade on the server and store the result in one atomic update.
    const { answers, score, maxScore } = gradeAttempt(questions, savedAnswers);

    const graded = attemptSchema.parse({
      ...attempt,
      answers,
      score,
      maxScore,
      status: "graded",
      submittedAt: now,
      updatedAt: now,
    });

    const result = await attempts.findOneAndUpdate(
      { _id: attempt._id, status: "in_progress" }, // stops a double submit
      {
        $set: {
          answers: graded.answers,
          score: graded.score,
          maxScore: graded.maxScore,
          status: graded.status,
          submittedAt: graded.submittedAt,
          updatedAt: graded.updatedAt,
        },
      },
      { returnDocument: "after" },
    );

    if (!result) return errorResponse("This attempt has already been submitted", 409);

    return successResponse(serializeAttempt(result), 200);
  } catch (err) {
    printExceptionLog("PUT /api/attempt/[attempt_id]", err);

    return errorResponse("Internal Server Error", 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;

    const id = await parseObjectId(params, "attempt_id");
    if (!id) return errorResponse("Invalid attempt id", 400);

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const {
      attempt,
      isStudent,
      isQuizOwner,
      response: denied,
    } = await loadForUser(db, id, session);

    if (denied) return denied;

    // Proposal §5: the quiz owner can delete any attempt; the student only while in progress.
    const canDelete = isQuizOwner || (isStudent && attempt.status === "in_progress");
    if (!canDelete)
      return errorResponse("You can only discard an attempt that is still in progress", 403);

    const filter = isQuizOwner ? { _id: attempt._id } : { _id: attempt._id, status: "in_progress" };
    const { deletedCount } = await db.collection("attempts").deleteOne(filter);
    if (deletedCount === 0) return errorResponse("This attempt has already been submitted", 409);

    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (err) {
    printExceptionLog("DELETE /api/attempt/[attempt_id]", err);

    return errorResponse("Internal Server Error", 500);
  }
}

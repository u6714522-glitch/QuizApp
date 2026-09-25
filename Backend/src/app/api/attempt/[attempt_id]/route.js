import {errorResponse, printExceptionLog, successResponse} from "@/app/lib/utils";
import {getClientPromise} from "@/app/lib/mongodb";
import {requireAuth} from "@/app/lib/authentication/session";
import {parseObjectId} from "@/app/lib/params";
import {serializeAttempt} from "@/app/lib/api";
import {attemptSchema, updateAttemptSchema} from "@/app/lib/validation/attempt";
import {gradeAttempt, isPastDeadline} from "@/app/lib/grading";
import {ObjectId} from "mongodb";

async function loadForUser(db, attemptId, session) {
  const attempt = await db.collection("attempts").findOne({ _id: attemptId });
  if (!attempt) return errorResponse("Attempt not found", 404);

  const quiz = await db.collection("quizzes").findOne({ _id: attempt.quizId });
  const isStudent = attempt.studentId.toString() === session.userId;
  const isQuizOwner = quiz?.ownerId.toString() === session.userId;

  if (!isStudent && !isQuizOwner) return errorResponse("You cannot acces")

  return { attempt, quiz, isStudent, isQuizOwner }
}

export async function GET(request, { params }){
  try {
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { session, response } = await requireAuth();
    if (response) return response;

    const { id, response: badId } = await parseObjectId(params, id);
    if (badId) return badId;

    const { attempt, response: denied } = await loadForUser(db, id, session);
    if (denied) return denied;

    const body = serializeAttempt(attempt)

    if (attempt.status === "graded") {
      const questions = await db.collection("questions")
        .find(
          { quizId: attempt.quizId},
          { projection: { order: 1, type: 1, prompt: 1, choices: 1, correctAnswer: 1, points: 1, explanation: 1} },
        )
        .sort({ order: 1 })
        .toArray()

      body.questions = questions.map(({ _id, ...q }) => ({ id: _id.toString(), ...q }));
    }

    return successResponse(body, 200)
  } catch (err) {
    printExceptionLog("GET /api/attempt/[attempt_id]", err)

    return errorResponse("Internal server error", 500);
  }
}

export async function PUT(request, { params }){
  try {
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { session, response } = await requireAuth();
    if (response) return response;

    const { id, response: badId } = await parseObjectId(params, "id")
    if (badId) return badId;

    const { attempt, quiz, isStudent, response: denied } = await loadForUser(db, id, session);
    if (denied) return denied;
    if (!isStudent) return  errorResponse("Only the student who started this attempt can change it", 403)
    if (attempt.status !== "in_progress") return errorResponse("This attempt has already been submitted", 409)
    if (!quiz) return errorResponse("Quiz not found", 404);


    let body;

    try{
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const parsedUpdateAttempt = updateAttemptSchema.safeParse(body);
    if (!parsedUpdateAttempt.success) return errorResponse("Invalid request body", 400);
    const data = parsedUpdateAttempt.data

    const now = new Date();
    if (quiz.opensAt && now < new Date(quiz.opensAt))
      return errorResponse("Attempt not open yet", 409)

    const expired = quiz.status !== "published" || isPastDeadline(attempt, quiz, now);

    const questions = await db.collection("questions")
      .find({ quizId: attempt.quizId })
      .sort({ order: 1 })
      .toArray();

    const validIds = new Set(questions.map((q) => q._id.toString()));
    const unknown = data.answers.find((a) => !validIds.has(a.questionId));
    if (unknown) return errorResponse("Unknown Question", 400);

    const merged = new Map(attempt.answers.map((a) => [a.questionId.toString(), a]));

    if (!expired){
      for (const a of data.answers) {
        merged.set(a.questionId, {
          questionId: new ObjectId(a.questionId),
          give: a.given,
          isCorrect: null,
          pointsAwarded: null
        });
      }
    }

    const savedAnswers = [...merged.values()];
    const attempts = db.collection("attempts");

    if (data.action === "save") {
      if (expired) return errorResponse("Attempt expired", 409);

      const next = attemptSchema.parse({ ...attempt, answers: savedAnswers, updatedAt: now });

      const updated = await attempts.findOneAndUpdate(
        { _id: attempt._id, status: "in_progress" },
        { $set: {answers: next.answers, updatedAt: next.updatedAt} },
        { returnDocument: "after" },
      );

      if (!updated) return errorResponse("This attempt has already been submitted", 409);

      return successResponse(serializeAttempt(updated), 201)
    }

    const toSubmit = attemptSchema.parse({
      ...attempt,
      answers: savedAnswers,
      status: 'submitted',
      submittedAt: now,
      updatedAt: now,
    });

    const submitted = await attempts.findOneAndUpdate(
      { _id: attempt._id, status: "in_progress" },
      {
        $set: {
          answers: toSubmit.answers,
          status: toSubmit.status,
          submittedAt: toSubmit.submittedAt,
          updatedAt: toSubmit.updatedAt,
        },
      },
      { returnDocument: "after" },
    );

    if (!submitted) return errorResponse("This attempt has already been submitted", 409);

    const { answers, score, maxScore } = gradeAttempt(questions, submitted.answers);

    const toGrade = attemptSchema.parse({
      ...submitted,
      answers,
      score,
      maxScore,
      status: "graded",
      updatedAt: new Date(),
    });

    const graded = await attempt.findOneAndUpdate(
      { _id: attempt._id, status: "submitted" },
      {
        $set: {
          answers: toGrade.answers,
          score: toGrade.score,
          maxScore: toGrade.maxScore,
          status: toGrade.status,
          updatedAt: toGrade.updatedAt,
        },
      },
      { returnDocument: "after" },
    );

    return successResponse(serializeAttempt(graded), 201);
  } catch (err) {
    printExceptionLog("PUT /api/attempts/[attempt_id]", err);

    return errorResponse("Internal Server Error", 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { session, response } = await requireAuth();
    if (response) return response;

    const { id, response: badId } = await parseObjectId(params, "id");
    if (badId) return badId;

    const { attempt, isStudent, isQuizOwner, response: denied } = await loadForUser(db, id ,session);
    if (denied) return denied;

    if (!isQuizOwner && !(isStudent && attempt.status === "in_progress") || !(isStudent && attempt.status === "submitted")) {
      return errorResponse("You can only discard an attempt that is still in progress or submitted but not graded")
    }

    const filter = isQuizOwner ? { _id: attempt._id } : { _id: attempt._id, status: "in_progress"};
    const { deletedCount } = await db.collection("attempts").deleteOne(filter);
    if (deletedCount === 0) return errorResponse("This attempt has already been submitted");

    return successResponse({ deleted: attempt._id.toString() }, 204)
  } catch (error) {
    printExceptionLog("DELETE /api/attempts/[attempt_id]", error);

    return errorResponse("Something went wrong", 500)
  }
}

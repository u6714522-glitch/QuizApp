export const GRACE_MS = 30_000; // allowance for network latency on the final submit

const norm = (v) => String(v ?? '').trim().toLowerCase();

export function isAnswerCorrect(question, given) {
  if (given === null || given === undefined || given === '') return false;

  return norm(given) === norm(question.correctAnswer);
}


export function gradeAttempt(questions, savedAnswers) {
  const givenById = new Map(savedAnswers.map((a) => [a.questionId.toString(), a.given]));
  let score = 0;
  let maxScore = 0;

  const answers = questions.map((q) => {
    const points = q.points ?? 1;
    const given = givenById.get(q._id.toString()) ?? null;
    const isCorrect = isAnswerCorrect(q, given);
    const pointsAwarded = isCorrect ? points : 0;

    score += pointsAwarded;
    maxScore += points;

    return { questionId: q._id, given, isCorrect, pointsAwarded };
  });

  return { answers, score, maxScore };
}


export function isPastDeadline(attempt, quiz, now = new Date()) {
  const limits = [];

  if (quiz.timeLimitMinutes > 0) {
    limits.push(new Date(attempt.startedAt).getTime() + quiz.timeLimitMinutes * 60_000);
  }

  if (quiz.closesAt) limits.push(new Date(quiz.closesAt).getTime());
  if (limits.length === 0) return false;

  return now.getTime() > Math.min(...limits) + GRACE_MS;
}

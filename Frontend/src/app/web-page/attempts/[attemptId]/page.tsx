"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  answerLabel,
  dateLabel,
  deadline,
  message,
  type Answer,
  type Attempt,
  type Question,
  type Quiz,
} from "../../_lib/api";
import { useSession } from "../../_lib/use-session";
import {
  Workspace,
  Badge,
  Empty,
  Loading,
  Notice,
  card,
  input,
  primary,
  secondary,
} from "../../_components/workspace";

type AnswerMap = Record<string, string | null>;

function AttemptWorkspace({ attemptId }: { attemptId: string }) {
  const session = useSession();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quizError, setQuizError] = useState("");
  const [saveStatus, setSaveStatus] = useState("Saved");
  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  const answerRef = useRef<AnswerMap>({});
  const version = useRef(0);
  const savedVersion = useRef(0);
  const submittingRef = useRef(false);
  const autoSubmitted = useRef(false);
  const mounted = useRef(false);
  // Serialize saves and submissions to avoid overwriting newer answers.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
    const job = queue.current.catch(() => undefined).then(work);
    queue.current = job.catch(() => undefined);
    return job;
  }, []);
  const readResult = useCallback(async () => {
    const result = await api<Attempt>("/api/attempt/" + attemptId);
    if (mounted.current) {
      setAttempt(result);
      if (result.status === "graded") setQuestions(result.questions || []);
    }
    return result;
  }, [attemptId]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!session.user) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setQuizError("");
    async function load() {
      const item = await api<Attempt>("/api/attempt/" + attemptId, {
        signal: controller.signal,
      });
      let bundle: { quiz: Quiz; questions: Question[] } | null = null;
      try {
        bundle = await api<{ quiz: Quiz; questions: Question[] }>(
          "/api/quiz/" + item.quizId + "?for=attempt",
          { signal: controller.signal },
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) throw err;
        setQuizError(
          item.status === "graded"
            ? "Quiz details are unavailable. Your stored score and answer review are shown below."
            : "Quiz details could not be loaded. Retry, or submit answers that were already saved.",
        );
      }
      if (controller.signal.aborted) return;
      const map = Object.fromEntries(
        (item.answers || []).map((answer) => [answer.questionId, answer.given]),
      );
      setAttempt(item);
      setQuiz(bundle?.quiz || null);
      setQuestions(
        item.status === "graded"
          ? item.questions || []
          : bundle?.questions || [],
      );
      setAnswers(map);
      answerRef.current = map;
      version.current = 0;
      savedVersion.current = 0;
      setBlocked(false);
      setSaveStatus("Saved");
      setNow(Date.now());
    }
    load()
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [session.user, attemptId, revision]);

  const studentOwns =
    session.user?.role === "student" && session.user.id === attempt?.studentId;
  const active = attempt?.status === "in_progress";
  const end = attempt ? deadline(attempt, quiz) : null;
  const expired = end !== null && now >= end;
  const canEdit =
    studentOwns &&
    active &&
    Boolean(quiz) &&
    quiz?.status === "published" &&
    !expired &&
    !blocked &&
    !submitting;
  const snapshot = useCallback(
    (): Answer[] =>
      questions.map((question) => ({
        questionId: question.id,
        given: answerRef.current[question.id] ?? null,
      })),
    [questions],
  );
  const save = useCallback(
    async (items: Answer[], capturedVersion: number) => {
      return enqueue(async () => {
        if (
          !mounted.current ||
          submittingRef.current ||
          capturedVersion <= savedVersion.current
        )
          return;
        setSaveStatus("Saving...");
        try {
          for (let start = 0; start < items.length; start += 200) {
            await api<Attempt>("/api/attempt/" + attemptId, {
              method: "PUT",
              body: JSON.stringify({
                action: "save",
                answers: items.slice(start, start + 200),
              }),
            });
          }
          savedVersion.current = capturedVersion;
          if (mounted.current) {
            setSaveStatus(
              version.current === capturedVersion ? "Saved" : "Unsaved changes",
            );
            setError("");
          }
        } catch (err) {
          if (mounted.current) {
            setSaveStatus("Not saved");
            setError(message(err));
            if (err instanceof ApiError && err.status === 409) {
              setBlocked(true);
              try {
                await readResult();
              } catch {
                /* Keep the save error visible. */
              }
            }
          }
        }
      });
    },
    [attemptId, enqueue, readResult],
  );
  const submit = useCallback(
    async (automatic = false) => {
      if (!studentOwns || !active || submittingRef.current) return;
      if (
        !automatic &&
        !window.confirm(
          "Submit this quiz? You will not be able to change your answers afterwards.",
        )
      )
        return;
      submittingRef.current = true;
      setSubmitting(true);
      setError("");
      const items = snapshot();
      await enqueue(async () => {
        if (!mounted.current) return;
        try {
          // Larger quizzes save in batches to respect the API's 200-answer limit.
          if (items.length > 200) {
            try {
              for (let start = 0; start < items.length; start += 200) {
                await api<Attempt>("/api/attempt/" + attemptId, {
                  method: "PUT",
                  body: JSON.stringify({
                    action: "save",
                    answers: items.slice(start, start + 200),
                  }),
                });
              }
            } catch (err) {
              if (!(err instanceof ApiError && err.status === 409)) throw err;
            }
          }
          const result = await api<Attempt>("/api/attempt/" + attemptId, {
            method: "PUT",
            body: JSON.stringify({
              action: "submit",
              answers: items.length > 200 ? [] : items,
            }),
          });
          if (!mounted.current) return;
          setAttempt(result);
          setQuestions(result.questions || []);
          setSaveStatus("Submitted");
          // GET adds answer explanations to the stored score.
          try {
            await readResult();
          } catch (err) {
            if (mounted.current)
              setError(
                "Your quiz was submitted. Unable to load answer details. Select Reload Details to try again. " +
                  message(err),
              );
          }
        } catch (err) {
          if (!mounted.current) return;
          try {
            const latest = await readResult();
            if (latest.status === "graded") {
              setSaveStatus("Submitted");
              return;
            }
          } catch {
            /* Keep the original submission error. */
          }
          setError(message(err) + " Please retry submitting.");
        } finally {
          submittingRef.current = false;
          if (mounted.current) setSubmitting(false);
        }
      });
    },
    [studentOwns, active, snapshot, enqueue, attemptId, readResult],
  );
  useEffect(() => {
    if (!active || end === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, end]);
  useEffect(() => {
    if (!canEdit || version.current === savedVersion.current) return;
    const capturedVersion = version.current;
    const items = snapshot();
    const timer = window.setTimeout(() => {
      void save(items, capturedVersion);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [answers, canEdit, snapshot, save]);
  useEffect(() => {
    if (
      expired &&
      studentOwns &&
      active &&
      !loading &&
      !autoSubmitted.current
    ) {
      autoSubmitted.current = true;
      void submit(true);
    }
  }, [expired, studentOwns, active, loading, submit]);
  function change(questionId: string, given: string | null) {
    if (!canEdit) return;
    const next = { ...answerRef.current, [questionId]: given };
    answerRef.current = next;
    version.current += 1;
    setAnswers(next);
    setSaveStatus("Unsaved changes");
  }
  const remaining =
    end === null ? null : Math.max(0, Math.ceil((end - now) / 1000));
  const timerText =
    remaining === null
      ? "No time limit"
      : Math.floor(remaining / 60) +
        ":" +
        String(remaining % 60).padStart(2, "0");
  const percent =
    attempt?.status === "graded" &&
    attempt.score !== null &&
    attempt.maxScore > 0
      ? Math.round((attempt.score / attempt.maxScore) * 100)
      : null;
  const answered = questions.filter((question) =>
    Boolean(answers[question.id]?.trim()),
  ).length;
  return (
    <Workspace
      session={session}
      active="attempts"
      title={attempt?.status === "graded" ? "Quiz Result" : "Quiz Attempt"}
      description={quiz?.title || "Your classroom quiz"}
    >
      <div className="mb-5 flex flex-wrap gap-3">
        <Link className={secondary} href="/web-page/attempts">
          Back to Attempts
        </Link>
        {quiz && (
          <Link className={secondary} href={"/web-page/quizzes/" + quiz.id}>
            Quiz Details
          </Link>
        )}
        {(!active || !quiz || !attempt) && (
          <button
            className={secondary}
            disabled={loading || submitting}
            onClick={() => setRevision((value) => value + 1)}
          >
            Reload Details
          </button>
        )}
      </div>
      <div className="mb-5 space-y-3">
        <Notice>{error}</Notice>
        {quizError && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            {quizError}
          </p>
        )}
      </div>
      {loading ? (
        <Loading />
      ) : (
        attempt && (
          <>
            <section className={card + " mb-6"}>
              <div className="flex flex-wrap items-center justify-between gap-5">
                <div>
                  <Badge>
                    {attempt.status === "graded" ? "Completed" : "In progress"}
                  </Badge>
                  <p className="mt-4 text-sm text-stone-500">
                    Started: {dateLabel(attempt.startedAt)}
                  </p>
                  {attempt.submittedAt && (
                    <p className="mt-1 text-sm text-stone-500">
                      Submitted: {dateLabel(attempt.submittedAt)}
                    </p>
                  )}
                </div>
                {attempt.status === "graded" ? (
                  <div className="text-right">
                    <p className="text-sm text-stone-500">Your score</p>
                    <p className="mt-1 text-4xl font-semibold">
                      {attempt.score ?? "—"}{" "}
                      <span className="text-lg text-stone-400">
                        / {attempt.maxScore}
                      </span>
                    </p>
                    {percent !== null && (
                      <p className="mt-2 text-sm text-stone-600">
                        {percent}%
                        {quiz && attempt.score !== null
                          ? (attempt.score / attempt.maxScore) * 100 >=
                            quiz.passingScore
                            ? " · Passed"
                            : " · Below passing score"
                          : ""}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="text-sm text-stone-500">Time remaining</p>
                    <p
                      className={
                        "mt-1 text-3xl font-semibold tabular-nums " +
                        (expired ? "text-red-600" : "")
                      }
                    >
                      {timerText}
                    </p>
                    {studentOwns && (
                      <p role="status" className="mt-2 text-sm text-stone-500">
                        {submitting ? "Submitting..." : saveStatus}
                      </p>
                    )}
                  </div>
                )}
              </div>
              {active && studentOwns && (
                <div className="mt-5 border-t border-stone-100 pt-5">
                  <p className="mb-4 text-sm text-stone-500">
                    {questions.length
                      ? answered +
                        " of " +
                        questions.length +
                        " questions answered."
                      : "Submit to grade the answers already saved to this attempt."}{" "}
                    {expired || blocked
                      ? "The answer period has ended. The server will grade your saved answers."
                      : "Answers save automatically. Use Save Answers before leaving this page."}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className={secondary}
                      disabled={
                        !canEdit || version.current === savedVersion.current
                      }
                      onClick={() => {
                        void save(snapshot(), version.current);
                      }}
                    >
                      Save Answers
                    </button>
                    <button
                      className={primary}
                      disabled={submitting}
                      onClick={() => {
                        void submit();
                      }}
                    >
                      {submitting ? "Submitting..." : "Submit Quiz"}
                    </button>
                  </div>
                </div>
              )}
              {active && !studentOwns && (
                <p className="mt-5 text-sm text-stone-500">
                  This attempt is in progress. Only the student can change or
                  submit its answers.
                </p>
              )}
            </section>
            {!questions.length ? (
              <Empty>
                {attempt.status === "graded"
                  ? "Answer details are unavailable. Your stored score is shown above."
                  : "No questions available in this view."}
              </Empty>
            ) : (
              <div className="space-y-5">
                {questions.map((question, index) => {
                  const answer = attempt.answers?.find(
                    (item) => item.questionId === question.id,
                  );
                  const graded = attempt.status === "graded";
                  return (
                    <section className={card} key={question.id}>
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <Badge>{question.type.replaceAll("_", " ")}</Badge>
                        <span className="text-xs text-stone-500">
                          {graded ? (answer?.pointsAwarded ?? 0) + " / " : ""}
                          {question.points} points
                        </span>
                      </div>
                      <h2 className="whitespace-pre-wrap break-words text-lg font-semibold">
                        {index + 1 + ". " + question.prompt}
                      </h2>
                      {graded ? (
                        <div className="mt-4 space-y-3 text-sm">
                          <p
                            className={
                              "rounded-xl p-3 " +
                              (answer?.isCorrect
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-red-50 text-red-700")
                            }
                          >
                            Your answer: {answerLabel(question, answer?.given)}{" "}
                            · {answer?.isCorrect ? "Correct" : "Incorrect"}
                          </p>
                          <p className="text-emerald-700">
                            Correct answer:{" "}
                            {answerLabel(question, question.correctAnswer)}
                          </p>
                          {question.explanation && (
                            <p className="whitespace-pre-wrap break-words leading-6 text-stone-500">
                              {question.explanation}
                            </p>
                          )}
                        </div>
                      ) : (
                        <fieldset
                          className="mt-4 space-y-3"
                          disabled={!canEdit}
                        >
                          <legend className="sr-only">
                            Answer for question {index + 1}
                          </legend>
                          {question.type === "short_answer" ? (
                            <label className="block">
                              <span className="sr-only">
                                Your answer for question {index + 1}
                              </span>
                              <textarea
                                className={input}
                                rows={3}
                                maxLength={2000}
                                placeholder="Type your answer..."
                                value={answers[question.id] || ""}
                                onChange={(event) =>
                                  change(
                                    question.id,
                                    event.target.value || null,
                                  )
                                }
                              />
                            </label>
                          ) : (
                            (question.type === "true_false"
                              ? [
                                  { key: "true", text: "True" },
                                  { key: "false", text: "False" },
                                ]
                              : question.choices
                            ).map((choice) => (
                              <label
                                key={choice.key}
                                className={
                                  "flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm " +
                                  (answers[question.id] === choice.key
                                    ? "border-orange-400 bg-orange-50"
                                    : "border-stone-200")
                                }
                              >
                                <input
                                  type="radio"
                                  className="accent-orange-500"
                                  name={question.id}
                                  value={choice.key}
                                  checked={answers[question.id] === choice.key}
                                  onChange={() =>
                                    change(question.id, choice.key)
                                  }
                                />
                                <span className="break-words">
                                  {question.type === "multiple_choice"
                                    ? choice.key + ". " + choice.text
                                    : choice.text}
                                </span>
                              </label>
                            ))
                          )}
                          {studentOwns && (
                            <button
                              className="text-xs text-stone-500 underline disabled:opacity-40"
                              disabled={!canEdit || !answers[question.id]}
                              onClick={() => change(question.id, null)}
                            >
                              Clear answer
                            </button>
                          )}
                        </fieldset>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )
      )}
    </Workspace>
  );
}

export default function AttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  return <AttemptWorkspace key={attemptId} attemptId={attemptId} />;
}

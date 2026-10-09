"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  api,
  availability,
  answerLabel,
  dateLabel,
  message,
  ApiError,
  type Attempt,
  type Question,
  type QuestionInput,
  type Quiz,
  type QuizInput,
  type QuizStatus,
} from "../../_lib/api";
import { useSession } from "../../_lib/use-session";
import { QuizForm } from "../../_components/quiz-form";
import { QuestionForm } from "../../_components/question-form";
import {
  Workspace,
  Badge,
  Empty,
  Loading,
  Notice,
  card,
  danger,
  primary,
  secondary,
} from "../../_components/workspace";

export default function QuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  return <QuizDetails key={quizId} quizId={quizId} />;
}

function QuizDetails({ quizId }: { quizId: string }) {
  const router = useRouter();
  const session = useSession();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [settings, setSettings] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    if (!session.user) return;
    const controller = new AbortController();
    Promise.all([
      api<{ quiz: Quiz; questions: Question[] }>("/api/quiz/" + quizId, {
        signal: controller.signal,
      }),
      api<Attempt[]>("/api/attempt?quizId=" + quizId, {
        signal: controller.signal,
      }),
    ])
      .then(([data, items]) => {
        if (controller.signal.aborted) return;
        setQuiz(data.quiz);
        setQuestions(data.questions);
        setAttempts(items);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [session.user, quizId, revision]);

  const owner =
    session.user?.role === "instructor" && quiz?.ownerId === session.user.id;
  const editable = owner && quiz?.status === "draft" && attempts.length === 0;
  const existing = attempts.find((attempt) => attempt.status === "in_progress");
  async function saveSettings(data: QuizInput) {
    const updated = await api<Quiz>("/api/quiz/" + quizId, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    setQuiz(updated);
    setSettings(false);
    setSuccess("Quiz settings saved.");
  }
  async function changeStatus(status: QuizStatus) {
    if (busy) return;
    if (
      status === "closed" &&
      !window.confirm(
        "Close this quiz? Students will no longer be able to start or save answers. Existing attempts can still submit their saved answers.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const updated = await api<Quiz>("/api/quiz/" + quizId, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      setQuiz(updated);
      setAdding(false);
      setEditing(null);
      setSettings(false);
      setSuccess("Quiz status updated to " + status + ".");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  async function saveQuestion(data: QuestionInput) {
    const result = await api<{ question: Question }>(
      editing
        ? "/api/question/" + editing.id
        : "/api/question?quizId=" + quizId,
      {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(data),
      },
    );
    setQuestions((items) =>
      [
        ...items.filter((item) => item.id !== result.question.id),
        result.question,
      ].sort((a, b) => a.order - b.order),
    );
    setAdding(false);
    setEditing(null);
    setSuccess("Question saved.");
  }
  async function deleteQuestion(question: Question) {
    if (busy || !window.confirm("Delete question " + question.order + "?"))
      return;
    setBusy(true);
    setError("");
    try {
      await api<void>("/api/question/" + question.id, { method: "DELETE" });
      setQuestions((items) => items.filter((item) => item.id !== question.id));
      setSuccess("Question deleted.");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (existing) {
        router.push("/web-page/attempts/" + existing.id);
        return;
      }
      try {
        const attempt = await api<Attempt>("/api/attempt", {
          method: "POST",
          body: JSON.stringify({ quizId }),
        });
        router.push("/web-page/attempts/" + attempt.id);
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const items = await api<Attempt[]>("/api/attempt?quizId=" + quizId);
          const active = items.find((item) => item.status === "in_progress");
          if (active) {
            router.push("/web-page/attempts/" + active.id);
            return;
          }
        }
        throw err;
      }
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }
  return (
    <Workspace
      session={session}
      active="quizzes"
      title={quiz?.title || "Quiz"}
      description={quiz?.subject}
    >
      <div className="mb-5 flex flex-wrap gap-3">
        <Link className={secondary} href="/web-page/quizzes">
          Back to Quizzes
        </Link>
        <button
        className={secondary}
        disabled={loading || busy}
        onClick={() => {
          setLoading(true);
          setError("");
          setRevision((value) => value + 1);
        }}
        >
          Refresh
        </button>
        {owner && (
          <Link
            className={secondary}
            href={"/web-page/attempts?quizId=" + quizId}
          >
            Student Results
          </Link>
        )}
      </div>
      <div className="mb-5 space-y-3">
        <Notice>{error}</Notice>
        <Notice good>{success}</Notice>
      </div>
      {loading ? (
        <Loading />
      ) : (
        quiz && (
          <>
            <section className={card + " mb-6"}>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Badge>{availability(quiz)}</Badge>
                <span className="text-sm text-stone-500">
                  {questions.length} questions ·{" "}
                  {questions.reduce(
                    (sum, question) => sum + question.points,
                    0,
                  )}{" "}
                  points
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-7 text-stone-600">
                {quiz.description || "No description provided."}
              </p>
              <div className="mt-4 grid gap-2 text-sm text-stone-500 sm:grid-cols-2">
                <p>
                  Time limit:{" "}
                  {quiz.timeLimitMinutes
                    ? quiz.timeLimitMinutes + " minutes"
                    : "None"}
                </p>
                <p>Passing score: {quiz.passingScore}%</p>
                <p>Opens: {dateLabel(quiz.opensAt)}</p>
                <p>Closes: {dateLabel(quiz.closesAt)}</p>
              </div>
              {owner ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    className={secondary}
                    disabled={!editable || busy}
                    onClick={() => setSettings((value) => !value)}
                  >
                    Edit Settings
                  </button>
                  {quiz.status !== "published" && (
                    <button
                      className={primary}
                      disabled={
                        busy ||
                        !questions.length ||
                        adding ||
                        Boolean(editing) ||
                        settings
                      }
                      onClick={() => changeStatus("published")}
                    >
                      {busy
                        ? "Updating..."
                        : quiz.status === "closed"
                          ? "Reopen Quiz"
                          : "Publish Quiz"}
                    </button>
                  )}
                  {quiz.status === "published" && (
                    <button
                      className={secondary}
                      disabled={busy}
                      onClick={() => changeStatus("closed")}
                    >
                      Close Quiz
                    </button>
                  )}
                  {quiz.status !== "draft" && attempts.length === 0 && (
                    <button
                      className={secondary}
                      disabled={busy}
                      onClick={() => changeStatus("draft")}
                    >
                      Return to Draft
                    </button>
                  )}
                </div>
              ) : (
                session.user?.role === "student" && (
                  <div className="mt-5 space-y-4">
                    <p className="text-sm text-stone-500">
                      Your timer starts when you select Start Quiz. Answers are
                      saved automatically while you work. Submitted answers
                      cannot be changed.
                    </p>
                    <button
                      className={primary}
                      disabled={
                        busy ||
                        (!existing &&
                          (availability(quiz) !== "Open" || !questions.length))
                      }
                      onClick={start}
                    >
                      {busy
                        ? "Opening..."
                        : existing
                          ? "Continue Attempt"
                          : "Start Quiz"}
                    </button>
                  </div>
                )
              )}
            </section>
            {settings && editable && (
              <section className={card + " mb-6"}>
                <h2 className="mb-5 text-xl font-semibold">
                  Edit Quiz Settings
                </h2>
                <QuizForm
                  key={quiz.id}
                  quiz={quiz}
                  onSave={saveSettings}
                  onCancel={() => setSettings(false)}
                />
              </section>
            )}
            {owner && (
              <>
                {!editable && (
                  <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                    {attempts.length
                      ? "This quiz has attempts. Questions and settings are locked to preserve existing results. Create a new quiz for a revised question set."
                      : "Return this quiz to draft before editing its questions or settings."}
                  </p>
                )}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">Questions</h2>
                  <button
                    className={primary}
                    disabled={
                      !editable ||
                      busy ||
                      adding ||
                      Boolean(editing) ||
                      questions.length >= 200
                    }
                    onClick={() => {
                      setAdding(true);
                      setEditing(null);
                      setSuccess("");
                    }}
                  >
                    Add Question
                  </button>
                </div>
                {(adding || editing) && editable && (
                  <section className={card + " mb-5"}>
                    <h3 className="mb-4 text-lg font-semibold">
                      {editing ? "Edit Question" : "New Question"}
                    </h3>
                    <QuestionForm
                      key={editing?.id || "new"}
                      question={editing || undefined}
                      nextOrder={
                        Math.max(0, ...questions.map((item) => item.order)) + 1
                      }
                      onSave={saveQuestion}
                      onCancel={() => {
                        setAdding(false);
                        setEditing(null);
                      }}
                    />
                  </section>
                )}
                {questions.length === 0 ? (
                  <Empty>Add at least one question before publishing.</Empty>
                ) : (
                  <div className="space-y-4">
                    {questions.map((question) => (
                      <article className={card} key={question.id}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <Badge>{question.type.replaceAll("_", " ")}</Badge>
                          <span className="text-xs text-stone-500">
                            {question.points} points · Order {question.order}
                          </span>
                        </div>
                        <h3 className="whitespace-pre-wrap break-words font-semibold">
                          {question.order + ". " + question.prompt}
                        </h3>
                        {question.type === "multiple_choice" && (
                          <ul className="mt-3 space-y-2 text-sm text-stone-600">
                            {question.choices.map((choice) => (
                              <li key={choice.key}>
                                {choice.key + ". " + choice.text}
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="mt-4 text-sm text-emerald-700">
                          Correct answer:{" "}
                          {answerLabel(question, question.correctAnswer)}
                        </p>
                        {question.explanation && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-stone-500">
                            {question.explanation}
                          </p>
                        )}
                        <div className="mt-4 flex gap-3">
                          <button
                            className={secondary}
                            disabled={
                              !editable || busy || adding || Boolean(editing)
                            }
                            onClick={() => {
                              setEditing(question);
                              setAdding(false);
                              setSuccess("");
                            }}
                          >
                            Edit Question
                          </button>
                          <button
                            className={danger}
                            disabled={
                              !editable || busy || adding || Boolean(editing)
                            }
                            onClick={() => deleteQuestion(question)}
                          >
                            Delete Question
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )
      )}
    </Workspace>
  );
}

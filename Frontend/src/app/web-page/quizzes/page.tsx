"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  allQuizzes,
  api,
  availability,
  dateLabel,
  message,
  type Quiz,
  type QuizInput,
} from "../_lib/api";
import { useSession } from "../_lib/use-session";
import { QuizForm } from "../_components/quiz-form";
import {
  Workspace,
  Badge,
  Empty,
  Loading,
  Notice,
  card,
  danger,
  input,
  primary,
  secondary,
} from "../_components/workspace";

export default function QuizzesPage() {
  const session = useSession();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [revision, setRevision] = useState(0);
  const instructor = session.user?.role === "instructor";

  useEffect(() => {
    if (!session.user) return;
    const controller = new AbortController();

    allQuizzes(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setQuizzes(items);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [session.user, revision]);

  async function createQuiz(data: QuizInput) {
    const quiz = await api<Quiz>("/api/quiz", {
      method: "POST",
      body: JSON.stringify(data),
    });

    router.push(`/web-page/quizzes/${quiz.id}`);
  }

  async function deleteQuiz(quiz: Quiz) {
    if (
      busy ||
      !window.confirm(
        `Delete "${quiz.title}"? All its questions and student attempts will also be deleted.`,
      )
    )
      return;
    setBusy(quiz.id);
    setError("");
    setSuccess("");

    try {
      await api<void>(`/api/quiz/${quiz.id}`, { method: "DELETE" });
      setQuizzes((items) => items.filter((item) => item.id !== quiz.id));
      setSuccess("Quiz deleted.");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy("");
    }
  }

  const visible = quizzes.filter((quiz) => {
    const matchesText = `${quiz.title} ${quiz.subject}`
      .toLowerCase()
      .includes(search.toLowerCase());

    const status = instructor ? quiz.status : availability(quiz);

    return matchesText && (filter === "all" || status.toLowerCase() === filter);
  });

  return (
    <Workspace
      session={session}
      active="quizzes"
      title={instructor ? "My Quizzes" : "Available Quizzes"}
      description={
        instructor
          ? "Create quizzes, manage questions, and publish to your classroom."
          : "Choose a quiz to begin or continue your attempt."
      }
    >
      <div className="mb-6 flex flex-wrap gap-3">
        {instructor && (
          <button className={primary} onClick={() => setCreating((value) => !value)}>
            {creating ? "Hide Form" : "New Quiz"}
          </button>
        )}
        <button
          className={secondary}
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setError("");
            setRevision((value) => value + 1);
          }}
        >
          Refresh
        </button>
        <Link className={secondary} href="/web-page/dashboard">
          Back to Overview
        </Link>
      </div>
      {creating && instructor && (
        <section className={`${card} mb-6`}>
          <h2 className="mb-5 text-xl font-semibold">Create Quiz</h2>
          <QuizForm onSave={createQuiz} onCancel={() => setCreating(false)} />
        </section>
      )}
      <div className="mb-5 space-y-3">
        <Notice>{error}</Notice>
        <Notice good>{success}</Notice>
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_200px]">
        <input
          aria-label="Search quizzes"
          className={input}
          placeholder="Search title or subject"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter quizzes"
          className={input}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All quizzes</option>
          {instructor ? (
            <>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </>
          ) : (
            <>
              <option value="open">Open</option>
              <option value="upcoming">Upcoming</option>
              <option value="closed">Closed</option>
            </>
          )}
        </select>
      </div>
      {loading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <Empty>
          {quizzes.length
            ? "No quizzes match your search."
            : instructor
              ? "Create your first quiz to get started."
              : "No published quizzes are available yet."}
        </Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((quiz) => (
            <article className={card} key={quiz.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-orange-600">{quiz.subject}</span>
                <Badge>{availability(quiz)}</Badge>
              </div>
              <h2 className="mt-3 text-xl font-semibold">{quiz.title}</h2>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-stone-500">
                {quiz.description || "No description provided."}
              </p>
              <div className="mt-4 space-y-1 text-xs text-stone-500">
                <p>
                  {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} minutes` : "No time limit"} ·
                  Passing score: {quiz.passingScore}%
                </p>
                {quiz.opensAt && <p>Opens: {dateLabel(quiz.opensAt)}</p>}
                {quiz.closesAt && <p>Closes: {dateLabel(quiz.closesAt)}</p>}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link className={primary} href={`/web-page/quizzes/${quiz.id}`}>
                  {instructor ? "Manage Quiz" : "View Quiz"}
                </Link>
                {instructor && (
                  <button
                    className={danger}
                    disabled={Boolean(busy)}
                    onClick={() => deleteQuiz(quiz)}
                  >
                    {busy === quiz.id ? "Deleting..." : "Delete Quiz"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </Workspace>
  );
}

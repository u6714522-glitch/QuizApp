"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  allQuizzes,
  api,
  availability,
  dateLabel,
  message,
  type Attempt,
  type Quiz,
} from "../_lib/api";
import { useSession } from "../_lib/use-session";
import {
  Workspace,
  Badge,
  Empty,
  Loading,
  Notice,
  card,
  primary,
  secondary,
} from "../_components/workspace";
import { InviteInstructor } from "../_components/invite-instructor";

export default function DashboardPage() {
  const session = useSession();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!session.user) return;
    const controller = new AbortController();

    Promise.all([
      allQuizzes(controller.signal),
      api<Attempt[]>("/api/attempt", { signal: controller.signal }),
    ])
      .then(([items, results]) => {
        if (!Array.isArray(results)) throw new Error("Unexpected attempt response.");

        if (!controller.signal.aborted) {
          setQuizzes(items);
          setAttempts(results);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [session.user, revision]);
  const instructor = session.user?.role === "instructor";
  const completed = attempts.filter((attempt) => attempt.status === "graded");

  const scored = completed.filter((attempt) => attempt.score !== null && attempt.maxScore > 0);

  const average = scored.length
    ? `${Math.round(
        scored.reduce((sum, attempt) => sum + (attempt.score! / attempt.maxScore) * 100, 0) /
          scored.length,
      )}%`
    : "—";

  const stats = instructor
    ? [
        { label: "My Quizzes", value: quizzes.length },
        {
          label: "Published Quizzes",
          value: quizzes.filter((quiz) => quiz.status === "published").length,
        },
        { label: "Student Attempts", value: attempts.length },
      ]
    : [
        {
          label: "Open Quizzes",
          value: quizzes.filter((quiz) => availability(quiz) === "Open").length,
        },
        { label: "Completed Attempts", value: completed.length },
        { label: "Average Score", value: average },
      ];

  return (
    <Workspace
      session={session}
      active="dashboard"
      title={`Welcome back, ${session.user?.name || ""}`}
      description={
        instructor
          ? "Create classroom quizzes and review student results."
          : "Explore classroom quizzes and track your progress."
      }
    >
      <div className="mb-5 flex flex-wrap gap-3">
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
        <Link className={primary} href="/web-page/quizzes">
          {instructor ? "Manage Quizzes" : "Browse Quizzes"}
        </Link>
        <Link className={secondary} href="/web-page/attempts">
          {instructor ? "Student Results" : "My Attempts"}
        </Link>
      </div>
      <Notice>{error}</Notice>
      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <div className={card} key={stat.label}>
                <p className="text-sm text-stone-500">{stat.label}</p>
                <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>
          {session.user?.isAdmin && <InviteInstructor />}
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                {instructor ? "My Quizzes" : "Available Quizzes"}
              </h2>
              <Link
                className="text-sm font-medium text-orange-600 hover:underline"
                href="/web-page/quizzes"
              >
                View all
              </Link>
            </div>
            {!quizzes.length ? (
              <Empty>
                {instructor
                  ? "Create your first quiz from Manage Quizzes."
                  : "No published quizzes are available yet."}
              </Empty>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {quizzes.slice(0, 4).map((quiz) => (
                  <article className={card} key={quiz.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-medium text-orange-600">{quiz.subject}</p>
                      <Badge>{availability(quiz)}</Badge>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold">{quiz.title}</h3>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-stone-500">
                      {quiz.description || "No description provided."}
                    </p>
                    <p className="mt-4 text-xs text-stone-500">
                      {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} minutes` : "No time limit"}
                    </p>
                    <Link className={`${secondary} mt-5`} href={`/web-page/quizzes/${quiz.id}`}>
                      {instructor ? "Manage Quiz" : "View Quiz"}
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Recent Attempts</h2>
              <Link
                className="text-sm font-medium text-orange-600 hover:underline"
                href="/web-page/attempts"
              >
                View all
              </Link>
            </div>
            {!attempts.length ? (
              <Empty>No quiz attempts yet.</Empty>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Recent quiz attempts</caption>
                  <thead className="border-b border-stone-200 bg-stone-50 text-stone-500">
                    <tr>
                      <th scope="col" className="px-5 py-4">
                        Quiz
                      </th>
                      {instructor && (
                        <th scope="col" className="px-5 py-4">
                          Student
                        </th>
                      )}
                      <th scope="col" className="px-5 py-4">
                        Status
                      </th>
                      <th scope="col" className="px-5 py-4">
                        Score
                      </th>
                      <th scope="col" className="px-5 py-4">
                        Started
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.slice(0, 5).map((attempt) => (
                      <tr className="border-b border-stone-100 last:border-0" key={attempt.id}>
                        <td className="px-5 py-4">
                          <Link
                            className="font-medium text-orange-700 hover:underline"
                            href={`/web-page/attempts/${attempt.id}`}
                          >
                            {attempt.quiz?.title || "Unavailable quiz"}
                          </Link>
                        </td>
                        {instructor && (
                          <td className="px-5 py-4">
                            {attempt.student?.name || "Unknown student"}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-5 py-4 text-stone-500">
                          {attempt.status === "graded"
                            ? "Completed"
                            : attempt.status.replaceAll("_", " ")}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          {attempt.status === "graded" && attempt.score !== null
                            ? `${attempt.score} / ${attempt.maxScore}`
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-stone-500">
                          {dateLabel(attempt.startedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </Workspace>
  );
}

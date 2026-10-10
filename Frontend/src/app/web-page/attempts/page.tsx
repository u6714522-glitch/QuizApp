"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, dateLabel, message, type Attempt } from "../_lib/api";
import { useSession } from "../_lib/use-session";
import {
  Workspace,
  Badge,
  Empty,
  Loading,
  Notice,
  danger,
  input,
  secondary,
} from "../_components/workspace";

function AttemptList() {
  const quizId = useSearchParams().get("quizId");
  return <AttemptListContent key={quizId ?? "all"} quizId={quizId} />;
}

function AttemptListContent({ quizId }: { quizId: string | null }) {
  const session = useSession();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  useEffect(() => {
    if (!session.user) return;
    const controller = new AbortController();
    api<Attempt[]>(
      "/api/attempt" + (quizId ? "?quizId=" + encodeURIComponent(quizId) : ""),
      { signal: controller.signal },
    )
      .then((data) => {
        if (!Array.isArray(data))
          throw new Error("Unexpected attempt response.");
        if (!controller.signal.aborted) setAttempts(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [session.user, quizId, revision]);
  const instructor = session.user?.role === "instructor";
  const visible = attempts.filter(
    (attempt) =>
      (status === "all" || attempt.status === status) &&
      ((attempt.quiz?.title || "") + " " + (attempt.student?.name || ""))
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );
  async function remove(attempt: Attempt) {
    if (
      busy ||
      !window.confirm(
        instructor
          ? "Delete this attempt and its stored score permanently?"
          : "Discard this attempt and all its saved answers? You can start again if the quiz is still open.",
      )
    )
      return;
    setBusy(attempt.id);
    setError("");
    setSuccess("");
    try {
      await api<void>("/api/attempt/" + attempt.id, { method: "DELETE" });
      setAttempts((items) => items.filter((item) => item.id !== attempt.id));
      setSuccess("Attempt deleted.");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(null);
    }
  }
  return (
    <Workspace
      session={session}
      active="attempts"
      title={instructor ? "Student Results" : "My Attempts"}
      description={
        instructor
          ? "Review attempts on your quizzes and manage stored results."
          : "Continue a quiz or review your submitted answers and scores."
      }
    >
      <div className="mb-5 flex flex-wrap gap-3">
        <Link href="/web-page/quizzes" className={secondary}>
          Browse Quizzes
        </Link>
        <button
        disabled={loading || Boolean(busy)}
        className={secondary}
        onClick={() => {
          setLoading(true);
          setError("");
          setRevision((value) => value + 1);
        }}
        >
          Refresh
        </button>
        {quizId && (
          <Link href="/web-page/attempts" className={secondary}>
            Show All Attempts
          </Link>
        )}
      </div>
      {quizId && (
        <p className="mb-5 text-sm text-stone-500">
          Showing attempts for the selected quiz.
        </p>
      )}
      <div className="mb-5 space-y-3">
        <Notice>{error}</Notice>
        <Notice good>{success}</Notice>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px]">
        <input
          aria-label="Search attempts"
          className={input}
          placeholder={
            instructor ? "Search quiz or student..." : "Search quizzes..."
          }
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Filter attempt status"
          className={input}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">All attempts</option>
          <option value="in_progress">In progress</option>
          <option value="graded">Completed</option>
        </select>
      </div>
      {loading ? (
        <Loading />
      ) : !visible.length ? (
        <Empty>No attempts match this view.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              {instructor ? "Student quiz attempts" : "Your quiz attempts"}
            </caption>
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
                <th scope="col" className="px-5 py-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((attempt) => (
                <tr
                  key={attempt.id}
                  className="border-b border-stone-100 last:border-0"
                >
                  <td className="px-5 py-4 font-medium">
                    {attempt.quiz?.title || "Unavailable quiz"}
                  </td>
                  {instructor && (
                    <td className="px-5 py-4">
                      {attempt.student?.name || "Unknown student"}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-5 py-4">
                    <Badge>
                      {attempt.status === "graded"
                        ? "Completed"
                        : attempt.status.replaceAll("_", " ")}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    {attempt.status === "graded" && attempt.score !== null
                      ? attempt.score + " / " + attempt.maxScore
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-stone-500">
                    {dateLabel(attempt.startedAt)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className={secondary}
                        href={"/web-page/attempts/" + attempt.id}
                      >
                        {attempt.status === "graded"
                          ? "View Result"
                          : instructor
                            ? "View Attempt"
                            : "Continue"}
                      </Link>
                      {(instructor || attempt.status === "in_progress") && (
                        <button
                          disabled={Boolean(busy)}
                          className={danger}
                          onClick={() => remove(attempt)}
                        >
                          {busy === attempt.id
                            ? "Deleting..."
                            : instructor
                              ? "Delete"
                              : "Discard"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Workspace>
  );
}

export default function AttemptsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AttemptList />
    </Suspense>
  );
}

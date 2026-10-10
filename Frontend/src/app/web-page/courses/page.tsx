"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { api, message, type Course } from "../_lib/api";
import { useSession } from "../_lib/use-session";
import {
  Workspace,
  Empty,
  Field,
  Loading,
  Notice,
  card,
  input,
  primary,
  secondary,
} from "../_components/workspace";

export default function CoursesPage() {
  const session = useSession();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const instructor = session.user?.role === "instructor";

  useEffect(() => {
    if (!session.user) return;
    const controller = new AbortController();

    api<Course[]>("/api/course", { signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted) setCourses(items);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [session.user, revision]);

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setSuccess("");

    if (!code.trim() || !name.trim()) {
      setError("Course code and name are required.");

      return;
    }

    setBusy(true);

    try {
      const course = await api<Course>("/api/course", {
        method: "POST",
        body: JSON.stringify({ code: code.trim(), name: name.trim() }),
      });

      setCourses((items) => [...items, course].sort((a, b) => a.code.localeCompare(b.code)));
      setCode("");
      setName("");
      setCreating(false);
      setSuccess(`Course ${course.code} created. Open it to add students.`);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Workspace
      session={session}
      active="courses"
      title="My Courses"
      description={
        instructor
          ? "Group students by course code, then assign quizzes to a course."
          : "Courses you are enrolled in. Quizzes assigned to these courses appear under Available Quizzes."
      }
    >
      <div className="mb-6 flex flex-wrap gap-3">
        {instructor && (
          <button className={primary} onClick={() => setCreating((value) => !value)}>
            {creating ? "Hide Form" : "New Course"}
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
      </div>

      {creating && instructor && (
        <section className={`${card} mb-6`}>
          <h2 className="mb-5 text-xl font-semibold">Create Course</h2>
          <form onSubmit={createCourse} className="space-y-4">
            <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
              <Field label="Course code (e.g. CSX4107)">
                <input
                  className={`${input} uppercase`}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  pattern="[A-Za-z0-9\-]{2,20}"
                  title="2-20 letters, digits or dashes"
                  required
                  maxLength={20}
                />
              </Field>
              <Field label="Course name">
                <input
                  className={input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                />
              </Field>
            </fieldset>
            <div className="flex flex-wrap gap-3">
              <button className={primary} disabled={busy}>
                {busy ? "Creating..." : "Create Course"}
              </button>
              <button
                type="button"
                className={secondary}
                disabled={busy}
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="mb-5 space-y-3">
        <Notice>{error}</Notice>
        <Notice good>{success}</Notice>
      </div>

      {loading ? (
        <Loading />
      ) : courses.length === 0 ? (
        <Empty>
          {instructor
            ? "Create a course to start grouping students."
            : "You are not enrolled in any course yet. Ask your instructor to add you."}
        </Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {courses.map((course) => (
            <article className={card} key={course.id}>
              <p className="text-xs font-medium uppercase tracking-wider text-orange-600">
                {course.code}
              </p>
              <h2 className="mt-2 text-xl font-semibold">{course.name}</h2>
              <p className="mt-2 text-sm text-stone-500">
                {course.studentCount} student{course.studentCount === 1 ? "" : "s"}
              </p>
              {instructor && (
                <Link className={`${primary} mt-5`} href={`/web-page/courses/${course.id}`}>
                  Manage Course
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
    </Workspace>
  );
}

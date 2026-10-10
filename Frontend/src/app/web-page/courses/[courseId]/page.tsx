"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, message, type Course, type CourseDetail, type CourseStudent } from "../../_lib/api";
import { useSession } from "../../_lib/use-session";
import {
  Workspace,
  Badge,
  Empty,
  Field,
  Loading,
  Notice,
  card,
  danger,
  input,
  primary,
  secondary,
} from "../../_components/workspace";

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const session = useSession();
  const [data, setData] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [emails, setEmails] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!session.user) return;
    const controller = new AbortController();

    api<CourseDetail>(`/api/course/${courseId}`, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setName(result.course.name);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [session.user, courseId, revision]);

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !data) return;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const course = await api<Course>(`/api/course/${courseId}`, {
        method: "PUT",
        body: JSON.stringify({ name: name.trim() }),
      });

      setData({ ...data, course });
      setSuccess("Course name saved.");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function addStudents(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const list = [
      ...new Set(
        emails
          .split(/[\s,;]+/)
          .map((e) => e.trim())
          .filter(Boolean),
      ),
    ];

    if (!list.length) {
      setError("Enter at least one student email.");

      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const result = await api<{ enrolled: number; notFound: string[] }>(
        `/api/course/${courseId}/students`,
        { method: "POST", body: JSON.stringify({ emails: list }) },
      );

      setEmails(result.notFound.join("\n"));
      setSuccess(`${result.enrolled} student${result.enrolled === 1 ? "" : "s"} enrolled.`);

      if (result.notFound.length) {
        setError(
          `No student account found for: ${result.notFound.join(", ")}. They need to register first.`,
        );
      }

      setRevision((value) => value + 1);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeStudent(student: CourseStudent) {
    if (
      busy ||
      !data ||
      !window.confirm(
        `Remove ${student.name} from ${data.course.code}? They will no longer see this course's quizzes.`,
      )
    )
      return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await api<void>(`/api/course/${courseId}/students/${student.id}`, { method: "DELETE" });
      setData({
        ...data,
        students: data.students.filter((s) => s.id !== student.id),
        course: { ...data.course, studentCount: data.course.studentCount - 1 },
      });
      setSuccess(`${student.name} removed.`);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCourse() {
    if (
      busy ||
      !data ||
      !window.confirm(`Delete course ${data.course.code}? This cannot be undone.`)
    )
      return;

    setBusy(true);
    setError("");

    try {
      await api<void>(`/api/course/${courseId}`, { method: "DELETE" });
      router.push("/web-page/courses");
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }

  return (
    <Workspace
      session={session}
      active="courses"
      title={data ? `${data.course.code} — ${data.course.name}` : "Course"}
      description="Students in this course can see quizzes assigned to it."
    >
      <div className="mb-5 flex flex-wrap gap-3">
        <Link className={secondary} href="/web-page/courses">
          Back to Courses
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
      </div>

      <div className="mb-5 space-y-3">
        <Notice>{error}</Notice>
        <Notice good>{success}</Notice>
      </div>

      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <section className={`${card} mb-6`}>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Badge>{data.course.studentCount} students</Badge>
                <Badge>{data.quizCount} quizzes assigned</Badge>
              </div>
              <form onSubmit={rename} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Course name">
                  <input
                    className={input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={120}
                    disabled={busy}
                  />
                </Field>
                <button
                  className={secondary}
                  disabled={busy || !name.trim() || name.trim() === data.course.name}
                >
                  Save Name
                </button>
              </form>
              <div className="mt-5">
                <button
                  className={danger}
                  disabled={busy || data.quizCount > 0}
                  onClick={deleteCourse}
                >
                  Delete Course
                </button>
                {data.quizCount > 0 && (
                  <p className="mt-2 text-xs text-stone-500">
                    Reassign or delete the quizzes in this course before deleting it.
                  </p>
                )}
              </div>
            </section>

            <section className={`${card} mb-6`}>
              <h2 className="mb-4 text-xl font-semibold">Add Students</h2>
              <form onSubmit={addStudents} className="space-y-4">
                <Field label="Student emails (one per line, or separated by commas)">
                  <textarea
                    className={input}
                    rows={4}
                    value={emails}
                    onChange={(e) => setEmails(e.target.value)}
                    placeholder={"student1@example.com\nstudent2@example.com"}
                    disabled={busy}
                  />
                </Field>
                <button className={primary} disabled={busy || !emails.trim()}>
                  {busy ? "Adding..." : "Add to Course"}
                </button>
              </form>
            </section>

            <h2 className="mb-4 text-xl font-semibold">Enrolled Students</h2>
            {data.students.length === 0 ? (
              <Empty>No students enrolled yet.</Empty>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Enrolled students</caption>
                  <thead className="border-b border-stone-200 bg-stone-50 text-stone-500">
                    <tr>
                      <th scope="col" className="px-5 py-4">
                        Name
                      </th>
                      <th scope="col" className="px-5 py-4">
                        Email
                      </th>
                      <th scope="col" className="px-5 py-4">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((student) => (
                      <tr className="border-b border-stone-100 last:border-0" key={student.id}>
                        <td className="px-5 py-4 font-medium">{student.name}</td>
                        <td className="px-5 py-4 text-stone-500">{student.email}</td>
                        <td className="px-5 py-4 text-right">
                          <button
                            className={danger}
                            disabled={busy}
                            onClick={() => removeStudent(student)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      )}
    </Workspace>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, localDate, message, type Course, type Quiz, type QuizInput } from "../_lib/api";
import { Field, Notice, input, primary, secondary } from "./workspace";

export function QuizForm({
  quiz,
  onSave,
  onCancel,
}: {
  quiz?: Quiz;
  onSave: (data: QuizInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(quiz?.title || "");
  const [subject, setSubject] = useState(quiz?.subject || "");
  const [courseCode, setCourseCode] = useState(quiz?.courseCode || "");
  const [description, setDescription] = useState(quiz?.description || "");
  const [minutes, setMinutes] = useState(quiz?.timeLimitMinutes ?? 10);
  const [passing, setPassing] = useState(quiz?.passingScore ?? 50);
  const [opens, setOpens] = useState(localDate(quiz?.opensAt || null));
  const [closes, setCloses] = useState(localDate(quiz?.closesAt || null));
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    api<Course[]>("/api/course", { signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted) setCourses(items);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setCoursesLoading(false);
      });

    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");

    if (!title.trim() || !subject.trim()) {
      setError("Title and subject are required.");

      return;
    }

    if (opens && closes && new Date(closes) <= new Date(opens)) {
      setError("Closing time must be after opening time.");

      return;
    }

    setBusy(true);

    try {
      const data: QuizInput = {
        title: title.trim(),
        subject: subject.trim(),
        courseCode: courseCode || null,
        description: description.trim(),
        timeLimitMinutes: minutes,
        passingScore: passing,
      };

      if (quiz || opens) data.opensAt = opens ? new Date(opens).toISOString() : null;
      if (quiz || closes) data.closesAt = closes ? new Date(closes).toISOString() : null;
      await onSave(data);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  // Keep the current assignment selectable even before the course list loads.
  const currentCode = quiz?.courseCode;
  const missingCurrent = currentCode && !courses.some((c) => c.code === currentCode);

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <Field label="Quiz title">
          <input
            className={input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject">
            <input
              className={input}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              maxLength={120}
            />
          </Field>
          <Field label="Assign to">
            <select
              className={input}
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              disabled={coursesLoading}
            >
              <option value="">All students</option>
              {missingCurrent && <option value={currentCode}>{currentCode}</option>}
              {courses.map((course) => (
                <option key={course.id} value={course.code}>
                  {`${course.code} — ${course.name} (${course.studentCount} students)`}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {!coursesLoading && courses.length === 0 && (
          <p className="text-xs text-stone-500">
            You have no courses yet. Create one under My Courses to assign this quiz to a specific
            group of students.
          </p>
        )}
        <Field label="Description">
          <textarea
            className={input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Time limit in minutes (0 = no limit)">
            <input
              className={input}
              type="number"
              min={0}
              max={180}
              step={1}
              required
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </Field>
          <Field label="Passing score (%)">
            <input
              className={input}
              type="number"
              min={0}
              max={100}
              step="any"
              required
              value={passing}
              onChange={(e) => setPassing(Number(e.target.value))}
            />
          </Field>
          <Field label="Opens at (optional, your local time)">
            <input
              className={input}
              type="datetime-local"
              value={opens}
              onChange={(e) => setOpens(e.target.value)}
            />
          </Field>
          <Field label="Closes at (optional, your local time)">
            <input
              className={input}
              type="datetime-local"
              value={closes}
              onChange={(e) => setCloses(e.target.value)}
            />
          </Field>
        </div>
      </fieldset>
      <Notice>{error}</Notice>
      <div className="flex flex-wrap gap-3">
        <button className={primary} disabled={busy}>
          {busy ? "Saving..." : quiz ? "Save Settings" : "Create Quiz"}
        </button>
        {onCancel && (
          <button type="button" className={secondary} disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

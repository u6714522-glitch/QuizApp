export type User = {
  id: string;
  name: string;
  email: string;
  role: "student" | "instructor";
  isAdmin?: boolean;
};

export type QuizStatus = "draft" | "published" | "closed";

export type Quiz = {
  id: string;
  ownerId: string;
  title: string;
  subject: string;
  courseCode: string | null;
  description: string;
  status: QuizStatus;
  timeLimitMinutes: number;
  passingScore: number;
  opensAt: string | null;
  closesAt: string | null;
};

export type QuestionType = "multiple_choice" | "true_false" | "short_answer";

export type Choice = { key: string; text: string };

export type Question = {
  id: string;
  quizId?: string;
  type: QuestionType;
  prompt: string;
  choices: Choice[];
  correctAnswer?: string;
  explanation?: string;
  points: number;
  order: number;
};

export type Answer = {
  questionId: string;
  given: string | null;
  isCorrect?: boolean | null;
  pointsAwarded?: number | null;
};

export type Attempt = {
  id: string;
  quizId: string;
  studentId: string;
  status: "in_progress" | "submitted" | "graded";
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number;
  answers?: Answer[];
  questions?: Question[];
  student?: { id: string; name: string };
  quiz?: { id: string; title: string };
};

export type QuizInput = {
  title: string;
  subject: string;
  courseCode: string | null;
  description: string;
  timeLimitMinutes: number;
  passingScore: number;
  opensAt?: string | null;
  closesAt?: string | null;
};

export type Course = {
  id: string;
  ownerId: string;
  code: string;
  name: string;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CourseStudent = { id: string; name: string; email: string };

export type CourseDetail = {
  course: Course;
  students: CourseStudent[];
  quizCount: number;
};

export type QuestionInput = {
  type: QuestionType;
  prompt: string;
  points: number;
  order: number;
  explanation: string;
  correctAnswer: string;
  choices?: Choice[];
};

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");

  const response = await fetch(API_URL + path, {
    ...options,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      // A full page load is intended here: it clears all client state once the
      // session is gone. useRouter() isn't available in this plain helper.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/web-page/login");
    }

    throw new ApiError(
      data?.error?.message || "Request failed. Please try again.",
      response.status,
    );
  }

  if (data === null) throw new Error("Unexpected server response.");

  return data as T;
}

export function message(error: unknown): string {
  return error instanceof TypeError
    ? "Cannot connect to the quiz server. Please check your connection."
    : error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.";
}

export async function allQuizzes(signal?: AbortSignal): Promise<Quiz[]> {
  const items: Quiz[] = [];

  for (let page = 1; ; page++) {
    const batch = await api<Quiz[]>(`/api/quiz?page=${page}&limit=50`, {
      signal,
    });

    if (!Array.isArray(batch)) throw new Error("Unexpected quiz response.");
    items.push(...batch);
    if (batch.length < 50) return items;
  }
}

export function availability(quiz: Quiz, now = Date.now()) {
  if (quiz.status !== "published") return quiz.status;
  if (quiz.opensAt && new Date(quiz.opensAt).getTime() > now) return "Upcoming";
  if (quiz.closesAt && new Date(quiz.closesAt).getTime() < now) return "Closed";

  return "Open";
}

export function deadline(attempt: Attempt, quiz: Quiz | null): number | null {
  if (!quiz) return null;
  const limits: number[] = [];
  if (quiz.timeLimitMinutes > 0)
    limits.push(new Date(attempt.startedAt).getTime() + quiz.timeLimitMinutes * 60_000);
  if (quiz.closesAt) limits.push(new Date(quiz.closesAt).getTime());

  return limits.length ? Math.min(...limits) : null;
}

export function localDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function dateLabel(value: string | null): string {
  return value ? new Date(value).toLocaleString("en-GB") : "Not set";
}

export function answerLabel(question: Question, value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "No answer";

  if (question.type === "multiple_choice") {
    const choice = question.choices?.find((item) => item.key === value);

    return choice ? `${choice.key}. ${choice.text}` : value;
  }

  return question.type === "true_false" ? (value === "true" ? "True" : "False") : value;
}

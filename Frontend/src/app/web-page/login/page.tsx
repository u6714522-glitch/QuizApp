"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Role = "student" | "instructor";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/api/authentication/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error?.message || "Unable to sign in. Please try again.");
      }

      const user = data?.user;

      if (
        typeof user?.id !== "string" ||
        typeof user?.name !== "string" ||
        !["student", "instructor"].includes(user?.role)
      ) {
        throw new Error("Unexpected response. Please try again.");
      }

      setRole(user.role);
      setPassword("");
      setSuccess(`Welcome, ${user.name}. You are signed in as ${user.role}.`);
      router.replace("/web-page/dashboard");
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot connect to the quiz server. Please try again later."
          : err instanceof Error
            ? err.message
            : "Unable to sign in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-full border border-stone-200 bg-white px-6 py-4 text-sm text-stone-900 outline-none placeholder:text-stone-500 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:opacity-60 sm:py-5";

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#ece9e6] p-4 sm:p-8 lg:p-12">
      {/* Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-32 left-0 h-[500px] w-[500px] rounded-full bg-orange-200/60 blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-[450px] w-[600px] rounded-full bg-stone-400/50 blur-[100px]" />
      </div>

      <div className="grid w-full max-w-[1280px] overflow-hidden rounded-[32px] bg-[#26211e] shadow-[0_30px_90px_-20px_rgba(38,33,30,0.45)] lg:min-h-[760px] lg:grid-cols-2 lg:rounded-[52px]">
        {/* Left panel */}
        <section className="relative isolate overflow-hidden px-7 py-10 text-white sm:px-12 lg:min-h-[760px] lg:px-10 lg:pb-0 lg:pt-14">
          <p className="text-center text-xs leading-relaxed text-stone-400 sm:text-sm">
            Create quizzes. Test your knowledge. Track your progress.
          </p>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-24 -z-10 h-80 w-80 -translate-x-1/2 rounded-full border border-white/[0.07] lg:top-32 lg:h-96 lg:w-96"
          >
            <div className="absolute inset-10 rounded-full border border-white/[0.07]" />
            <div className="absolute inset-20 rounded-full border border-white/[0.07]" />
          </div>

          <h1 className="relative mx-auto mt-8 max-w-lg text-center text-[clamp(2.2rem,4.1vw,3.5rem)] font-medium leading-[1.08] tracking-[-0.05em] lg:mt-28">
            <span className="block">Self-Hosted</span>
            <span className="block">Classroom Quiz</span>
            <span className="block">Platform</span>
          </h1>

          {/* Decorative quiz phone */}
          <div
            aria-hidden="true"
            className="relative mx-auto mt-10 hidden h-[370px] w-[230px] rotate-[-12deg] rounded-[38px] border-[7px] border-[#4a4541] bg-[#111111] p-2 shadow-[22px_25px_50px_rgba(0,0,0,0.6)] lg:block"
          >
            <div className="h-full overflow-hidden rounded-[25px] bg-[#faf9f6] px-4 pb-5 pt-3 text-stone-900">
              <div className="mx-auto mb-5 h-4 w-20 rounded-full bg-[#111111]" />

              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold">QuizDeck</span>
                <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-700">12:45</span>
              </div>

              <p className="mt-6 text-[9px] font-medium uppercase tracking-widest text-stone-400">
                Web Development
              </p>
              <p className="mt-2 text-lg font-semibold leading-tight">
                Ready for your next challenge?
              </p>

              <div className="mt-4 h-1 rounded-full bg-stone-200">
                <div className="h-full w-2/5 rounded-full bg-orange-500" />
              </div>

              <p className="mt-4 text-[9px] text-stone-400">QUESTION 4 OF 10</p>
              <p className="mt-2 text-xs font-medium">Which method retrieves data from an API?</p>

              <div className="mt-4 space-y-2 text-[10px]">
                <div className="rounded-lg border border-orange-400 bg-orange-50 px-3 py-2 font-semibold text-orange-700">
                  A. GET
                  <span className="float-right">✓</span>
                </div>
                <div className="rounded-lg border border-stone-200 px-3 py-2">B. DELETE</div>
                <div className="rounded-lg border border-stone-200 px-3 py-2">C. PATCH</div>
              </div>

              <div className="mt-4 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 py-2 text-center text-[10px] font-medium text-white">
                Next question →
              </div>
            </div>
          </div>
        </section>

        {/* Right panel */}
        <section className="relative z-10 flex flex-col rounded-[32px] bg-white px-6 py-8 sm:px-12 lg:rounded-[52px] lg:px-14 lg:py-12">
          <header className="flex items-center justify-between gap-4">
            <Link
              href="/"
              aria-label="QuizDeck home"
              className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-stone-950"
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[conic-gradient(#fb923c,#f43f5e,#a855f7,#38bdf8,#4ade80,#facc15,#fb923c)]"
              >
                <span className="h-5 w-5 rounded-full bg-white" />
              </span>
              QuizDeck
            </Link>

            <Link
              href="/web-page/register"
              className="rounded-full px-2 py-2 text-sm text-stone-600 transition hover:text-orange-600 focus-visible:outline-2 focus-visible:outline-orange-500"
            >
              Sign Up ↗
            </Link>
          </header>

          <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-14 lg:py-16">
            <h2 className="mb-9 text-4xl font-medium tracking-[-0.045em] text-[#172329] sm:text-5xl">
              Sign In
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="Email address"
                  required
                  disabled={loading}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="relative">
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Password"
                  minLength={10}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`${inputClass} pr-16`}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-stone-400 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-orange-500"
                >
                  <svg
                    aria-hidden="true"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                    {!showPassword && <path d="m3 3 18 18" />}
                  </svg>
                </button>
              </div>

              <fieldset disabled={loading}>
                <legend className="sr-only">Account type</legend>
                <div className="flex gap-2 px-1">
                  {(["student", "instructor"] as const).map((item) => (
                    <label
                      key={item}
                      className={`cursor-pointer rounded-full border px-4 py-2 text-xs capitalize transition ${
                        role === item
                          ? "border-orange-200 bg-orange-50 text-orange-700"
                          : "border-stone-200 text-stone-500 hover:bg-stone-50"
                      } focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-orange-500`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={item}
                        checked={role === item}
                        onChange={() => setRole(item)}
                        className="sr-only"
                      />
                      {item}
                    </label>
                  ))}
                </div>
              </fieldset>

              {error && (
                <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              {success && (
                <p role="status" className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-3 flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-b from-[#ff5a00] via-[#ff4a24] to-[#e44984] px-6 py-4 text-sm font-medium text-white shadow-sm transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 disabled:cursor-wait disabled:opacity-60 sm:py-5"
              >
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M13 7l5 5-5 5M8 12h13" />
                </svg>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>

          <footer className="flex items-center justify-between gap-4 text-xs text-stone-400">
            <span>© {new Date().getFullYear()} QuizDeck</span>
            <span>Learn. Practice. Improve.</span>
          </footer>
        </section>
      </div>
    </main>
  );
}

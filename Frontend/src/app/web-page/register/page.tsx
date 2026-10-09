"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

// useSearchParams needs a Suspense boundary, or `next build` fails.
export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const inviteToken = useSearchParams().get("invite") ?? "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || success) return;

    setError("");

    if (!name.trim()) {
      setError("Please enter your name.");

      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");

      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/authentication/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          ...(inviteToken && { inviteToken }),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error?.message || "Unable to create your account.");
      }

      const role = data?.user?.role;

      if (typeof data?.user?.id !== "string" || !["student", "instructor"].includes(role)) {
        throw new Error("Unexpected response. Please try signing in.");
      }

      setPassword("");
      setConfirmPassword("");
      setSuccess(`Account created. You are now signed in as ${role}.`);
      router.replace("/web-page/dashboard");
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot connect to the quiz server. Please try again later."
          : err instanceof Error
            ? err.message
            : "Unable to create your account.",
      );
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || Boolean(success);

  const inputClass =
    "w-full rounded-full border border-stone-200 bg-white px-6 py-4 text-sm text-stone-900 outline-none placeholder:text-stone-500 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:opacity-60";

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#ece9e6] p-4 sm:p-8 lg:p-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-32 left-0 h-[500px] w-[500px] rounded-full bg-orange-200/60 blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-[450px] w-[600px] rounded-full bg-stone-400/50 blur-[100px]" />
      </div>

      <div className="grid w-full max-w-[1280px] overflow-hidden rounded-[32px] bg-[#26211e] shadow-[0_30px_90px_-20px_rgba(38,33,30,0.45)] lg:min-h-[760px] lg:grid-cols-2 lg:rounded-[52px]">
        {/* Left panel */}
        <section className="relative isolate flex flex-col justify-center overflow-hidden px-7 py-12 text-white sm:px-12 lg:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07] lg:h-96 lg:w-96"
          >
            <div className="absolute inset-10 rounded-full border border-white/[0.07]" />
            <div className="absolute inset-20 rounded-full border border-white/[0.07]" />
          </div>

          <p className="mb-8 text-center text-sm text-stone-400">
            Your next challenge starts here.
          </p>

          <h1 className="text-center text-[clamp(2.2rem,4.1vw,3.5rem)] font-medium leading-[1.08] tracking-[-0.05em]">
            <span className="block">Self-Hosted</span>
            <span className="block">Classroom Quiz</span>
            <span className="block">Platform</span>
          </h1>

          <p className="mx-auto mt-8 max-w-xs text-center text-sm leading-7 text-stone-400">
            {inviteToken
              ? "Create quizzes, publish them to your class, and review student results."
              : "Join your classroom, take quizzes, and track your learning progress."}
          </p>
        </section>

        {/* Right panel */}
        <section className="flex flex-col rounded-[32px] bg-white px-6 py-8 sm:px-12 lg:rounded-[52px] lg:px-14 lg:py-12">
          <header className="flex items-center justify-between gap-4">
            <Link
              href="/"
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
              href="/web-page/login"
              className="rounded-full px-2 py-2 text-sm text-stone-600 hover:text-orange-600"
            >
              Sign In ↗
            </Link>
          </header>

          <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-12">
            <h2 className="text-4xl font-medium tracking-[-0.045em] text-[#172329]">
              Create Account
            </h2>
            <p className="mb-7 mt-3 text-sm text-stone-500">
              {inviteToken
                ? "Create your instructor account."
                : "Create your student account to get started."}
            </p>

            {inviteToken && (
              <p className="mb-5 rounded-2xl bg-orange-50 p-3 text-sm text-orange-800">
                You&apos;ve been invited as an instructor. Register with the email address the
                invitation was sent to.
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="sr-only">
                  Full name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Full name"
                  required
                  maxLength={100}
                  disabled={disabled}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Email address"
                  required
                  disabled={disabled}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Password (at least 10 characters)"
                  required
                  minLength={10}
                  aria-describedby="password-help"
                  disabled={disabled}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="sr-only">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  required
                  minLength={10}
                  disabled={disabled}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex items-center justify-between gap-3 px-2 text-xs text-stone-500">
                <p id="password-help">At least 10 characters.</p>

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(event) => setShowPassword(event.target.checked)}
                    disabled={disabled}
                    className="accent-orange-500"
                  />
                  Show password
                </label>
              </div>

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
                disabled={disabled}
                className="w-full rounded-full bg-gradient-to-b from-[#ff5a00] via-[#ff4a24] to-[#e44984] px-6 py-4 text-sm font-medium text-white transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating account..." : success ? "Account Created" : "Create Account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-stone-500">
              Already have an account?{" "}
              <Link href="/web-page/login" className="font-medium text-orange-600 hover:underline">
                Sign In
              </Link>
            </p>
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

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, message, type User } from "../_lib/api";

type Invitation = {
  email: string;
  role: "instructor";
  expiresAt: string;
};

function RegisterInstructorForm({ token }: { token: string }) {
  const router = useRouter();
  const validToken = /^[a-f0-9]{64}$/.test(token);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [checking, setChecking] = useState(validToken);
  const [inviteError, setInviteError] = useState("");
  const [revision, setRevision] = useState(0);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!validToken) return;
    const controller = new AbortController();

    async function checkInvitation() {
      try {
        const data = await api<{ invitation: Invitation }>(
          `/api/authentication/invitation?token=${encodeURIComponent(token)}`,
          { signal: controller.signal, referrerPolicy: "no-referrer" },
        );

        if (controller.signal.aborted) return;

        const invite = data?.invitation;

        if (
          typeof invite?.email !== "string" ||
          invite.role !== "instructor" ||
          typeof invite.expiresAt !== "string" ||
          !Number.isFinite(Date.parse(invite.expiresAt))
        ) {
          throw new Error("Unexpected invitation response. Please try again.");
        }

        setInvitation(invite);
      } catch (err) {
        if (!controller.signal.aborted) setInviteError(message(err));
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    }

    void checkInvitation();

    return () => controller.abort();
  }, [token, validToken, revision]);

  function retryInvitation() {
    setChecking(true);
    setInviteError("");
    setRevision((value) => value + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || success || checking || !invitation) return;

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
      const data = await api<{ user: User; requiresLogin?: boolean }>(
        "/api/authentication/register-instructor",
        {
          method: "POST",
          referrerPolicy: "no-referrer",
          body: JSON.stringify({
            name: name.trim(),
            email: invitation.email,
            password,
            token,
          }),
        },
      );

      if (
        typeof data?.user?.id !== "string" ||
        data.user.role !== "instructor"
      ) {
        throw new Error("Unexpected response. Please try signing in.");
      }

      setPassword("");
      setConfirmPassword("");

      if (data.requiresLogin) {
        setSuccess(
          "Your instructor account was created. Please use Sign In below to continue.",
        );
        return;
      }

      setSuccess("Account created. Opening your instructor dashboard...");
      router.replace("/web-page/dashboard");
    } catch (err) {
      if (err instanceof ApiError && [404, 410].includes(err.status)) {
        setInvitation(null);
        setInviteError(message(err));
      } else {
        setError(message(err));
      }
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || Boolean(success);

  const invitationProblem = validToken
    ? inviteError
    : "This link is missing a valid invitation token. Please ask for a new invitation.";

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
        <section className="relative isolate flex flex-col justify-center overflow-hidden px-7 py-12 text-white sm:px-12 lg:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07] lg:h-96 lg:w-96"
          >
            <div className="absolute inset-10 rounded-full border border-white/[0.07]" />
            <div className="absolute inset-20 rounded-full border border-white/[0.07]" />
          </div>

          <p className="mb-8 text-center text-sm text-stone-400">
            Your teaching workspace starts here.
          </p>

          <h1 className="text-center text-[clamp(2.2rem,4.1vw,3.5rem)] font-medium leading-[1.08] tracking-[-0.05em]">
            <span className="block">Self-Hosted</span>
            <span className="block">Classroom Quiz</span>
            <span className="block">Platform</span>
          </h1>

          <p className="mx-auto mt-8 max-w-xs text-center text-sm leading-7 text-stone-400">
            Create classroom quizzes, manage questions, and follow your
            students’ progress.
          </p>
        </section>

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
              Instructor Account
            </h2>

            <p className="mb-7 mt-3 text-sm text-stone-500">
              Accept your invitation to join QuizDeck as an instructor.
            </p>

            {checking ? (
              <p
                role="status"
                className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-600"
              >
                Checking your invitation...
              </p>
            ) : !invitation ? (
              <div>
                <p
                  role="alert"
                  className="rounded-2xl bg-red-50 p-4 text-sm text-red-700"
                >
                  {invitationProblem || "Unable to load your invitation."}
                </p>

                {validToken && (
                  <button
                    type="button"
                    onClick={retryInvitation}
                    className="mt-4 rounded-full border border-stone-200 px-5 py-3 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    Try again
                  </button>
                )}
              </div>
            ) : (
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
                    readOnly
                    value={invitation.email}
                    aria-describedby="invitation-help"
                    className={inputClass + " bg-stone-50"}
                  />
                  <p
                    id="invitation-help"
                    className="mt-2 px-2 text-xs leading-5 text-stone-500"
                  >
                    This invitation is for the email above. Expires:{" "}
                    {new Date(invitation.expiresAt).toLocaleString("en-GB")}.
                  </p>
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
                      onChange={(event) =>
                        setShowPassword(event.target.checked)
                      }
                      disabled={disabled}
                      className="accent-orange-500"
                    />
                    Show password
                  </label>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-2xl bg-red-50 p-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}

                {success && (
                  <p
                    role="status"
                    className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700"
                  >
                    {success}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={disabled}
                  className="w-full rounded-full bg-gradient-to-b from-[#ff5a00] via-[#ff4a24] to-[#e44984] px-6 py-4 text-sm font-medium text-white transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Creating account..."
                    : success
                      ? "Account Created"
                      : "Create Instructor Account"}
                </button>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-stone-500">
              Already have an account?{" "}
              <Link
                href="/web-page/login"
                className="font-medium text-orange-600 hover:underline"
              >
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

function InvitationEntry() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  return <RegisterInstructorForm key={token} token={token} />;
}

export default function RegisterInstructorPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#ece9e6] p-6">
          <p role="status" className="text-sm text-stone-600">
            Loading your invitation...
          </p>
        </main>
      }
    >
      <InvitationEntry />
    </Suspense>
  );
}
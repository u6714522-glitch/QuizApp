"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api, message } from "../_lib/api";
import type { useSession } from "../_lib/use-session";

export const primary =
  "inline-flex items-center justify-center rounded-full bg-gradient-to-b from-orange-500 to-pink-500 px-5 py-2.5 text-sm font-medium text-white hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500";

export const secondary =
  "inline-flex items-center justify-center rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50";

export const danger =
  "inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50";

export const input =
  "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-stone-50 disabled:opacity-60";

export const card = "rounded-2xl border border-stone-200 bg-white p-5 sm:p-6";

export function Notice({ children, good = false }: { children: ReactNode; good?: boolean }) {
  if (!children) return null;

  return (
    <p
      role={good ? "status" : "alert"}
      className={`rounded-xl p-4 text-sm ${
        good ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
      }`}
    >
      {children}
    </p>
  );
}

export function Loading() {
  return (
    <p role="status" className="py-10 text-center text-sm text-stone-500">
      Loading...
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
      {children}
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium capitalize text-orange-700">
      {children}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}

export function Workspace({
  session,
  active,
  title,
  description,
  children,
}: {
  session: ReturnType<typeof useSession>;
  active: "dashboard" | "quizzes" | "courses" | "attempts";
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { user } = session;

  async function logout() {
    if (busy) return;
    setBusy(true);

    try {
      await api("/api/authentication/logout", { method: "POST" });
      router.replace("/web-page/login");
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }

  if (session.loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
        <div className={`${card} w-full max-w-md text-center`}>
          <p className="mb-5 text-2xl font-semibold text-orange-600">QuizDeck</p>
          {session.error ? (
            <>
              <Notice>{session.error}</Notice>
              <button className={`${secondary} mt-5`} onClick={session.retry}>
                Try again
              </button>
            </>
          ) : (
            <Loading />
          )}
        </div>
      </main>
    );
  }

  const links = [
    { key: "dashboard", label: "Overview", path: "/web-page/dashboard" },
    {
      key: "quizzes",
      label: user.role === "instructor" ? "My Quizzes" : "Available Quizzes",
      path: "/web-page/quizzes",
    },
    { key: "courses", label: "My Courses", path: "/web-page/courses" },
    {
      key: "attempts",
      label: user.role === "instructor" ? "Student Results" : "My Attempts",
      path: "/web-page/attempts",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f7f5] text-stone-900 lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col bg-[#26211e] px-6 py-7 text-white lg:sticky lg:top-0 lg:h-screen">
        <Link href="/web-page/dashboard" className="text-2xl font-semibold">
          Quiz<span className="text-orange-400">Deck</span>
        </Link>
        <p className="mt-2 text-xs capitalize text-stone-400">{user.role} workspace</p>
        <nav className="mt-8 flex flex-wrap gap-2 lg:flex-col" aria-label="Main navigation">
          {links.map((link) => (
            <Link
              key={link.key}
              href={link.path}
              aria-current={active === link.key ? "page" : undefined}
              className={`rounded-xl px-4 py-3 text-sm hover:bg-white/10 ${
                active === link.key ? "bg-white/10 text-white" : "text-stone-300"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 lg:mt-auto">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="mt-1 truncate text-xs text-stone-400">{user.email}</p>
          <button
            disabled={busy}
            onClick={logout}
            className="mt-5 w-full rounded-full border border-stone-600 px-4 py-2.5 text-sm hover:bg-white/10 disabled:opacity-50"
          >
            {busy ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </aside>
      <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        <header className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-orange-600">QuizDeck</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-3 text-sm text-stone-500">{description}</p>}
        </header>
        {error && (
          <div className="mb-5">
            <Notice>{error}</Notice>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

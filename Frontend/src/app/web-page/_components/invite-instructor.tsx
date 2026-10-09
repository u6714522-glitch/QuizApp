"use client";

import { useState, type FormEvent } from "react";
import { api, message } from "../_lib/api";
import { Notice, card, input, primary, secondary } from "./workspace";

type InviteResponse = {
  invite: { id: string; email: string; expiresAt: string };
  token: string;
};

export function InviteInstructor() {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [expires, setExpires] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setCopied(false);

    try {
      const data = await api<InviteResponse>("/api/invite", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });

      setLink(
        `${window.location.origin}/web-page/register?invite=${encodeURIComponent(data.token)}`,
      );
      setSentTo(data.invite.email);
      setExpires(new Date(data.invite.expiresAt).toLocaleString("en-GB"));
      setEmail("");
    } catch (err) {
      setLink("");
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError("Could not copy. Select the link and copy it manually.");
    }
  }

  return (
    <section className={`${card} mt-10`}>
      <h2 className="text-xl font-semibold">Invite an Instructor</h2>
      <p className="mt-1 text-sm text-stone-500">
        Creates a one-time link that lets this email register as an instructor. It expires in 7
        days.
      </p>

      <form onSubmit={submit} className="mt-5 flex flex-wrap gap-3">
        <label htmlFor="invite-email" className="sr-only">
          Instructor email
        </label>
        <input
          id="invite-email"
          type="email"
          required
          placeholder="new.teacher@example.com"
          value={email}
          disabled={busy}
          onChange={(event) => setEmail(event.target.value)}
          className={`${input} min-w-60 flex-1`}
        />
        <button className={primary} disabled={busy || !email.trim()}>
          {busy ? "Creating..." : "Create invite link"}
        </button>
      </form>

      <div className="mt-4">
        <Notice>{error}</Notice>
      </div>

      {link && (
        <div className="mt-4 space-y-3 rounded-xl bg-stone-50 p-4">
          <p className="text-sm text-stone-600">
            Send this link to <strong>{sentTo}</strong>. It works once and expires {expires}. You
            won&apos;t be able to see it again after you leave this page.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              readOnly
              aria-label="Invite link"
              value={link}
              onFocus={(event) => event.target.select()}
              className={`${input} min-w-60 flex-1 font-mono text-xs`}
            />
            <button type="button" className={secondary} onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

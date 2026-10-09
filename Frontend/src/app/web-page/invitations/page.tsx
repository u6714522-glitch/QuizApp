"use client";

import { useRef, useState, type FormEvent } from "react";
import { api, ApiError, message } from "../_lib/api";
import { useSession } from "../_lib/use-session";
import {
  Workspace,
  Notice,
  Field,
  card,
  input,
  primary,
  secondary,
} from "../_components/workspace";

type InvitationResponse = {
  invitation: {
    email: string;
    role: "instructor";
    expiresAt: string;
  };
  token: string;
};

type CreatedInvitation = {
  email: string;
  expiresAt: string;
  link: string;
};

export default function InvitationsPage() {
  const session = useSession();
  const linkInput = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copied, setCopied] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [created, setCreated] = useState<CreatedInvitation | null>(null);

  const canInvite =
    session.user?.role === "instructor" &&
    session.user.canInviteInstructors === true &&
    !forbidden;

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canInvite || busy || copying) return;

    setBusy(true);
    setError("");
    setCopyError("");
    setCopied(false);

    try {
      const data = await api<InvitationResponse>(
        "/api/authentication/invitations",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim() }),
        },
      );

      if (
        typeof data.token !== "string" ||
        !/^[a-f0-9]{64}$/.test(data.token) ||
        typeof data.invitation?.email !== "string" ||
        data.invitation.role !== "instructor" ||
        typeof data.invitation.expiresAt !== "string" ||
        !Number.isFinite(Date.parse(data.invitation.expiresAt))
      ) {
        throw new Error("Unexpected invitation response. Please try again.");
      }

      const link = new URL(
        "/web-page/register-instructor",
        window.location.origin,
      );
      link.searchParams.set("token", data.token);

      setCreated({
        email: data.invitation.email,
        expiresAt: data.invitation.expiresAt,
        link: link.toString(),
      });
      setEmail("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setCreated(null);
      }
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!created || !canInvite || busy || copying) return;

    setCopying(true);
    setCopyError("");
    setCopied(false);

    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable.");

      await navigator.clipboard.writeText(created.link);
      setCopied(true);
    } catch {
      linkInput.current?.focus();
      linkInput.current?.select();
      setCopyError(
        "Could not copy automatically. Select the link and copy it manually.",
      );
    } finally {
      setCopying(false);
    }
  }

  return (
    <Workspace
      session={session}
      active="invitations"
      title="Invite Instructor"
      description="Create a registration link for a new instructor."
    >
      <div className="max-w-2xl space-y-6">
        <Notice>{error}</Notice>

        {!canInvite ? (
          !error && (
            <Notice>You do not have permission to invite instructors.</Notice>
          )
        ) : (
          <>
            <section className={card}>
              <h2 className="text-lg font-semibold">New invitation</h2>

              <p className="mt-2 text-sm leading-6 text-stone-500">
                Enter the email the instructor will use to register. The link
                expires after 24 hours and can be used once.
              </p>

              <form onSubmit={createInvitation} className="mt-6 space-y-5">
                <Field label="Instructor email">
                  <input
                    name="email"
                    type="email"
                    autoComplete="off"
                    placeholder="teacher@example.com"
                    maxLength={254}
                    required
                    disabled={busy || copying}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={input}
                  />
                </Field>

                <button
                  type="submit"
                  disabled={busy || copying}
                  className={primary}
                >
                  {busy ? "Creating..." : "Create invitation"}
                </button>
              </form>
            </section>

            {created && (
              <section className={card + " space-y-5"}>
                <Notice good>
                  Invitation created for {created.email}.
                </Notice>

                <Field label="Registration link">
                  <input
                    ref={linkInput}
                    type="text"
                    readOnly
                    value={created.link}
                    onFocus={(event) => event.currentTarget.select()}
                    className={input}
                  />
                </Field>

                <button
                  type="button"
                  onClick={copyLink}
                  disabled={busy || copying}
                  className={secondary}
                >
                  {copying ? "Copying..." : "Copy link"}
                </button>

                {copied && <Notice good>Link copied.</Notice>}
                <Notice>{copyError}</Notice>

                <p className="text-sm leading-6 text-stone-500">
                  Expires: {new Date(created.expiresAt).toLocaleString()}
                  <br />
                  Copy this link and send it to {created.email}. No email is
                  sent automatically. Save the link before leaving this page.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </Workspace>
  );
}
"use client";

import { useEffect, useState } from "react";
import { api, message, type User } from "./api";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<{ user: User }>("/api/me", { signal: controller.signal })
      .then((data) => {
        if (
          !data.user?.id ||
          !["student", "instructor"].includes(data.user.role)
        )
          throw new Error("Unexpected user response.");
        if (!controller.signal.aborted) setUser(data.user);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  return {
    user,
    loading,
    error,
    retry: () => setRevision((value) => value + 1),
  };
}

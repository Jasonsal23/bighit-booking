"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid" | "submitting" | "done";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();

    async function establishSession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        setStatus(exchangeError ? "invalid" : "ready");
        return;
      }

      // Fallback for the implicit-grant style link (#access_token=...&type=recovery).
      const { data } = await supabase.auth.getSession();
      setStatus(data.session ? "ready" : "invalid");
    }

    establishSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setStatus("submitting");
    const supabase = getBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setStatus("ready");
      return;
    }
    setStatus("done");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <h1 className="font-display mb-2 text-center text-lg uppercase tracking-wide text-white">
          Reset Password
        </h1>

        {status === "checking" && (
          <p className="text-center text-sm text-[var(--muted)]">Verifying your reset link…</p>
        )}

        {status === "invalid" && (
          <p className="text-center text-sm text-[var(--accent-light)]">
            This reset link is invalid or expired. Request a new one from the app.
          </p>
        )}

        {status === "done" && (
          <p className="text-center text-sm text-[var(--muted)]">
            Your password has been updated. You can now log in with it in the app.
          </p>
        )}

        {(status === "ready" || status === "submitting") && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {error && (
              <div className="rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--accent-light)]">
                {error}
              </div>
            )}
            <label className="text-sm text-[var(--muted)]">
              New password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-black/20 px-3 py-2 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="text-sm text-[var(--muted)]">
              Confirm password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-black/20 px-3 py-2 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <button type="submit" disabled={status === "submitting"} className="brand-button mt-2 py-2.5 text-sm">
              {status === "submitting" ? "Saving…" : "Set New Password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

interface AppointmentDetails {
  id: string;
  customer_name: string;
  start_time: string;
  end_time: string;
  status: "booked" | "completed" | "no_show" | "cancelled";
  barbers: { name: string } | null;
  services: { name: string; price_cents: number } | null;
}

type LoadState = "loading" | "ready" | "error";

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ManageBookingPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </main>
      }
    >
      <ManageBookingContent />
    </Suspense>
  );
}

function ManageBookingContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [canCancel, setCanCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    async function run() {
      if (!params.id || !token) {
        setState("error");
        setError("This link is missing information and can't be used.");
        return;
      }

      try {
        const res = await fetch(`/api/manage/${params.id}?token=${token}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setAppointment(data.appointment);
        setCanCancel(data.canCancel);
        setState("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load this appointment.");
        setState("error");
      }
    }
    run();
  }, [params.id, token]);

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/manage/${params.id}/cancel?token=${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to cancel");
      setCancelled(true);
      setCanCancel(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <h1 className="font-display mb-4 text-center text-lg uppercase tracking-wide text-white">
          Manage Booking
        </h1>

        {state === "loading" && <p className="text-center text-sm text-[var(--muted)]">Loading…</p>}

        {state === "error" && (
          <p className="text-center text-sm text-[var(--accent-light)]">{error}</p>
        )}

        {state === "ready" && appointment && (
          <div>
            {error && (
              <div className="mb-4 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--accent-light)]">
                {error}
              </div>
            )}

            <div className="mb-4 rounded-md border border-[var(--card-border)] bg-black/20 p-3 text-sm">
              <p className="font-semibold text-white">
                {appointment.services?.name}
                {appointment.services ? ` · ${formatPrice(appointment.services.price_cents)}` : ""}
              </p>
              <p className="text-[var(--muted)]">
                {formatWhen(appointment.start_time)}
                {appointment.barbers ? ` · ${appointment.barbers.name}` : ""}
              </p>
              <p className="mt-2 text-xs uppercase tracking-wide text-[var(--muted)]">
                Status: {cancelled ? "cancelled" : appointment.status}
              </p>
            </div>

            {cancelled && (
              <p className="text-center text-sm text-[var(--muted)]">
                Your appointment has been cancelled.
              </p>
            )}

            {!cancelled && canCancel && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="brand-button w-full py-2.5 text-sm disabled:opacity-40"
              >
                {cancelling ? "Cancelling…" : "Cancel Appointment"}
              </button>
            )}

            {!cancelled && !canCancel && appointment.status === "booked" && (
              <p className="text-center text-sm text-[var(--muted)]">
                This appointment can no longer be cancelled online — it&apos;s within 3 hours of the
                start time. Please call the shop directly.
              </p>
            )}

            <a
              href="bighitbarbershop://account"
              className="mt-3 block w-full rounded-md border border-[var(--card-border)] py-2.5 text-center text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]"
            >
              Open in App
            </a>
          </div>
        )}
      </div>
    </main>
  );
}

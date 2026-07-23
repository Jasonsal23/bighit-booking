"use client";

import { useEffect, useMemo, useState } from "react";

interface Barber {
  id: string;
  name: string;
  photo_url: string | null;
  role: "barber" | "owner";
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
}

interface Slot {
  startTime: string;
  endTime: string;
  barberId: string;
  serviceId: string;
  priceCents: number;
}

type Step = "barber" | "opening" | "service" | "time" | "details" | "confirmed";

const ANY_BARBER = "any";

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function nextDays(count: number) {
  const days: { label: string; value: string }[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const value = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    days.push({ label, value });
  }
  return days;
}

export default function BookingFlow({ shopId }: { shopId: string }) {
  const [step, setStep] = useState<Step>("barber");
  const [detailsBackStep, setDetailsBackStep] = useState<Step>("time");

  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [openings, setOpenings] = useState<Slot[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);

  const [selectedBarberId, setSelectedBarberId] = useState<string>("");
  const [pinnedBarberId, setPinnedBarberId] = useState<string>("");
  const [preferredStartTime, setPreferredStartTime] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(nextDays(1)[0].value);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => nextDays(14), []);
  const isAnyBarber = selectedBarberId === ANY_BARBER;
  const effectiveBarberId = isAnyBarber ? pinnedBarberId : selectedBarberId;
  const selectedService = services.find((s) => s.id === selectedServiceId);
  const selectedSlotBarber = selectedSlot ? barbers.find((b) => b.id === selectedSlot.barberId) : undefined;

  function selectBarber(id: string) {
    setSelectedBarberId(id);
    setPinnedBarberId("");
    setPreferredStartTime("");
    setSelectedServiceId("");
    setSelectedSlot(null);
    setStep(id === ANY_BARBER ? "opening" : "service");
  }

  function selectOpening(slot: Slot) {
    setPinnedBarberId(slot.barberId);
    setPreferredStartTime(slot.startTime);
    setSelectedDate(slot.startTime.slice(0, 10));
    setSelectedServiceId("");
    setStep("service");
  }

  async function selectService(service: Service) {
    setSelectedServiceId(service.id);

    if (!isAnyBarber) {
      setStep("time");
      return;
    }

    // Re-validate the opening they browsed against this specific service's
    // real duration; if it still fits, skip straight to details.
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        shopId,
        barberId: pinnedBarberId,
        serviceId: service.id,
        date: selectedDate,
      });
      const res = await fetch(`/api/availability?${params.toString()}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const match = (data.slots as Slot[]).find((s) => s.startTime === preferredStartTime);
      if (match) {
        setSelectedSlot(match);
        setDetailsBackStep("service");
        setStep("details");
      } else {
        setSlots(data.slots);
        setStep("time");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check availability");
    } finally {
      setLoading(false);
    }
  }

  function selectTimeSlot(slot: Slot) {
    setSelectedSlot(slot);
    setDetailsBackStep("time");
    setStep("details");
  }

  useEffect(() => {
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/barbers?shopId=${shopId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setBarbers(data.barbers);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load barbers");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [shopId]);

  useEffect(() => {
    if (step !== "opening") return;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ shopId, date: selectedDate });
        const res = await fetch(`/api/availability/openings?${params.toString()}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setOpenings(data.slots);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load openings");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [step, shopId, selectedDate]);

  useEffect(() => {
    if (step !== "service" || !effectiveBarberId) return;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/services?shopId=${shopId}&barberId=${effectiveBarberId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setServices(data.services);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load services");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [step, shopId, effectiveBarberId]);

  useEffect(() => {
    if (step !== "time" || !effectiveBarberId || !selectedServiceId) return;
    async function run() {
      setLoading(true);
      setError(null);
      setSelectedSlot(null);
      const params = new URLSearchParams({
        shopId,
        barberId: effectiveBarberId,
        serviceId: selectedServiceId,
        date: selectedDate,
      });
      try {
        const res = await fetch(`/api/availability?${params.toString()}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setSlots(data.slots);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load times");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [step, shopId, effectiveBarberId, selectedServiceId, selectedDate]);

  async function submitBooking() {
    if (!selectedSlot) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          serviceId: selectedSlot.serviceId,
          barberId: selectedSlot.barberId,
          startTime: selectedSlot.startTime,
          customerName,
          customerPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Booking failed");
      setStep("confirmed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      {error && (
        <div className="mb-4 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--accent-light)]">
          {error}
        </div>
      )}

      {step === "barber" && (
        <StepShell title="Choose a barber">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <AnyBarberCard selected={isAnyBarber} onClick={() => selectBarber(ANY_BARBER)} />
            {barbers.map((b) => (
              <BarberCard
                key={b.id}
                barber={b}
                selected={selectedBarberId === b.id}
                onClick={() => selectBarber(b.id)}
              />
            ))}
          </div>
        </StepShell>
      )}

      {step === "opening" && (
        <StepShell title="Choose a time" onBack={() => setStep("barber")}>
          <DatePicker days={days} selectedDate={selectedDate} onSelect={setSelectedDate} />

          {loading && <p className="text-sm text-[var(--muted)]">Loading openings…</p>}
          {!loading && openings.length === 0 && (
            <p className="text-sm text-[var(--muted)]">No open times this day. Try another date.</p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {openings.map((slot) => {
              const time = new Date(slot.startTime).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });
              const barberName = barbers.find((b) => b.id === slot.barberId)?.name;
              return (
                <button
                  key={`${slot.barberId}-${slot.startTime}`}
                  onClick={() => selectOpening(slot)}
                  className="rounded-md border border-[var(--card-border)] px-2 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]"
                >
                  <div>{time}</div>
                  <div className="text-[11px] text-[var(--muted)]">{barberName}</div>
                </button>
              );
            })}
          </div>
        </StepShell>
      )}

      {step === "service" && (
        <StepShell
          title="Choose a service"
          onBack={() => setStep(isAnyBarber ? "opening" : "barber")}
        >
          {loading && <p className="mb-2 text-sm text-[var(--muted)]">Loading services…</p>}
          <div className="flex flex-col gap-2">
            {services.map((s) => (
              <OptionButton
                key={s.id}
                label={s.name}
                sub={`${s.duration_minutes} min · ${formatPrice(s.price_cents)}`}
                selected={selectedServiceId === s.id}
                onClick={() => selectService(s)}
              />
            ))}
          </div>
        </StepShell>
      )}

      {step === "time" && (
        <StepShell title="Choose a time" onBack={() => setStep("service")}>
          <DatePicker days={days} selectedDate={selectedDate} onSelect={setSelectedDate} />

          {loading && <p className="text-sm text-[var(--muted)]">Loading times…</p>}
          {!loading && slots.length === 0 && (
            <p className="text-sm text-[var(--muted)]">No open times this day. Try another date.</p>
          )}

          <div className="grid grid-cols-3 gap-2">
            {slots.map((slot) => {
              const time = new Date(slot.startTime).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <button
                  key={`${slot.barberId}-${slot.startTime}`}
                  onClick={() => selectTimeSlot(slot)}
                  className="rounded-md border border-[var(--card-border)] px-2 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]"
                >
                  {time}
                </button>
              );
            })}
          </div>
        </StepShell>
      )}

      {step === "details" && selectedSlot && (
        <StepShell title="Your details" onBack={() => setStep(detailsBackStep)}>
          <div className="mb-4 rounded-md border border-[var(--card-border)] bg-black/20 p-3 text-sm">
            <p className="font-semibold">
              {selectedService?.name ?? "Service"} · {formatPrice(selectedSlot.priceCents)}
            </p>
            <p className="text-[var(--muted)]">
              {new Date(selectedSlot.startTime).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {selectedSlotBarber ? ` · ${selectedSlotBarber.name}` : ""}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm text-[var(--muted)]">
              Name
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-black/20 px-3 py-2 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                placeholder="Full name"
              />
            </label>
            <label className="text-sm text-[var(--muted)]">
              Phone
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                type="tel"
                className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-black/20 px-3 py-2 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                placeholder="(555) 555-5555"
              />
            </label>
          </div>

          <button
            onClick={submitBooking}
            disabled={!customerName || !customerPhone || loading}
            className="brand-button mt-6 w-full py-2.5 text-sm"
          >
            {loading ? "Booking…" : "Confirm booking"}
          </button>
        </StepShell>
      )}

      {step === "confirmed" && (
        <div className="py-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] text-2xl">
            ✓
          </div>
          <h2 className="font-display text-lg uppercase tracking-wide">You&apos;re booked!</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            We sent a confirmation text to {customerPhone}. See you soon.
          </p>
        </div>
      )}
    </div>
  );
}

function StepShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--accent-light)]"
          >
            ←
          </button>
        )}
        <h2 className="font-display text-sm uppercase tracking-wide text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function DatePicker({
  days,
  selectedDate,
  onSelect,
}: {
  days: { label: string; value: string }[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
      {days.map((d) => (
        <button
          key={d.value}
          onClick={() => onSelect(d.value)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
            selectedDate === d.value
              ? "border-transparent bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dark)] text-white"
              : "border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--accent)]"
          }`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function BarberCard({
  barber,
  selected,
  onClick,
}: {
  barber: Barber;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`overflow-hidden rounded-2xl bg-white text-center shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-transform ${
        selected ? "ring-4 ring-[var(--accent)]" : "hover:scale-[1.02]"
      }`}
    >
      <div className="aspect-square w-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)]">
        {barber.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={barber.photo_url} alt={barber.name} className="h-full w-full object-cover" />
        ) : (
          <div className="font-display flex h-full w-full items-center justify-center text-3xl text-white">
            {initials(barber.name)}
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-0.5 bg-gradient-to-b from-white to-[#f8f8f8] px-2 py-3">
        <span className="text-sm font-bold text-[#1a1a1a]">{barber.name}</span>
        {barber.role === "owner" && (
          <span className="text-[10px] uppercase tracking-wide text-[var(--accent)]">Owner</span>
        )}
      </div>
    </button>
  );
}

function AnyBarberCard({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`overflow-hidden rounded-2xl bg-white text-center shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-transform ${
        selected ? "ring-4 ring-[var(--accent)]" : "hover:scale-[1.02]"
      }`}
    >
      <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/barbers/any-barber-logo.png" alt="Any barber" className="h-full w-full object-contain" />
      </div>
      <div className="flex flex-col items-center gap-0.5 bg-gradient-to-b from-white to-[#f8f8f8] px-2 py-3">
        <span className="text-sm font-bold text-[#1a1a1a]">Any barber</span>
        <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">First available</span>
      </div>
    </button>
  );
}

function OptionButton({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-left transition-colors ${
        selected
          ? "border-transparent bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dark)] text-white"
          : "border-[var(--card-border)] hover:border-[var(--accent)]"
      }`}
    >
      <div className="text-sm font-semibold">{label}</div>
      {sub && <div className={`text-xs ${selected ? "text-white/80" : "text-[var(--muted)]"}`}>{sub}</div>}
    </button>
  );
}

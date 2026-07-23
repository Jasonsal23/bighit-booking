import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { getServiceClient } from "@/lib/supabase/server";
import type { Shop, BarberHours, BarberTimeOff, Service } from "@/lib/supabase/types";

const SLOT_STEP_MINUTES = 15;

export interface AvailableSlot {
  startTime: string; // ISO
  endTime: string; // ISO
  barberId: string;
  serviceId: string;
  priceCents: number;
}

interface SlotCandidate {
  barberId: string;
  serviceId: string;
  durationMinutes: number;
  priceCents: number;
}

/**
 * Computes open slots for one or more (barber, service) pairs on a given date.
 * Working hours and pricing/duration are both per-barber, so each candidate
 * gets its own day-start/day-end window (from that barber's barber_hours row)
 * before the shared shop-hours-minus-busy-time math runs.
 */
async function computeSlotsForCandidates(
  shopId: string,
  date: string,
  candidates: SlotCandidate[]
): Promise<AvailableSlot[]> {
  if (candidates.length === 0) return [];

  const supabase = getServiceClient();

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("*")
    .eq("id", shopId)
    .single<Shop>();
  if (shopError || !shop) throw new Error("Shop not found");

  const dayOfWeek = toZonedTime(`${date}T12:00:00Z`, shop.timezone).getDay();

  const barberIds = [...new Set(candidates.map((c) => c.barberId))];

  const { data: hoursRows } = await supabase
    .from("barber_hours")
    .select("*")
    .in("barber_id", barberIds)
    .eq("day_of_week", dayOfWeek);

  const hoursByBarber = new Map<string, BarberHours>();
  for (const h of (hoursRows ?? []) as BarberHours[]) {
    hoursByBarber.set(h.barber_id, h);
  }

  const { data: timeOffRows } = await supabase
    .from("barber_time_off")
    .select("*")
    .in("barber_id", barberIds)
    .eq("date", date);

  const timeOffByBarber = new Map<string, BarberTimeOff>();
  for (const t of (timeOffRows ?? []) as BarberTimeOff[]) {
    timeOffByBarber.set(t.barber_id, t);
  }

  const { data: existingAppointments } = await supabase
    .from("appointments")
    .select("barber_id, start_time, end_time")
    .in("barber_id", barberIds)
    .eq("status", "booked");

  const busyByBarber = new Map<string, { start: number; end: number }[]>();
  for (const appt of existingAppointments ?? []) {
    const list = busyByBarber.get(appt.barber_id) ?? [];
    list.push({
      start: new Date(appt.start_time).getTime(),
      end: new Date(appt.end_time).getTime(),
    });
    busyByBarber.set(appt.barber_id, list);
  }

  const stepMs = SLOT_STEP_MINUTES * 60_000;
  const now = Date.now();

  const slots: AvailableSlot[] = [];
  for (const candidate of candidates) {
    const timeOff = timeOffByBarber.get(candidate.barberId);
    const hours = hoursByBarber.get(candidate.barberId);

    // A time-off row for this exact date always wins over the recurring
    // weekly schedule: closed means closed even on an otherwise-working day,
    // and a custom open/close range overrides the usual hours for that day.
    let openTime: string | null;
    let closeTime: string | null;
    if (timeOff) {
      if (timeOff.is_closed) continue;
      openTime = timeOff.open_time;
      closeTime = timeOff.close_time;
    } else if (hours && !hours.is_closed) {
      openTime = hours.open_time;
      closeTime = hours.close_time;
    } else {
      continue;
    }
    if (!openTime || !closeTime) continue;

    const dayStartUtc = fromZonedTime(`${date}T${openTime}`, shop.timezone);
    const dayEndUtc = fromZonedTime(`${date}T${closeTime}`, shop.timezone);

    const busy = busyByBarber.get(candidate.barberId) ?? [];
    const durationMs = candidate.durationMinutes * 60_000;
    for (
      let slotStart = dayStartUtc.getTime();
      slotStart + durationMs <= dayEndUtc.getTime();
      slotStart += stepMs
    ) {
      if (slotStart < now) continue;
      const slotEnd = slotStart + durationMs;
      const overlaps = busy.some((b) => slotStart < b.end && slotEnd > b.start);
      if (!overlaps) {
        slots.push({
          startTime: new Date(slotStart).toISOString(),
          endTime: new Date(slotEnd).toISOString(),
          barberId: candidate.barberId,
          serviceId: candidate.serviceId,
          priceCents: candidate.priceCents,
        });
      }
    }
  }

  slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return slots;
}

/** Availability for a specific barber + their specific service. */
export async function getAvailableSlotsForBarber(args: {
  shopId: string;
  barberId: string;
  serviceId: string;
  date: string;
}): Promise<AvailableSlot[]> {
  const supabase = getServiceClient();
  const { data: service, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", args.serviceId)
    .eq("barber_id", args.barberId)
    .eq("active", true)
    .single<Service>();
  if (error || !service) throw new Error("Service not found");

  return computeSlotsForCandidates(args.shopId, args.date, [
    {
      barberId: args.barberId,
      serviceId: service.id,
      durationMinutes: service.duration_minutes,
      priceCents: service.price_cents,
    },
  ]);
}

/**
 * Availability for "any barber": browse the earliest opening each active
 * barber has, probed using their own shortest active service (the most
 * permissive duration they offer) purely so a customer can see "who's free
 * when" before picking a specific barber. Once they pick an opening, the
 * caller re-validates against whatever real service gets chosen next.
 */
export async function getEarliestOpenings(args: {
  shopId: string;
  date: string;
}): Promise<AvailableSlot[]> {
  const supabase = getServiceClient();

  const { data: barbers } = await supabase
    .from("barbers")
    .select("id")
    .eq("shop_id", args.shopId)
    .eq("active", true);

  const candidates: SlotCandidate[] = [];
  for (const barber of barbers ?? []) {
    const { data: shortestService } = await supabase
      .from("services")
      .select("*")
      .eq("barber_id", barber.id)
      .eq("active", true)
      .order("duration_minutes", { ascending: true })
      .limit(1)
      .maybeSingle<Service>();

    if (shortestService) {
      candidates.push({
        barberId: barber.id,
        serviceId: shortestService.id,
        durationMinutes: shortestService.duration_minutes,
        priceCents: shortestService.price_cents,
      });
    }
  }

  return computeSlotsForCandidates(args.shopId, args.date, candidates);
}

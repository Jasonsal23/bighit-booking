import { NextResponse } from "next/server";
import { z } from "zod";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { getServiceClient } from "@/lib/supabase/server";
import { getAuthedBarber, AuthError } from "@/lib/auth";
import type { Shop, Barber, BarberHours, BarberTimeOff } from "@/lib/supabase/types";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Full shop schedule: every active barber's working window for the day
 * (accounting for time-off overrides) plus their appointments, so the whole
 * shop's schedule can be rendered as one side-by-side hourly grid. Any
 * signed-in barber can view this, not just the owner.
 */
export async function GET(request: Request) {
  try {
    const barber = await getAuthedBarber(request);

    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 });
    }
    const { date } = parsed.data;

    const supabase = getServiceClient();

    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("*")
      .eq("id", barber.shop_id)
      .single<Shop>();
    if (shopError || !shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

    const dayOfWeek = toZonedTime(`${date}T12:00:00Z`, shop.timezone).getDay();

    const { data: barbers } = await supabase
      .from("barbers")
      .select("*")
      .eq("shop_id", barber.shop_id)
      .eq("active", true)
      .order("sort_order");
    const barberList = (barbers ?? []) as Barber[];
    const barberIds = barberList.map((b) => b.id);

    const { data: hoursRows } = await supabase
      .from("barber_hours")
      .select("*")
      .in("barber_id", barberIds)
      .eq("day_of_week", dayOfWeek);
    const hoursByBarber = new Map<string, BarberHours>();
    for (const h of (hoursRows ?? []) as BarberHours[]) hoursByBarber.set(h.barber_id, h);

    const { data: timeOffRows } = await supabase
      .from("barber_time_off")
      .select("*")
      .in("barber_id", barberIds)
      .eq("date", date);
    const timeOffByBarber = new Map<string, BarberTimeOff>();
    for (const t of (timeOffRows ?? []) as BarberTimeOff[]) timeOffByBarber.set(t.barber_id, t);

    const dayStart = fromZonedTime(`${date}T00:00:00`, shop.timezone).toISOString();
    const dayEnd = fromZonedTime(`${date}T23:59:59`, shop.timezone).toISOString();

    const { data: appointments } = await supabase
      .from("appointments")
      .select("id, barber_id, customer_name, start_time, end_time, status, services(name)")
      .in("barber_id", barberIds)
      .neq("status", "cancelled")
      .gte("start_time", dayStart)
      .lte("start_time", dayEnd)
      .order("start_time");

    const appointmentsByBarber = new Map<string, typeof appointments>();
    for (const appt of appointments ?? []) {
      const list = appointmentsByBarber.get(appt.barber_id) ?? [];
      list.push(appt);
      appointmentsByBarber.set(appt.barber_id, list);
    }

    const result = barberList.map((b) => {
      const timeOff = timeOffByBarber.get(b.id);
      const hours = hoursByBarber.get(b.id);

      let isClosed: boolean;
      let openTime: string | null;
      let closeTime: string | null;
      if (timeOff) {
        isClosed = timeOff.is_closed;
        openTime = timeOff.open_time;
        closeTime = timeOff.close_time;
      } else if (hours && !hours.is_closed) {
        isClosed = false;
        openTime = hours.open_time;
        closeTime = hours.close_time;
      } else {
        isClosed = true;
        openTime = null;
        closeTime = null;
      }

      return {
        id: b.id,
        name: b.name,
        role: b.role,
        isClosed,
        openTime,
        closeTime,
        appointments: appointmentsByBarber.get(b.id) ?? [],
      };
    });

    return NextResponse.json({ date, barbers: result });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load day overview" }, { status: 500 });
  }
}

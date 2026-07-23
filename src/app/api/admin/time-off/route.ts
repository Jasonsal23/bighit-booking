import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { getAuthedBarber, AuthError } from "@/lib/auth";

/** GET: the signed-in barber's upcoming time-off entries (owners can pass ?barberId= for anyone in the shop). */
export async function GET(request: Request) {
  try {
    const barber = await getAuthedBarber(request);
    const requestedBarberId = new URL(request.url).searchParams.get("barberId");

    let targetBarberId = barber.id;
    if (requestedBarberId && requestedBarberId !== barber.id) {
      if (barber.role !== "owner") {
        return NextResponse.json({ error: "Only owners can view another barber's time off" }, { status: 403 });
      }
      targetBarberId = requestedBarberId;
    }

    const supabase = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("barber_time_off")
      .select("*")
      .eq("barber_id", targetBarberId)
      .gte("date", today)
      .order("date");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ timeOff: data });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load time off" }, { status: 500 });
  }
}

const createSchema = z.object({
  barberId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isClosed: z.boolean(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reason: z.string().max(200).optional(),
});

/** POST: add or replace a day-off / custom-hours override for a specific date. */
export async function POST(request: Request) {
  try {
    const barber = await getAuthedBarber(request);
    const json = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const targetBarberId = parsed.data.barberId ?? barber.id;
    if (targetBarberId !== barber.id && barber.role !== "owner") {
      return NextResponse.json({ error: "Only owners can set another barber's time off" }, { status: 403 });
    }
    if (!parsed.data.isClosed && (!parsed.data.openTime || !parsed.data.closeTime)) {
      return NextResponse.json(
        { error: "openTime and closeTime are required when not marking the day fully closed" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("barber_time_off")
      .upsert(
        {
          barber_id: targetBarberId,
          date: parsed.data.date,
          is_closed: parsed.data.isClosed,
          open_time: parsed.data.isClosed ? null : parsed.data.openTime,
          close_time: parsed.data.isClosed ? null : parsed.data.closeTime,
          reason: parsed.data.reason ?? null,
        },
        { onConflict: "barber_id,date" }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ timeOff: data }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to save time off" }, { status: 500 });
  }
}

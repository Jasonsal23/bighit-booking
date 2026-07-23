import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { getAuthedBarber, AuthError } from "@/lib/auth";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** GET: the signed-in barber's appointments for a date; owners see every barber's. */
export async function GET(request: Request) {
  try {
    const barber = await getAuthedBarber(request);
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const dayStart = `${parsed.data.date}T00:00:00.000Z`;
    const dayEnd = `${parsed.data.date}T23:59:59.999Z`;

    let query = supabase
      .from("appointments")
      .select("*, barbers(name), services(name, duration_minutes)")
      .eq("shop_id", barber.shop_id)
      .gte("start_time", dayStart)
      .lte("start_time", dayEnd)
      .order("start_time");

    if (barber.role !== "owner") {
      query = query.eq("barber_id", barber.id);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ appointments: data });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load appointments" }, { status: 500 });
  }
}

const createSchema = z.object({
  barberId: z.string().uuid().optional(), // owner can book on behalf of any barber; barbers default to themselves
  serviceId: z.string().uuid(),
  startTime: z.string().datetime(),
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().min(7).max(20),
});

const POSTGRES_EXCLUSION_VIOLATION = "23P01";

/** POST: manual walk-in / phone booking, entered by the barber directly. */
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
      return NextResponse.json({ error: "Only owners can book for another barber" }, { status: 403 });
    }

    const supabase = getServiceClient();
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("*")
      .eq("id", parsed.data.serviceId)
      .eq("barber_id", targetBarberId)
      .eq("active", true)
      .single();
    if (serviceError || !service) {
      return NextResponse.json({ error: "Service not found for this barber" }, { status: 404 });
    }

    const start = new Date(parsed.data.startTime);
    const end = new Date(start.getTime() + service.duration_minutes * 60_000);

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .upsert(
        { shop_id: barber.shop_id, name: parsed.data.customerName, phone: parsed.data.customerPhone },
        { onConflict: "shop_id,phone" }
      )
      .select()
      .single();
    if (customerError || !customer) {
      return NextResponse.json({ error: "Failed to save customer" }, { status: 500 });
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        shop_id: barber.shop_id,
        barber_id: targetBarberId,
        service_id: service.id,
        customer_id: customer.id,
        customer_name: parsed.data.customerName,
        customer_phone: parsed.data.customerPhone,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        source: "manual",
      })
      .select("*, barbers(name), services(name, duration_minutes)")
      .single();

    if (appointmentError) {
      if ("code" in appointmentError && appointmentError.code === POSTGRES_EXCLUSION_VIOLATION) {
        return NextResponse.json({ error: "That time overlaps an existing appointment" }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
    }

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }
}

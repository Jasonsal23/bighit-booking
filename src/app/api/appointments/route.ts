import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/sms";

const bodySchema = z.object({
  shopId: z.string().uuid(),
  serviceId: z.string().uuid(),
  barberId: z.string().uuid(),
  startTime: z.string().datetime(),
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().min(7).max(20),
  customerEmail: z.string().email().max(200).optional(),
});

const POSTGRES_EXCLUSION_VIOLATION = "23P01";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid booking request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { shopId, serviceId, barberId, startTime, customerName, customerPhone, customerEmail } = parsed.data;
  const supabase = getServiceClient();

  // The client always sends the barberId + serviceId from a real slot it
  // fetched from /api/availability, so this just re-validates that pairing
  // (a service always belongs to exactly one barber) rather than resolving
  // "any barber" here.
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .eq("barber_id", barberId)
    .eq("shop_id", shopId)
    .eq("active", true)
    .single();
  if (serviceError || !service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const start = new Date(startTime);
  const end = new Date(start.getTime() + service.duration_minutes * 60_000);

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert(
      {
        shop_id: shopId,
        name: customerName,
        phone: customerPhone,
        // Omitted (not set to null) when not provided, so a returning
        // customer's existing email on file isn't wiped out by a guest booking.
        ...(customerEmail ? { email: customerEmail } : {}),
      },
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
      shop_id: shopId,
      barber_id: barberId,
      service_id: serviceId,
      customer_id: customer.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      source: "online",
    })
    .select("*, barbers(name)")
    .single();

  if (appointmentError) {
    if (
      "code" in appointmentError &&
      appointmentError.code === POSTGRES_EXCLUSION_VIOLATION
    ) {
      return NextResponse.json({ error: "That time was just booked by someone else" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }

  const barberName = (appointment as unknown as { barbers: { name: string } | null }).barbers?.name;
  const when = start.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  await sendSms(
    customerPhone,
    `Big Hit Barbershop: You're booked for ${service.name}${barberName ? ` with ${barberName}` : ""} on ${when}. Reply to reschedule.`
  ).catch((err) => console.error("[appointments] confirmation SMS failed", err));

  return NextResponse.json({ appointment }, { status: 201 });
}

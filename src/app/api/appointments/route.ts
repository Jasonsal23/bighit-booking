import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/sms";
import { sendPushNotification } from "@/lib/push";
import { sendEmail, renderBookingConfirmationEmail } from "@/lib/email";
import { buildManageUrl } from "@/lib/manageToken";

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
    .select("*, barbers(name, push_token)")
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

  const barberInfo = (appointment as unknown as { barbers: { name: string; push_token: string | null } | null })
    .barbers;
  const when = start.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });

  // Always notify the barber by push regardless of how the customer gets
  // confirmed below.
  await sendPushNotification(
    barberInfo?.push_token,
    "New Booking",
    `${customerName} booked ${service.name} on ${when}`,
    { appointmentId: appointment.id }
  );

  // Customer confirmation: push if they're logged into the app, email if
  // they gave one, and SMS only as a last resort for guests with neither —
  // SMS is the only channel with a real per-message cost.
  const confirmationMessage = `${service.name}${barberInfo?.name ? ` with ${barberInfo.name}` : ""} on ${when}`;
  const manageUrl = buildManageUrl(appointment.id);
  let confirmed = false;

  if (customer.push_token) {
    await sendPushNotification(customer.push_token, "You're Booked!", confirmationMessage, {
      appointmentId: appointment.id,
    });
    confirmed = true;
  }

  if (customer.email) {
    await sendEmail(
      customer.email,
      `You're booked for ${service.name} on ${when}`,
      renderBookingConfirmationEmail({
        customerName,
        serviceName: service.name,
        barberName: barberInfo?.name,
        when,
        manageUrl,
      })
    ).catch((err) => console.error("[appointments] confirmation email failed", err));
    confirmed = true;
  }

  if (!confirmed) {
    await sendSms(
      customerPhone,
      `Big Hit Barbershop: You're booked for ${confirmationMessage}. Manage your booking: ${manageUrl}`
    ).catch((err) => console.error("[appointments] confirmation SMS failed", err));
  }

  return NextResponse.json({ appointment }, { status: 201 });
}

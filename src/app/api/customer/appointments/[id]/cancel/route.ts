import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { getAuthedCustomer, AuthError } from "@/lib/auth";

const CANCEL_CUTOFF_HOURS = 3;

export async function POST(request: Request, ctx: RouteContext<"/api/customer/appointments/[id]/cancel">) {
  try {
    const customer = await getAuthedCustomer(request);
    const { id } = await ctx.params;

    const supabase = getServiceClient();
    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select("id, customer_id, status, start_time")
      .eq("id", id)
      .single();
    if (fetchError || !appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }
    if (appointment.customer_id !== customer.id) {
      return NextResponse.json({ error: "Not your appointment" }, { status: 403 });
    }
    if (appointment.status !== "booked") {
      return NextResponse.json({ error: "This appointment can't be cancelled" }, { status: 400 });
    }

    const cutoffMs = CANCEL_CUTOFF_HOURS * 60 * 60 * 1000;
    if (new Date(appointment.start_time).getTime() - Date.now() < cutoffMs) {
      return NextResponse.json(
        { error: `Appointments can only be cancelled at least ${CANCEL_CUTOFF_HOURS} hours in advance. Please call the shop.` },
        { status: 409 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select("*, barbers(name), services(name, duration_minutes)")
      .single();
    if (updateError || !updated) {
      return NextResponse.json({ error: "Failed to cancel appointment" }, { status: 500 });
    }

    return NextResponse.json({ appointment: updated });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to cancel appointment" }, { status: 500 });
  }
}

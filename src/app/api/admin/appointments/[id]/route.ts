import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { getAuthedBarber, AuthError } from "@/lib/auth";

const bodySchema = z.object({
  status: z.enum(["booked", "completed", "no_show", "cancelled"]).optional(),
  paymentStatus: z.enum(["unpaid", "paid"]).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/appointments/[id]">) {
  try {
    const barber = await getAuthedBarber(request);
    const { id } = await ctx.params;
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success || (!parsed.data.status && !parsed.data.paymentStatus)) {
      return NextResponse.json({ error: "Provide status and/or paymentStatus" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: existing, error: fetchError } = await supabase
      .from("appointments")
      .select("id, barber_id, shop_id")
      .eq("id", id)
      .single();
    if (fetchError || !existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }
    if (existing.shop_id !== barber.shop_id) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }
    if (barber.role !== "owner" && existing.barber_id !== barber.id) {
      return NextResponse.json({ error: "Not your appointment" }, { status: 403 });
    }

    const update: Record<string, string> = {};
    if (parsed.data.status) update.status = parsed.data.status;
    if (parsed.data.paymentStatus) update.payment_status = parsed.data.paymentStatus;

    const { data: appointment, error: updateError } = await supabase
      .from("appointments")
      .update(update)
      .eq("id", id)
      .select("*, barbers(name), services(name, duration_minutes)")
      .single();
    if (updateError || !appointment) {
      return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
    }

    return NextResponse.json({ appointment });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
  }
}

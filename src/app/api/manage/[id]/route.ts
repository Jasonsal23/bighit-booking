import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { verifyManageToken } from "@/lib/manageToken";

const CANCEL_CUTOFF_HOURS = 3;

export async function GET(request: Request, ctx: RouteContext<"/api/manage/[id]">) {
  const { id } = await ctx.params;
  const token = new URL(request.url).searchParams.get("token");
  if (!token || !verifyManageToken(id, token)) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
  }

  const supabase = getServiceClient();
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id, customer_name, start_time, end_time, status, barbers(name), services(name, price_cents)")
    .eq("id", id)
    .single();

  if (error || !appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  const cutoffMs = CANCEL_CUTOFF_HOURS * 60 * 60 * 1000;
  const canCancel =
    appointment.status === "booked" &&
    new Date(appointment.start_time).getTime() - Date.now() >= cutoffMs;

  return NextResponse.json({ appointment, canCancel, cancelCutoffHours: CANCEL_CUTOFF_HOURS });
}

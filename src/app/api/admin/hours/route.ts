import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { getAuthedBarber, AuthError } from "@/lib/auth";

/** GET: the signed-in barber's recurring weekly hours (owners can pass ?barberId= for anyone in the shop). */
export async function GET(request: Request) {
  try {
    const barber = await getAuthedBarber(request);
    const requestedBarberId = new URL(request.url).searchParams.get("barberId");

    let targetBarberId = barber.id;
    if (requestedBarberId && requestedBarberId !== barber.id) {
      if (barber.role !== "owner") {
        return NextResponse.json({ error: "Only owners can view another barber's hours" }, { status: 403 });
      }
      targetBarberId = requestedBarberId;
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("barber_hours")
      .select("*")
      .eq("barber_id", targetBarberId)
      .order("day_of_week");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ hours: data });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load hours" }, { status: 500 });
  }
}

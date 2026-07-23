import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { getAuthedCustomer, AuthError } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const customer = await getAuthedCustomer(request);
    const supabase = getServiceClient();

    // Nothing is ever deleted from the database — this just limits what the
    // account screen fetches/shows to the last 3 months of history plus
    // anything upcoming (which always has a start_time after this cutoff).
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data, error } = await supabase
      .from("appointments")
      .select("*, barbers(name), services(name, duration_minutes)")
      .eq("customer_id", customer.id)
      .gte("start_time", threeMonthsAgo.toISOString())
      .order("start_time", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ appointments: data });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load appointments" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { getAuthedBarber, AuthError } from "@/lib/auth";

export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/time-off/[id]">) {
  try {
    const barber = await getAuthedBarber(request);
    const { id } = await ctx.params;

    const supabase = getServiceClient();
    const { data: existing, error: fetchError } = await supabase
      .from("barber_time_off")
      .select("id, barber_id")
      .eq("id", id)
      .single();
    if (fetchError || !existing) {
      return NextResponse.json({ error: "Time off entry not found" }, { status: 404 });
    }
    if (barber.role !== "owner" && existing.barber_id !== barber.id) {
      return NextResponse.json({ error: "Not your time off entry" }, { status: 403 });
    }

    const { error } = await supabase.from("barber_time_off").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to delete time off" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const shopId = params.get("shopId");
  const barberId = params.get("barberId");
  if (!shopId || !barberId) {
    return NextResponse.json({ error: "shopId and barberId are required" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, duration_minutes, price_cents")
    .eq("shop_id", shopId)
    .eq("barber_id", barberId)
    .eq("active", true)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ services: data });
}

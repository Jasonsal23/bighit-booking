import { NextResponse } from "next/server";
import { getAuthedBarber, AuthError } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const barber = await getAuthedBarber(request);
    return NextResponse.json({
      barber: { id: barber.id, name: barber.name, role: barber.role, shopId: barber.shop_id },
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load account" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getAuthedCustomer, AuthError } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const customer = await getAuthedCustomer(request);
    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        shopId: customer.shop_id,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load account" }, { status: 500 });
  }
}

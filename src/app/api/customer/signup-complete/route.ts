import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUser, AuthError } from "@/lib/auth";

const bodySchema = z.object({
  shopId: z.string().uuid(),
  name: z.string().min(1).max(120),
  phone: z.string().min(7).max(20),
});

/**
 * Runs right after supabase.auth.signUp() on the client. Links the new auth
 * user to a customers row — reusing an existing one by phone if this person
 * already had guest bookings, so their history shows up once they log in.
 */
export async function POST(request: Request) {
  try {
    const { supabase, userId, email } = await getAuthedUser(request);
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data: customer, error } = await supabase
      .from("customers")
      .upsert(
        {
          shop_id: parsed.data.shopId,
          phone: parsed.data.phone,
          name: parsed.data.name,
          auth_user_id: userId,
          email,
        },
        { onConflict: "shop_id,phone" }
      )
      .select()
      .single();

    if (error || !customer) {
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    return NextResponse.json({ customer }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to complete signup" }, { status: 500 });
  }
}

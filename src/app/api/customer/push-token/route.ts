import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { getAuthedCustomer, AuthError } from "@/lib/auth";

const bodySchema = z.object({ pushToken: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const customer = await getAuthedCustomer(request);
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "pushToken is required" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { error } = await supabase
      .from("customers")
      .update({ push_token: parsed.data.pushToken })
      .eq("id", customer.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to save push token" }, { status: 500 });
  }
}

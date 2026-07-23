import { NextResponse } from "next/server";
import { z } from "zod";
import { getAvailableSlotsForBarber } from "@/lib/availability";

const querySchema = z.object({
  shopId: z.string().uuid(),
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const slots = await getAvailableSlotsForBarber(parsed.data);
    return NextResponse.json({ slots });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to compute availability";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

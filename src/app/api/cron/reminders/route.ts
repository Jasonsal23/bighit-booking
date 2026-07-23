import { NextResponse } from "next/server";
import { runReminderSweep } from "@/lib/reminders";

/**
 * Meant to be hit by an external scheduler every ~15 minutes (Vercel's free
 * plan only allows daily cron, and the 1-hour-before reminder needs tighter
 * timing than that). Protected by a shared secret since it's a public URL.
 */
export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runReminderSweep();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/reminders] sweep failed", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}

import { getServiceClient } from "@/lib/supabase/server";
import { sendPushNotification } from "@/lib/push";
import { sendEmail, renderAppointmentReminderEmail } from "@/lib/email";
import { buildManageUrl } from "@/lib/manageToken";
import type { ReminderType } from "@/lib/supabase/types";

const COMEBACK_DAYS = 14;

interface SweepResult {
  sent24h: number;
  sent1h: number;
  sentComeback: number;
  errors: string[];
}

async function alreadySent(
  supabase: ReturnType<typeof getServiceClient>,
  customerId: string,
  appointmentId: string,
  type: ReminderType
) {
  const { data } = await supabase
    .from("reminder_log")
    .select("id")
    .eq("customer_id", customerId)
    .eq("appointment_id", appointmentId)
    .eq("type", type)
    .maybeSingle();
  return !!data;
}

async function logReminder(
  supabase: ReturnType<typeof getServiceClient>,
  customerId: string,
  appointmentId: string,
  type: ReminderType
) {
  await supabase.from("reminder_log").insert({ customer_id: customerId, appointment_id: appointmentId, type });
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

/**
 * Runs all three reminder checks in one pass, meant to be called on a
 * recurring schedule (external cron hitting /api/cron/reminders). Every
 * check is idempotent via reminder_log, so calling this too often just
 * results in wasted no-op queries, never duplicate notifications.
 */
export async function runReminderSweep(): Promise<SweepResult> {
  const supabase = getServiceClient();
  const now = new Date();
  const result: SweepResult = { sent24h: 0, sent1h: 0, sentComeback: 0, errors: [] };

  async function sendUpcomingReminders(windowHours: number, type: ReminderType, label: string) {
    const windowEnd = new Date(now.getTime() + windowHours * 60 * 60 * 1000);
    const { data: appts, error } = await supabase
      .from("appointments")
      .select(
        "id, customer_id, customer_name, start_time, services(name), barbers(name), customers(push_token, email)"
      )
      .eq("status", "booked")
      .gte("start_time", now.toISOString())
      .lte("start_time", windowEnd.toISOString());

    if (error) {
      result.errors.push(`${type}: ${error.message}`);
      return;
    }

    for (const appt of appts ?? []) {
      const customerId = appt.customer_id as string | null;
      if (!customerId) continue;

      const service = appt.services as unknown as { name: string } | null;
      const barber = appt.barbers as unknown as { name: string } | null;
      const customer = appt.customers as unknown as { push_token: string | null; email: string | null } | null;
      if (!customer?.push_token && !customer?.email) continue;

      if (await alreadySent(supabase, customerId, appt.id, type)) continue;

      const when = formatWhen(appt.start_time);
      let sent = false;

      if (customer.push_token) {
        await sendPushNotification(
          customer.push_token,
          "Appointment Reminder",
          `${label}: ${service?.name ?? "your appointment"}${barber?.name ? ` with ${barber.name}` : ""} at ${when}`,
          { appointmentId: appt.id }
        );
        sent = true;
      }

      if (customer.email) {
        await sendEmail(
          customer.email,
          `Reminder: ${service?.name ?? "your appointment"} ${label.toLowerCase()}`,
          renderAppointmentReminderEmail({
            customerName: appt.customer_name,
            serviceName: service?.name ?? "your appointment",
            barberName: barber?.name,
            when,
            label,
            manageUrl: buildManageUrl(appt.id),
          })
        ).catch((err) => result.errors.push(`${type} email: ${err instanceof Error ? err.message : String(err)}`));
        sent = true;
      }

      if (!sent) continue;

      await logReminder(supabase, customerId, appt.id, type);
      if (type === "24h_reminder") result.sent24h++;
      else result.sent1h++;
    }
  }

  await sendUpcomingReminders(24, "24h_reminder", "Tomorrow");
  await sendUpcomingReminders(1, "1h_reminder", "In about an hour");

  // "Come back" nudge: find each customer's single most recent non-cancelled
  // appointment. If it's in the future, they already have something booked —
  // skip. If it's in the past and it's been 2+ weeks, nudge them, anchored
  // to that appointment so re-booking naturally resets the check.
  const { data: recentAppts, error: recentError } = await supabase
    .from("appointments")
    .select("id, customer_id, end_time, start_time, customers(push_token)")
    .neq("status", "cancelled")
    .order("start_time", { ascending: false });

  if (recentError) {
    result.errors.push(`comeback: ${recentError.message}`);
  } else {
    const seenCustomers = new Set<string>();
    const cutoffMs = COMEBACK_DAYS * 24 * 60 * 60 * 1000;

    for (const appt of recentAppts ?? []) {
      const customerId = appt.customer_id as string | null;
      if (!customerId || seenCustomers.has(customerId)) continue;
      seenCustomers.add(customerId);

      const isFuture = new Date(appt.start_time).getTime() > now.getTime();
      if (isFuture) continue;

      const gapMs = now.getTime() - new Date(appt.end_time).getTime();
      if (gapMs < cutoffMs) continue;

      const customer = appt.customers as unknown as { push_token: string | null } | null;
      if (!customer?.push_token) continue;

      if (await alreadySent(supabase, customerId, appt.id, "comeback")) continue;

      await sendPushNotification(
        customer.push_token,
        "We Miss You!",
        "It's been a minute since your last cut — let's get you booked again.",
        { type: "comeback" }
      );
      await logReminder(supabase, customerId, appt.id, "comeback");
      result.sentComeback++;
    }
  }

  return result;
}

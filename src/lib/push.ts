const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";

/**
 * Sends a native push notification via Expo's push service. Silently no-ops
 * on a missing/invalid-looking token instead of throwing — a push failing
 * should never block the API request that triggered it (booking, cancel).
 */
export async function sendPushNotification(
  token: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!token || !token.startsWith("ExponentPushToken")) return;

  try {
    const res = await fetch(EXPO_PUSH_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ to: token, title, body, data, sound: "default" }),
    });
    if (!res.ok) {
      console.error("[push] Expo push API returned", res.status, await res.text());
    }
  } catch (err) {
    console.error("[push] failed to send", err);
  }
}

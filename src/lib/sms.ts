const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

export async function sendSms(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    console.warn("[sms] Twilio not configured, skipping send:", { to, body });
    return;
  }

  const params = new URLSearchParams({ To: to, From: from, Body: body });

  const res = await fetch(`${TWILIO_API_BASE}/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio send failed: ${res.status} ${text}`);
  }
}

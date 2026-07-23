const RESEND_API = "https://api.resend.com/emails";
const FROM_ADDRESS = "Big Hit Barbershop <booking@bighitbarbershop.com>";

/**
 * Wraps the given inner HTML in a branded shell (dark header, red accent,
 * matching the site) so individual email builders below only need to worry
 * about their own content, not the full document boilerplate.
 */
function emailShell(preheader: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'Titillium Web',Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(180deg,#1a1a1a,#0d0d0d);padding:28px 24px;text-align:center;">
                <span style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:20px;letter-spacing:1px;text-transform:uppercase;color:#ffffff;">
                  Big Hit <span style="color:#ff6b6b;">Barbershop</span>
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px 28px;">${bodyHtml}</td>
            </tr>
            <tr>
              <td style="height:3px;background:linear-gradient(90deg,#c41e3a,#ff6b6b,#c41e3a);"></td>
            </tr>
            <tr>
              <td style="padding:16px 28px;text-align:center;">
                <span style="font-size:11px;color:#999999;">Big Hit Barbershop &middot; Las Vegas, NV</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderBookingConfirmationEmail(args: {
  customerName: string;
  serviceName: string;
  barberName?: string;
  when: string;
  manageUrl: string;
}): string {
  return emailShell(
    `You're booked for ${args.serviceName} on ${args.when}`,
    `
      <h1 style="margin:0 0 4px 0;font-size:20px;color:#1a1a1a;">You're booked, ${args.customerName}!</h1>
      <p style="margin:0 0 20px 0;font-size:14px;color:#666666;line-height:1.5;">Here are your appointment details:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f8f8;border-radius:10px;margin-bottom:20px;">
        <tr>
          <td style="padding:16px 18px;">
            <p style="margin:0 0 6px 0;font-size:16px;font-weight:700;color:#1a1a1a;">${args.serviceName}</p>
            ${args.barberName ? `<p style="margin:0 0 6px 0;font-size:13px;color:#666666;">with ${args.barberName}</p>` : ""}
            <p style="margin:0;font-size:13px;color:#666666;">${args.when}</p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td align="center">
            <a href="${args.manageUrl}" style="display:inline-block;background:linear-gradient(135deg,#c41e3a,#a01830);color:#ffffff;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:12px 28px;border-radius:25px;">
              Manage Booking
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 4px 0;font-size:13px;color:#666666;line-height:1.5;">
        Need to cancel? Use the button above, up to 3 hours before your appointment time.
      </p>
      <p style="margin:20px 0 0 0;font-size:14px;color:#1a1a1a;">See you soon!</p>
    `
  );
}

export function renderAppointmentReminderEmail(args: {
  customerName: string;
  serviceName: string;
  barberName?: string;
  when: string;
  label: string;
  manageUrl: string;
}): string {
  return emailShell(
    `Reminder: ${args.serviceName} ${args.label.toLowerCase()}`,
    `
      <h1 style="margin:0 0 4px 0;font-size:20px;color:#1a1a1a;">Reminder, ${args.customerName}</h1>
      <p style="margin:0 0 20px 0;font-size:14px;color:#666666;line-height:1.5;">${args.label}: your appointment is coming up.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f8f8;border-radius:10px;margin-bottom:20px;">
        <tr>
          <td style="padding:16px 18px;">
            <p style="margin:0 0 6px 0;font-size:16px;font-weight:700;color:#1a1a1a;">${args.serviceName}</p>
            ${args.barberName ? `<p style="margin:0 0 6px 0;font-size:13px;color:#666666;">with ${args.barberName}</p>` : ""}
            <p style="margin:0;font-size:13px;color:#666666;">${args.when}</p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td align="center">
            <a href="${args.manageUrl}" style="display:inline-block;background:linear-gradient(135deg,#c41e3a,#a01830);color:#ffffff;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:12px 28px;border-radius:25px;">
              Manage Booking
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:14px;color:#1a1a1a;">See you soon!</p>
    `
  );
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] Resend not configured, skipping send:", { to, subject });
    return;
  }

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend send failed: ${res.status} ${text}`);
  }
}

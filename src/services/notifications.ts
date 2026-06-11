import nodemailer from "nodemailer";
import { config } from "../config";
import { logger } from "../utils/logger";

// Email via Gmail SMTP (Nodemailer) — just needs a Gmail address + App Password,
// no business account / domain verification required.
const emailEnabled = !!(config.EMAIL_USER && config.EMAIL_APP_PASSWORD);

const transporter = emailEnabled
  ? nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: config.EMAIL_USER!,
        pass: config.EMAIL_APP_PASSWORD!,
      },
      // Render's containers lack outbound IPv6 connectivity, but Gmail's SMTP
      // hostname resolves to an AAAA (IPv6) record — forcing IPv4 avoids
      // ENETUNREACH/connection-timeout errors when sending.
      family: 4,
    } as nodemailer.TransportOptions)
  : null;

export function isEmailEnabled(): boolean {
  return emailEnabled;
}

const resendEnabled = !!(config.RESEND_API_KEY && config.RESEND_FROM_EMAIL);

// Crude HTML -> plain text conversion. Sending a text alternative alongside
// HTML significantly reduces spam-folder placement (HTML-only emails from
// shared sending domains are a strong spam signal).
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${config.EMAIL_FROM_NAME} <${config.RESEND_FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
      text: htmlToText(html),
      reply_to: config.ADMIN_EMAIL,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  // Prefer Resend (HTTPS API) — works on hosts like Render's free tier that
  // block outbound SMTP ports, which silently hangs/fails Gmail SMTP.
  if (resendEnabled) {
    await sendViaResend(to, subject, html);
    return;
  }
  if (!emailEnabled || !transporter) {
    logger.warn({ to, subject }, "Email not configured (set RESEND_API_KEY+RESEND_FROM_EMAIL, or EMAIL_USER/EMAIL_APP_PASSWORD) — skipping email");
    // Throw so callers (watchdog) record this as a FAILED notification instead of
    // silently logging "success: true" when nothing was actually sent.
    throw new Error("Email not configured: set RESEND_API_KEY/RESEND_FROM_EMAIL (recommended) or EMAIL_USER/EMAIL_APP_PASSWORD in .env");
  }
  await transporter.sendMail({
    from: `"${config.EMAIL_FROM_NAME}" <${config.EMAIL_USER}>`,
    to,
    subject,
    html,
    text: htmlToText(html),
  });
}

export async function sendOverdueEmail(to: string, walletAddress: string): Promise<void> {
  await sendEmail(
    to,
    "DeathSwitch: Your check-in is overdue",
    `
      <h2>DeathSwitch Alert</h2>
      <p>Your DeathSwitch check-in is overdue for wallet <strong>${walletAddress}</strong>.</p>
      <p>Please log in and check in immediately to prevent asset distribution.</p>
      <p><a href="https://deathswitch.xyz">Login to DeathSwitch</a></p>
    `
  );
}

// Stage 2 escalation — sent via email (urgent reminder) instead of SMS.
export async function sendUrgentEmail(to: string, walletAddress: string): Promise<void> {
  await sendEmail(
    to,
    "DeathSwitch URGENT: Check-in still overdue",
    `
      <h2 style="color:#FF6B6B">DeathSwitch URGENT Alert</h2>
      <p>Your DeathSwitch check-in is still overdue for wallet <strong>${walletAddress}</strong>.</p>
      <p>You are approaching the end of your grace period. If you do not check in soon,
      your assets will be automatically distributed to your beneficiaries on-chain.</p>
      <p><a href="https://deathswitch.xyz">Login to DeathSwitch now</a></p>
    `
  );
}

// Backwards-compatible alias (kept so other call sites don't need to change).
export const sendUrgentSMS = sendUrgentEmail;

// Stage 3 — final notice email before on-chain trigger.
export async function sendFinalNoticeEmail(to: string, walletAddress: string): Promise<void> {
  await sendEmail(
    to,
    "DeathSwitch FINAL NOTICE: Trigger imminent",
    `
      <h2 style="color:#FF6B6B">DeathSwitch FINAL NOTICE</h2>
      <p>This is the final reminder for wallet <strong>${walletAddress}</strong>.</p>
      <p>Your grace period is almost over. If you do not check in immediately,
      your DeathSwitch contract will trigger and distribute your assets to your beneficiaries.</p>
      <p><a href="https://deathswitch.xyz">Login to DeathSwitch now</a></p>
    `
  );
}

export async function logPhoneCallAttempt(walletAddress: string): Promise<void> {
  logger.info({ walletAddress }, "Stage 3: Phone call attempt (simulated)");
}

export async function sendAdminAlert(subject: string, message: string): Promise<void> {
  await sendEmail(config.ADMIN_EMAIL, subject, `<pre>${message}</pre>`);
}

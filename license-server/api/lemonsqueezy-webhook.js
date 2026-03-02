// api/lemonsqueezy-webhook.js
// Lemon Squeezy → License Generator → Resend email delivery
// Vercel serverless — body parsing disabled (required for signature verification)

"use strict";

const crypto = require("crypto");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// Vercel: disable automatic body parsing so we can verify the raw payload
// ─────────────────────────────────────────────────────────────────────────────
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Collect raw request body as a Buffer (required for HMAC verification)
// ─────────────────────────────────────────────────────────────────────────────
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Verify Lemon Squeezy webhook signature
// Header: x-signature (hex-encoded HMAC-SHA256 of raw body)
// Uses constant-time comparison to prevent timing attacks
// ─────────────────────────────────────────────────────────────────────────────
function verifySignature(rawBody, signature) {
  const expected = crypto
    .createHmac("sha256", process.env.LEMON_SQUEEZY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  // Compare as binary buffers (32 bytes each) to guarantee equal lengths
  // and prevent length-based timing leaks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    // timingSafeEqual throws if buffers differ in length (tampered signature)
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate HMAC-SHA256 license key
// Format: PRORISK|<email>|lifetime|<hex-signature>
// ─────────────────────────────────────────────────────────────────────────────
function generateLicense(email) {
  const payload = `PRORISK|${email}|lifetime`;
  const signature = crypto
    .createHmac("sha256", process.env.LICENSE_SECRET)
    .update(payload)
    .digest("hex");
  return `${payload}|${signature}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Send license key email via Resend
// ─────────────────────────────────────────────────────────────────────────────
async function sendLicenseEmail(email, licenseKey) {
  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "🎉 Your PR Audit Pro License Key",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your PR Audit Pro License</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#0f0f1a;padding:32px 40px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#39FF14;letter-spacing:2px;font-family:monospace;">⚡ PR AUDIT</div>
              <div style="color:#94a3b8;font-size:13px;margin-top:6px;letter-spacing:1px;">PRO LICENSE DELIVERY</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;font-size:22px;color:#1a1a2e;">Thank you for your purchase!</h2>
              <p style="margin:0 0 24px;color:#4b5563;line-height:1.6;">
                Your PR Audit Pro license is ready. Copy the key below and activate it in the extension.
              </p>

              <!-- License Key Box -->
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #39FF14;border-radius:8px;padding:20px;margin:0 0 32px;">
                <div style="font-size:11px;font-weight:600;color:#64748b;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">Your License Key</div>
                <code style="display:block;font-family:'SFMono-Regular',Consolas,monospace;font-size:13px;color:#1a1a2e;word-break:break-all;line-height:1.6;">${licenseKey}</code>
              </div>

              <!-- Activation Steps -->
              <h3 style="margin:0 0 16px;font-size:16px;color:#1a1a2e;">Activation Instructions</h3>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding:8px 0;vertical-align:top;">
                    <span style="display:inline-block;width:24px;height:24px;background:#39FF14;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#0f0f1a;margin-right:12px;">1</span>
                    <span style="color:#374151;font-size:14px;">Open any <strong>GitHub Pull Request</strong> page in Chrome.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;vertical-align:top;">
                    <span style="display:inline-block;width:24px;height:24px;background:#39FF14;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#0f0f1a;margin-right:12px;">2</span>
                    <span style="color:#374151;font-size:14px;">Click the <strong>PR Audit</strong> extension icon in your toolbar.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;vertical-align:top;">
                    <span style="display:inline-block;width:24px;height:24px;background:#39FF14;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#0f0f1a;margin-right:12px;">3</span>
                    <span style="color:#374151;font-size:14px;">Click <strong>Enter License Key</strong>, paste your key, and click <strong>Activate</strong>.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;vertical-align:top;">
                    <span style="display:inline-block;width:24px;height:24px;background:#39FF14;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#0f0f1a;margin-right:12px;">4</span>
                    <span style="color:#374151;font-size:14px;">Pro features unlock <strong>immediately</strong> — no page refresh required.</span>
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">

              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                This is a lifetime license tied to your purchase email (<strong>${email}</strong>). Keep this email safe — it is your proof of purchase.<br><br>
                Questions? Reply directly to this email and we'll get back to you.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <span style="font-size:12px;color:#9ca3af;">PR Audit Pro · One-time purchase · No subscription</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1. Collect raw body
  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error("[ls-webhook] Failed to read request body:", err.message);
    return res.status(400).json({ error: "Could not read request body" });
  }

  // 2. Validate signature header is present
  const signature = req.headers["x-signature"];
  if (!signature) {
    console.error("[ls-webhook] Missing x-signature header");
    return res.status(401).json({ error: "Missing signature" });
  }

  // 3. Verify signature (constant-time)
  if (!verifySignature(rawBody, signature)) {
    console.error("[ls-webhook] Signature mismatch — request rejected");
    return res.status(401).json({ error: "Invalid signature" });
  }

  // 4. Parse JSON body
  let body;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch (err) {
    console.error("[ls-webhook] JSON parse error:", err.message);
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  // 5. Handle order_created
  const eventName = body.meta?.event_name;

  if (eventName === "order_created") {
    const email = body.data?.attributes?.user_email;

    if (!email) {
      // No email present — acknowledge to prevent Lemon Squeezy retries
      console.error("[ls-webhook] No email in order payload, order id:", body.data?.id);
      return res.status(200).json({ received: true });
    }

    const licenseKey = generateLicense(email);

    try {
      await sendLicenseEmail(email, licenseKey);
      console.log(`[ls-webhook] License delivered → ${email}`);
    } catch (err) {
      // Return 500 so Lemon Squeezy retries the delivery
      console.error("[ls-webhook] Email send failed:", err.message);
      return res.status(500).json({ error: "License email delivery failed" });
    }
  }

  // 6. Acknowledge all other events
  return res.status(200).json({ received: true });
}

module.exports = handler;

"use strict";

const crypto = require("crypto");
const { Resend } = require("resend");
const { saveUserLicenseMapping } = require("./_lib/user-mapping");
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function isHex(value) {
  return typeof value === "string" && /^[a-f0-9]+$/i.test(value);
}

function safeCompareHex(leftHex, rightHex) {
  if (!isHex(leftHex) || !isHex(rightHex)) {
    return false;
  }

  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function verifyLemonSignature(rawBody, headerSignature, webhookSecret) {
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  return safeCompareHex(expected, headerSignature);
}

function generateLicenseKey(email, licenseSecret) {
  const payload = `PRORISK|${email}|lifetime`;
  const signature = crypto
    .createHmac("sha256", licenseSecret)
    .update(payload)
    .digest("hex");
  return `${payload}|${signature}`;
}

async function sendLicenseEmail({ resendApiKey, from, to, licenseKey }) {
  const resend = new Resend(resendApiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: "🎉 Your PR Audit Pro License",
    html: `
      <p>Thank you for purchasing PR Audit Pro.</p>
      <p>Your lifetime license key:</p>
      <p><code>${licenseKey}</code></p>
      <p>Activation instructions:</p>
      <ol>
        <li>Open the PR Audit Pro extension.</li>
        <li>Go to license activation.</li>
        <li>Paste the key and click Activate.</li>
      </ol>
      <p>Need help? Reply to this email for support.</p>
    `,
  });

  if (error) {
    throw new Error(error.message || "Resend email failed");
  }
}

function extractAppUserId(payload) {
  const candidates = [
    payload?.meta?.custom_data?.user_id,
    payload?.meta?.custom?.user_id,
    payload?.meta?.checkout_data?.custom?.user_id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }

  return null;
}

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  const licenseSecret = process.env.LICENSE_SECRET;
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  if (!webhookSecret || !licenseSecret || !resendApiKey || !emailFrom) {
    console.error("[ls-webhook] Missing required environment configuration");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error("[ls-webhook] Failed to read request body");
    return res.status(400).json({ error: "Could not read request body" });
  }

  const headerValue = req.headers["x-signature"];
  const signature = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (!signature || typeof signature !== "string") {
    console.error("[ls-webhook] Missing signature header");
    return res.status(401).json({ error: "Missing signature" });
  }

  if (!verifyLemonSignature(rawBody, signature, webhookSecret)) {
    console.error("[ls-webhook] Invalid webhook signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  let body = null;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    console.error("[ls-webhook] Invalid JSON payload");
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  if (body?.meta?.event_name !== "order_created") {
    return res.status(200).json({ received: true });
  }

  const email = body?.data?.attributes?.user_email;
  if (!email || typeof email !== "string") {
    console.error("[ls-webhook] Missing customer email on order_created");
    return res.status(200).json({ received: true });
  }

  const appUserId = extractAppUserId(body);
  if (!appUserId) {
    console.warn("[ls-webhook] Missing custom user_id in Lemon payload");
  }

  const licenseKey = generateLicenseKey(email, licenseSecret);

  try {
    await sendLicenseEmail({
      resendApiKey,
      from: emailFrom,
      to: email,
      licenseKey,
    });

    if (appUserId) {
      const mapResult = await saveUserLicenseMapping({
        userId: appUserId,
        email,
        licenseKey,
        source: "lemonsqueezy",
      });
      console.log("[ls-webhook] User mapping stored", {
        appUserId,
        storage: mapResult.storage,
      });
    }

    console.log("[ls-webhook] License email sent", {
      appUserId,
      email,
      event: body?.meta?.event_name,
    });
  } catch (err) {
    console.error("[ls-webhook] Failed to send license email");
    return res.status(500).json({ error: "License email delivery failed" });
  }

  return res.status(200).json({ received: true });
}

module.exports = handler;

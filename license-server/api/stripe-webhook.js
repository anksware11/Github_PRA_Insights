"use strict";

const crypto = require("crypto");
const Stripe = require("stripe");
const { Resend } = require("resend");
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
    `,
  });

  if (error) {
    throw new Error(error.message || "Resend email failed");
  }
}

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const licenseSecret = process.env.LICENSE_SECRET;
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  if (!stripeSecretKey || !webhookSecret || !licenseSecret || !resendApiKey || !emailFrom) {
    console.error("[stripe-webhook] Missing required environment configuration");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const stripe = new Stripe(stripeSecretKey);

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch {
    console.error("[stripe-webhook] Failed to read raw request body");
    return res.status(400).json({ error: "Could not read request body" });
  }

  const sigHeader = req.headers["stripe-signature"];
  const stripeSignature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
  if (!stripeSignature || typeof stripeSignature !== "string") {
    console.error("[stripe-webhook] Missing stripe-signature header");
    return res.status(400).json({ error: "Missing Stripe signature" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, stripeSignature, webhookSecret);
  } catch {
    console.error("[stripe-webhook] Invalid webhook signature");
    return res.status(400).json({ error: "Invalid signature" });
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const email = session?.customer_details?.email;

  if (!email || typeof email !== "string") {
    console.error("[stripe-webhook] Missing customer email on checkout session");
    return res.status(200).json({ received: true });
  }

  const licenseKey = generateLicenseKey(email, licenseSecret);

  try {
    await sendLicenseEmail({
      resendApiKey,
      from: emailFrom,
      to: email,
      licenseKey,
    });
    console.log("[stripe-webhook] License email sent");
  } catch {
    console.error("[stripe-webhook] Failed to send license email");
    return res.status(500).json({ error: "License email delivery failed" });
  }

  return res.status(200).json({ received: true });
}

module.exports = handler;

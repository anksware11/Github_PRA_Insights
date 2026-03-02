import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { saveUserLicenseMapping } = require('../../license-server/api/_lib/user-mapping.js');

export const config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function isHex(value) {
  return typeof value === 'string' && /^[a-f0-9]+$/i.test(value);
}

function safeCompareHex(leftHex, rightHex) {
  if (!isHex(leftHex) || !isHex(rightHex)) {
    return false;
  }

  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function verifyLemonSignature(rawBody, headerSignature, signingSecret) {
  const expected = crypto
    .createHmac('sha256', signingSecret)
    .update(rawBody)
    .digest('hex');

  return safeCompareHex(expected, headerSignature);
}

function generateLicenseKey(email, licenseSecret) {
  const payload = `PRORISK|${email}|lifetime`;
  const signature = crypto
    .createHmac('sha256', licenseSecret)
    .update(payload)
    .digest('hex');
  return `${payload}|${signature}`;
}

async function sendLicenseEmail({ resendApiKey, from, to, licenseKey }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: '🎉 Your PR Audit Pro License',
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
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`Resend API failed (${response.status}): ${errorPayload}`);
  }
}

function extractAppUserId(payload) {
  const candidates = [
    payload?.meta?.custom_data?.user_id,
    payload?.meta?.custom?.user_id,
    payload?.meta?.checkout_data?.custom?.user_id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }

    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signingSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  const licenseSecret = process.env.LICENSE_SECRET;
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  if (!signingSecret || !licenseSecret || !resendApiKey || !emailFrom) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch {
    return res.status(400).json({ error: 'Could not read request body' });
  }

  const signatureHeader = req.headers['x-signature'];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

  if (!signature || typeof signature !== 'string') {
    return res.status(401).send('Missing signature.');
  }

  if (!verifyLemonSignature(rawBody, signature, signingSecret)) {
    return res.status(401).send('Invalid signature.');
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const eventName = body?.meta?.event_name;
  const data = body?.data;

  if (eventName === 'order_created') {
    const userEmail = data?.attributes?.user_email;
    const orderId = data?.id;
    if (!userEmail || typeof userEmail !== 'string') {
      return res.status(200).json({ received: true });
    }

    const appUserId = extractAppUserId(body);
    const licenseKey = generateLicenseKey(userEmail, licenseSecret);

    try {
      await sendLicenseEmail({
        resendApiKey,
        from: emailFrom,
        to: userEmail,
        licenseKey,
      });

      if (appUserId) {
        const mapResult = await saveUserLicenseMapping({
          userId: appUserId,
          email: userEmail,
          licenseKey,
          source: 'lemonsqueezy',
        });

        console.log('[lemon-webhook] User mapping stored', {
          appUserId,
          storage: mapResult.storage,
        });
      }

      console.log('[lemon-webhook] License email sent', {
        appUserId,
        userEmail,
        orderId,
        event: eventName,
      });
    } catch (error) {
      console.error('[lemon-webhook] License handling failed:', error.message || error);
      return res.status(500).json({ error: 'License handling failed' });
    }
  }

  return res.status(200).json({ received: true });
}

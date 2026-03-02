"use strict";

const { getUserLicenseMapping } = require("./_lib/user-mapping");

function getProvidedToken(req) {
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  const apiKeyHeader = req.headers?.["x-api-key"];
  if (typeof apiKeyHeader === "string") {
    return apiKeyHeader.trim();
  }

  return null;
}

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const lookupToken = process.env.LICENSE_LOOKUP_TOKEN;
  if (!lookupToken) {
    console.error("[license-by-user] Missing LICENSE_LOOKUP_TOKEN");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const providedToken = getProvidedToken(req);
  if (!providedToken || providedToken !== lookupToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = req.query?.user_id;
  if (!userId) {
    return res.status(400).json({ error: "Missing user_id query parameter" });
  }

  try {
    const mapping = await getUserLicenseMapping(userId);
    if (!mapping) {
      return res.status(404).json({ found: false });
    }

    return res.status(200).json({
      found: true,
      userId: mapping.userId,
      email: mapping.email,
      licenseKey: mapping.licenseKey,
      source: mapping.source,
      updatedAt: mapping.updatedAt,
    });
  } catch (error) {
    console.error("[license-by-user] Lookup failed:", error.message);
    return res.status(500).json({ error: "Lookup failed" });
  }
}

module.exports = handler;

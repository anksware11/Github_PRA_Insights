"use strict";

const inMemoryMappings = new Map();

function normalizeUserId(userId) {
  if (typeof userId === "number" && Number.isFinite(userId)) {
    return String(userId);
  }

  if (typeof userId === "string") {
    const trimmed = userId.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function getKvConfig() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

async function kvSet(key, value) {
  const config = getKvConfig();
  if (!config) {
    return false;
  }

  const endpoint = `${config.url}/set/${encodeURIComponent(key)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value: JSON.stringify(value) }),
  });

  if (!response.ok) {
    throw new Error(`KV set failed with status ${response.status}`);
  }

  return true;
}

async function kvGet(key) {
  const config = getKvConfig();
  if (!config) {
    return null;
  }

  const endpoint = `${config.url}/get/${encodeURIComponent(key)}`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`KV get failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || payload.result == null) {
    return null;
  }

  if (typeof payload.result === "string") {
    return JSON.parse(payload.result);
  }

  return payload.result;
}

function createMappingRecord({ userId, email, licenseKey, source }) {
  return {
    userId,
    email,
    licenseKey,
    source: source || "lemonsqueezy",
    updatedAt: new Date().toISOString(),
  };
}

async function saveUserLicenseMapping({ userId, email, licenseKey, source }) {
  const normalized = normalizeUserId(userId);
  if (!normalized) {
    return { saved: false, reason: "missing_user_id" };
  }

  const record = createMappingRecord({
    userId: normalized,
    email,
    licenseKey,
    source,
  });

  const key = `license:user:${normalized}`;

  try {
    const persisted = await kvSet(key, record);
    if (persisted) {
      return { saved: true, storage: "kv", record };
    }
  } catch (error) {
    console.error("[user-mapping] KV save failed, falling back to memory:", error.message);
  }

  inMemoryMappings.set(key, record);
  return { saved: true, storage: "memory", record };
}

async function getUserLicenseMapping(userId) {
  const normalized = normalizeUserId(userId);
  if (!normalized) {
    return null;
  }

  const key = `license:user:${normalized}`;

  try {
    const fromKv = await kvGet(key);
    if (fromKv) {
      return fromKv;
    }
  } catch (error) {
    console.error("[user-mapping] KV read failed, trying memory fallback:", error.message);
  }

  return inMemoryMappings.get(key) || null;
}

module.exports = {
  saveUserLicenseMapping,
  getUserLicenseMapping,
};

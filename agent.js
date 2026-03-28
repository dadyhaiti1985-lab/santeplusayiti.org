// Simple email and spam detection agent

// Verify email format
async function verifyEmail(email) {
  if (!email || !email.includes("@")) {
    return { valid: false, message: "Fake email ❌" };
  }
  const parts = email.split("@");
  if (parts.length !== 2 || !parts[1].includes(".")) {
    return { valid: false, message: "Invalid email format ❌" };
  }
  return { valid: true, message: "Valid email ✅" };
}

// Detect spam based on request patterns
function detectSpam(userPattern = {}) {
  const { requests = 0, messageLength = 0, hasLinks = false } = userPattern;

  if (requests > 10) {
    return { isSpam: true, reason: "Too many requests", score: 0.9 };
  }
  if (messageLength < 5) {
    return { isSpam: true, reason: "Message too short", score: 0.7 };
  }
  if (hasLinks && messageLength < 50) {
    return { isSpam: true, reason: "Suspicious link + short message", score: 0.8 };
  }
  return { isSpam: false, reason: "Normal ✅", score: 0.1 };
}

// Rate limiter (in-memory; use Redis in production)
const requestLog = new Map();

function checkRateLimit(identifier, maxRequests = 5, windowMs = 60000) {
  const now = Date.now();
  if (!requestLog.has(identifier)) {
    requestLog.set(identifier, []);
  }

  const log = requestLog.get(identifier);
  const recent = log.filter(timestamp => now - timestamp < windowMs);

  if (recent.length >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((recent[0] + windowMs - now) / 1000) };
  }

  recent.push(now);
  requestLog.set(identifier, recent);
  return { allowed: true };
}

export { verifyEmail, detectSpam, checkRateLimit };

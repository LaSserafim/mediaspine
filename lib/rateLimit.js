// Best-effort per-IP limiter. State lives in one warm serverless instance, so it slows abuse but is not a hard cap.
const buckets = new Map();

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress) || 'unknown';
}

// Returns true when the request is allowed.
export function allow(req, name, max, windowMs) {
  const now = Date.now();
  if (buckets.size > 1000) {
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }
  const key = `${name}:${clientIp(req)}`;
  let b = buckets.get(key);
  if (!b || now > b.reset) b = { count: 0, reset: now + windowMs };
  if (b.count >= max) return false;
  b.count++;
  buckets.set(key, b);
  return true;
}

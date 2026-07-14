import { timingSafeEqual } from "node:crypto";

export const MAX_JSON_BODY_BYTES = 1024 * 1024;

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function isMutationAllowed(headers, allowedOrigins, actionToken) {
  const origin = String(headers.origin || "");
  if (origin && allowedOrigins.has(origin)) {
    return true;
  }
  return Boolean(actionToken) && constantTimeEqual(headers["x-atlas-action-token"], actionToken);
}

export function readJsonBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let body = "";
    let received = 0;
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      received += Buffer.byteLength(chunk);
      if (received > maxBytes) {
        const error = new Error("request body exceeds 1 MiB");
        error.statusCode = 413;
        reject(error);
        req.resume();
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (received > maxBytes) return;
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        const error = new Error("invalid JSON request body");
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

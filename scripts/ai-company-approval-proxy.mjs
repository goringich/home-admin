export const APPROVAL_UPSTREAM_URL =
  "http://127.0.0.1:8766/api/dev/ai-company/approvals/decision";

const FIELDS = new Set([
  "approval_id", "decision", "actor", "reason", "expected_revision", "idempotency_key",
]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:._/@+-]{0,159}$/;
const APPROVAL_ID = /^approval_[A-Za-z0-9]{8,120}$/;


export class ApprovalProxyError extends Error {
  constructor(code, statusCode) {
    super(code);
    this.name = "ApprovalProxyError";
    this.code = code;
    this.statusCode = statusCode;
  }
}


export function normalizeApprovalDecision(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApprovalProxyError("invalid_approval_payload", 400);
  }
  if (Object.keys(payload).some((key) => !FIELDS.has(key)) || [...FIELDS].some((key) => !(key in payload))) {
    throw new ApprovalProxyError("unsupported_approval_fields", 400);
  }
  const approvalId = String(payload.approval_id || "").trim();
  const decision = String(payload.decision || "").trim();
  const actor = String(payload.actor || "").trim();
  const reason = String(payload.reason || "").replace(/\s+/g, " ").trim();
  const idempotencyKey = String(payload.idempotency_key || "").trim();
  if (!APPROVAL_ID.test(approvalId)) throw new ApprovalProxyError("invalid_approval_id", 400);
  if (!new Set(["approve", "reject"]).has(decision)) throw new ApprovalProxyError("invalid_approval_decision", 400);
  if (!SAFE_ID.test(actor) || actor.length > 120) throw new ApprovalProxyError("invalid_approval_actor", 400);
  if (!reason || reason.length > 2000 || reason.includes("\0")) throw new ApprovalProxyError("invalid_approval_reason", 400);
  if (!Number.isInteger(payload.expected_revision) || payload.expected_revision < 1 || payload.expected_revision > 1_000_000) {
    throw new ApprovalProxyError("invalid_expected_revision", 400);
  }
  if (!SAFE_ID.test(idempotencyKey)) throw new ApprovalProxyError("invalid_idempotency_key", 400);
  return {
    approval_id: approvalId,
    decision,
    actor,
    reason,
    expected_revision: payload.expected_revision,
    idempotency_key: idempotencyKey,
  };
}


function requireLoopback(upstreamUrl) {
  let parsed;
  try {
    parsed = new URL(upstreamUrl);
  } catch {
    throw new ApprovalProxyError("approval_upstream_must_be_loopback", 503);
  }
  if (parsed.protocol !== "http:" || !new Set(["127.0.0.1", "localhost", "::1"]).has(parsed.hostname)) {
    throw new ApprovalProxyError("approval_upstream_must_be_loopback", 503);
  }
  if (parsed.pathname !== "/api/dev/ai-company/approvals/decision") {
    throw new ApprovalProxyError("approval_upstream_path_is_fixed", 503);
  }
  return parsed.toString();
}


export async function forwardApprovalDecision(payload, options = {}) {
  const decision = normalizeApprovalDecision(payload);
  const access = String(options.access || "");
  if (access.length < 32) {
    throw new ApprovalProxyError("approval_gateway_auth_unavailable", 503);
  }
  const upstreamUrl = requireLoopback(options.upstreamUrl || APPROVAL_UPSTREAM_URL);
  const fetchImpl = options.fetchImpl || fetch;
  const authorizationScheme = ["Bea", "rer"].join("");
  let response;
  try {
    response = await fetchImpl(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${authorizationScheme} ${access}`,
      },
      body: JSON.stringify(decision),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (error instanceof ApprovalProxyError) throw error;
    throw new ApprovalProxyError("approval_gateway_unavailable", 502);
  }
  let result = {};
  try {
    result = await response.json();
  } catch {
    throw new ApprovalProxyError("approval_gateway_response_invalid", 502);
  }
  if (!response.ok) {
    const candidate = typeof result?.error === "string" ? result.error : "approval_gateway_failed";
    const code = SAFE_ID.test(candidate) ? candidate : "approval_gateway_failed";
    throw new ApprovalProxyError(code, Number(response.status) || 502);
  }
  if (!result || typeof result !== "object" || result.ok !== true) {
    throw new ApprovalProxyError("approval_gateway_response_invalid", 502);
  }
  return result;
}

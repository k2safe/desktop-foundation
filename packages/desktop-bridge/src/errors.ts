export type DesktopErrorKind =
  | "network"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "validation"
  | "rate-limited"
  | "server"
  | "blocked"
  | "configuration"
  | "business"
  | "unknown";

export interface DesktopErrorShape {
  code: string;
  message: string;
  status?: number;
  requestId?: string;
  details?: unknown;
  kind?: DesktopErrorKind;
  retryable?: boolean;
  cause?: unknown;
}

export class DesktopError extends Error implements DesktopErrorShape {
  code: string;
  status?: number;
  requestId?: string;
  details?: unknown;
  kind: DesktopErrorKind;
  retryable: boolean;
  cause?: unknown;

  constructor(shape: DesktopErrorShape) {
    super(shape.message);
    this.name = "DesktopError";
    this.code = shape.code;
    this.status = shape.status;
    this.requestId = shape.requestId;
    this.details = shape.details;
    this.kind = shape.kind ?? getDesktopErrorKind(shape);
    this.retryable = shape.retryable ?? isRetryableDesktopError({ ...shape, kind: this.kind });
    this.cause = shape.cause;
  }
}

export class UnauthorizedError extends DesktopError {
  constructor(message = "Unauthorized", requestId?: string) {
    super({ code: "UNAUTHORIZED", message, status: 401, requestId, kind: "unauthorized", retryable: false });
    this.name = "UnauthorizedError";
  }
}

export function getDesktopErrorKind(shape: Pick<DesktopErrorShape, "code" | "status" | "kind">): DesktopErrorKind {
  if (shape.kind) return shape.kind;

  const code = String(shape.code || "").toUpperCase();
  const status = shape.status;

  if (code === "UNAUTHORIZED" || status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 408 || code === "TIMEOUT" || code === "ABORT_ERR") return "timeout";
  if (status === 429) return "rate-limited";
  if (status === 400 || status === 422) return "validation";
  if (typeof status === "number" && status >= 500) return "server";
  if (code === "NETWORK_ERROR") return "network";
  if (code.endsWith("_BLOCKED")) return "blocked";
  if (code.endsWith("_MISSING") || code.endsWith("_POLICY_MISSING")) return "configuration";
  if (code && code !== "UNKNOWN_ERROR" && code !== "ERROR") return "business";
  return "unknown";
}

export function isRetryableDesktopError(shape: Pick<DesktopErrorShape, "code" | "status" | "kind" | "retryable">) {
  if (typeof shape.retryable === "boolean") return shape.retryable;
  const kind = getDesktopErrorKind(shape);
  if (kind === "network" || kind === "timeout" || kind === "rate-limited" || kind === "server") return true;
  return false;
}

export function isDesktopError(error: unknown): error is DesktopError {
  return error instanceof DesktopError;
}

export function normalizeDesktopError(error: unknown, fallback: Partial<DesktopErrorShape> = {}): DesktopError {
  if (error instanceof DesktopError) return error;

  if (error && typeof error === "object") {
    const candidate = error as Partial<DesktopErrorShape> & { name?: string };
    if (candidate.message || candidate.code || candidate.status) {
      return new DesktopError({
        code: String(candidate.code ?? fallback.code ?? candidate.name ?? "UNKNOWN_ERROR"),
        message: String(candidate.message ?? fallback.message ?? "Request failed"),
        status: candidate.status ?? fallback.status,
        requestId: candidate.requestId ?? fallback.requestId,
        details: candidate.details ?? fallback.details ?? error,
        kind: candidate.kind ?? fallback.kind,
        retryable: candidate.retryable ?? fallback.retryable,
        cause: candidate.cause ?? fallback.cause ?? error
      });
    }
  }

  if (error instanceof Error) {
    return new DesktopError({
      code: fallback.code ?? error.name ?? "UNKNOWN_ERROR",
      message: error.message || fallback.message || "Request failed",
      status: fallback.status,
      requestId: fallback.requestId,
      details: fallback.details,
      kind: fallback.kind,
      retryable: fallback.retryable,
      cause: error
    });
  }

  return new DesktopError({
    code: fallback.code ?? "UNKNOWN_ERROR",
    message: fallback.message ?? String(error || "Request failed"),
    status: fallback.status,
    requestId: fallback.requestId,
    details: fallback.details ?? error,
    kind: fallback.kind,
    retryable: fallback.retryable,
    cause: fallback.cause
  });
}

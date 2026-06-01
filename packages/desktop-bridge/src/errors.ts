export interface DesktopErrorShape {
  code: string;
  message: string;
  status?: number;
  requestId?: string;
  details?: unknown;
}

export class DesktopError extends Error implements DesktopErrorShape {
  code: string;
  status?: number;
  requestId?: string;
  details?: unknown;

  constructor(shape: DesktopErrorShape) {
    super(shape.message);
    this.name = "DesktopError";
    this.code = shape.code;
    this.status = shape.status;
    this.requestId = shape.requestId;
    this.details = shape.details;
  }
}

export class UnauthorizedError extends DesktopError {
  constructor(message = "Unauthorized", requestId?: string) {
    super({ code: "UNAUTHORIZED", message, status: 401, requestId });
    this.name = "UnauthorizedError";
  }
}

import type { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(m = 'Bad request', details?: unknown) {
    return new ApiError(400, m, 'bad_request', details);
  }
  static unauthorized(m = 'Unauthorized') {
    return new ApiError(401, m, 'unauthorized');
  }
  static forbidden(m = 'Forbidden') {
    return new ApiError(403, m, 'forbidden');
  }
  static notFound(m = 'Not found') {
    return new ApiError(404, m, 'not_found');
  }
  static conflict(m = 'Conflict') {
    return new ApiError(409, m, 'conflict');
  }
  static tooMany(m = 'Too many requests') {
    return new ApiError(429, m, 'rate_limited');
  }
  static upstream(m = 'Upstream service error', details?: unknown) {
    return new ApiError(502, m, 'upstream_error', details);
  }
}

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler =
  (fn: AsyncFn) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

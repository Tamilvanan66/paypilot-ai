import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../utils/errors.js';
import { env } from '../config/env.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let message = 'Internal server error';
  let code = 'internal_error';
  let details: unknown;

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
    code = err.code;
    details = err.details;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = 'validation_error';
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'invalid_id';
    message = `Invalid value for ${err.path}`;
  } else if (typeof err === 'object' && err && (err as { code?: number }).code === 11000) {
    status = 409;
    code = 'duplicate_key';
    const key = (err as { keyValue?: Record<string, unknown> }).keyValue ?? {};
    message = `Duplicate value for ${Object.keys(key).join(', ') || 'unique field'}`;
    details = key;
  } else if (err instanceof Error) {
    message = env.isProd ? 'Internal server error' : err.message;
    if (!env.isProd) details = err.stack?.split('\n').slice(0, 6).join('\n');
  }

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  res.status(status).json({ success: false, error: { code, message, details } });
}

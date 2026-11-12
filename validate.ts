import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ApiError } from '../utils/errors.js';

type Part = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodTypeAny, part: Part = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[part]);
      // query/params are getter-only in Express 5; assign defensively.
      if (part === 'body') req.body = parsed;
      else Object.defineProperty(req, part, { value: parsed, writable: true, configurable: true });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((i) => ({
          field: i.path.join('.') || part,
          message: i.message,
        }));
        return next(ApiError.badRequest('Validation failed', details));
      }
      next(err);
    }
  };

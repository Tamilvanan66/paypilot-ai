import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const skip = () => env.isTest;

export const generalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { success: false, error: { code: 'rate_limited', message: 'Too many requests' } },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: {
    success: false,
    error: { code: 'rate_limited', message: 'Too many auth attempts, try again later' },
  },
});

export const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: {
    success: false,
    error: { code: 'rate_limited', message: 'Too many AI requests, slow down' },
  },
});

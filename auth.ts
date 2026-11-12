import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/errors.js';
import type { Role } from '../models/User.js';
import { User } from '../models/User.js';

export interface TokenPayload {
  sub: string;
}

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSecure ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSecure ? 'none' : 'lax',
    path: '/',
  });
}

export function readToken(req: Request): string | null {
  const fromCookie = req.cookies?.[env.cookieName];
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = readToken(req);
    if (!token) throw ApiError.unauthorized('Authentication required');

    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, env.jwtSecret) as TokenPayload;
    } catch {
      throw ApiError.unauthorized('Session expired or invalid');
    }

    const user = await User.findById(payload.sub).lean();
    if (!user) throw ApiError.unauthorized('Account no longer exists');

    req.user = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role as Role,
      storeId: user.storeId,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`));
    }
    next();
  };

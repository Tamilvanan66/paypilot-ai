import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validators/schemas.js';
import {
  forgotPassword,
  login,
  logout,
  me,
  register,
  resetPassword,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(register));
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.get('/me', requireAuth, asyncHandler(me));
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), asyncHandler(forgotPassword));
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), asyncHandler(resetPassword));

export default router;

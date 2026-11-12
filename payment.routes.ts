import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { capturePayPalOrderSchema, createPayPalOrderSchema } from '../validators/schemas.js';
import {
  captureOrder,
  createOrder,
  listPayments,
  paypalConfig,
  webhook,
} from '../controllers/paymentController.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

// PayPal calls this — no cookie/session, signature-verified instead. Must be raw-ish JSON.
router.post('/paypal/webhook', asyncHandler(webhook));

router.get('/paypal/config', requireAuth, asyncHandler(paypalConfig));
router.post('/paypal/create-order', requireAuth, validate(createPayPalOrderSchema), asyncHandler(createOrder));
router.post('/paypal/capture-order', requireAuth, validate(capturePayPalOrderSchema), asyncHandler(captureOrder));
router.get('/', requireAuth, asyncHandler(listPayments));

export default router;

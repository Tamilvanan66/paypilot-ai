import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import {
  getOrders,
  getOverview,
  getProducts,
  getRevenue,
} from '../controllers/analyticsController.js';

const router = Router();
router.use(requireAuth);

router.get('/overview', asyncHandler(getOverview));
router.get('/revenue', asyncHandler(getRevenue));
router.get('/products', asyncHandler(getProducts));
router.get('/orders', asyncHandler(getOrders));

export default router;

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { orderCreateSchema, orderQuerySchema, orderStatusSchema } from '../validators/schemas.js';
import {
  createOrder,
  getOrder,
  listOrders,
  recentOrders,
  updateOrderStatus,
} from '../controllers/orderController.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate(orderQuerySchema, 'query'), asyncHandler(listOrders));
router.get('/recent', asyncHandler(recentOrders));
router.post('/', validate(orderCreateSchema), asyncHandler(createOrder));
router.get('/:id', asyncHandler(getOrder));
router.put('/:id/status', validate(orderStatusSchema), asyncHandler(updateOrderStatus));

export default router;

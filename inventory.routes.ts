import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { inventoryAdjustSchema, movementsQuerySchema } from '../validators/schemas.js';
import {
  adjustInventory,
  listInventory,
  listMovements,
} from '../controllers/inventoryController.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(listInventory));
router.get('/movements', validate(movementsQuerySchema, 'query'), asyncHandler(listMovements));
router.put('/:productId', validate(inventoryAdjustSchema), asyncHandler(adjustInventory));

export default router;

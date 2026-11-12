import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notificationsQuerySchema } from '../validators/schemas.js';
import {
  listNotifications,
  markAllRead,
  markRead,
} from '../controllers/notificationController.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate(notificationsQuerySchema, 'query'), asyncHandler(listNotifications));
router.put('/read-all', asyncHandler(markAllRead));
router.put('/:id/read', asyncHandler(markRead));

export default router;

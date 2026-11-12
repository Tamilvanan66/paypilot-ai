import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  chatSchema,
  generateDescriptionSchema,
  recommendSchema,
} from '../validators/schemas.js';
import {
  aiStatus,
  businessInsights,
  chat,
  generateDescription,
  getConversation,
  listConversations,
  recommendations,
} from '../controllers/aiController.js';
import { asyncHandler } from '../utils/errors.js';
import { aiLimiter } from '../middleware/rateLimit.js';

const router = Router();
router.use(requireAuth);

router.get('/status', asyncHandler(aiStatus));
router.post('/chat', aiLimiter, validate(chatSchema), asyncHandler(chat));
router.get('/conversations', asyncHandler(listConversations));
router.get('/conversations/:id', asyncHandler(getConversation));
router.post('/recommendations', aiLimiter, validate(recommendSchema), asyncHandler(recommendations));
router.post('/generate-description', aiLimiter, validate(generateDescriptionSchema), asyncHandler(generateDescription));
router.post('/business-insights', aiLimiter, asyncHandler(businessInsights));

export default router;

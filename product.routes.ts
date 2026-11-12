import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  productCreateSchema,
  productQuerySchema,
  productUpdateSchema,
} from '../validators/schemas.js';
import {
  createCategory,
  createProduct,
  deleteProduct,
  getProduct,
  listCategories,
  listProducts,
  updateProduct,
} from '../controllers/productController.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate(productQuerySchema, 'query'), asyncHandler(listProducts));
router.post('/', requireRole('owner', 'manager'), validate(productCreateSchema), asyncHandler(createProduct));
router.get('/categories', asyncHandler(listCategories));
router.post('/categories', requireRole('owner', 'manager'), asyncHandler(createCategory));
router.get('/:id', asyncHandler(getProduct));
router.put('/:id', requireRole('owner', 'manager'), validate(productUpdateSchema), asyncHandler(updateProduct));
router.delete('/:id', requireRole('owner'), asyncHandler(deleteProduct));

export default router;

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import productRoutes from './product.routes.js';
import orderRoutes from './order.routes.js';
import paymentRoutes from './payment.routes.js';
import aiRoutes from './ai.routes.js';
import analyticsRoutes from './analytics.routes.js';
import inventoryRoutes from './inventory.routes.js';
import notificationRoutes from './notification.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/ai', aiRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/notifications', notificationRoutes);

export default router;

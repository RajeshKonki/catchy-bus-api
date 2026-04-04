import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();
const dashboardController = new DashboardController();

router.get('/stats', authenticateJWT, requireActiveSubscription, dashboardController.getSummary);
router.get('/activities', authenticateJWT, requireActiveSubscription, dashboardController.getActivities);
router.post('/activities', authenticateJWT, requireActiveSubscription, dashboardController.createActivity);
router.delete('/activities/clear', authenticateJWT, requireActiveSubscription, dashboardController.clearActivities);

export default router;

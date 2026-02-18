import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const dashboardController = new DashboardController();

router.get('/stats', authenticateJWT, dashboardController.getSummary);
router.get('/activities', authenticateJWT, dashboardController.getActivities);
router.post('/activities', authenticateJWT, dashboardController.createActivity);

export default router;

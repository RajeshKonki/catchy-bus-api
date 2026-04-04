import { Router } from 'express';
import { HelpdeskController } from '../controllers/helpdesk.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const helpdeskController = new HelpdeskController();

router.get('/notifications', authenticateJWT, helpdeskController.getNotifications);
router.patch('/notifications/:id/read', authenticateJWT, helpdeskController.markAsRead);
router.post('/notifications/read-all', authenticateJWT, helpdeskController.markAllAsRead);

export default router;

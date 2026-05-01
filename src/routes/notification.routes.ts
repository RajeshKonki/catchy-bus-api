import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();
const notificationController = new NotificationController();

// Get all notifications for the current student
router.get('/', authenticateJWT, requireActiveSubscription, notificationController.getNotifications);

// Mark a notification as read
router.patch('/:id/read', authenticateJWT, requireActiveSubscription, notificationController.markAsRead);

// Mark all as read
router.patch('/read-all', authenticateJWT, requireActiveSubscription, notificationController.markAllAsRead);

// Delete a notification
router.delete('/:id', authenticateJWT, requireActiveSubscription, notificationController.deleteNotification);

// Delete all notifications
router.delete('/all', authenticateJWT, requireActiveSubscription, notificationController.deleteAllNotifications);

export default router;

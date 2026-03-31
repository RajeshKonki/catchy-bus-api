import { Router } from 'express';
import { StudentController } from '../controllers/student.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();
const studentController = new StudentController();

router.get('/', authenticateJWT, requireActiveSubscription, studentController.getAll);
router.get('/:id', authenticateJWT, requireActiveSubscription, studentController.getById);
router.post('/', authenticateJWT, requireActiveSubscription, studentController.create);
router.put('/:id', authenticateJWT, requireActiveSubscription, studentController.update);
router.delete('/:id', authenticateJWT, requireActiveSubscription, studentController.delete);
router.post('/notification-settings', authenticateJWT, requireActiveSubscription, studentController.updateNotificationSettings);

export default router;

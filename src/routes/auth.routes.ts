import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();
const authController = new AuthController();

router.post('/admin/login', authController.adminLogin);
router.post('/college/login', authController.collegeLogin);
router.post('/college/forgot-password', authController.collegeForgotPassword);
router.post('/check-phone', authController.checkPhone);
router.post('/student/login', authController.studentLogin);
router.post('/parent/login', authController.parentLogin);
router.post('/driver/login', authController.driverLogin);
router.get('/me', authenticateJWT, requireActiveSubscription, authController.getMe);
router.post('/fcm-token', authenticateJWT, requireActiveSubscription, authController.updateFcmToken);

export default router;

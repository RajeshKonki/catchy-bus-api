import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const authController = new AuthController();

router.post('/admin/login', authController.adminLogin);
router.post('/college/login', authController.collegeLogin);
router.get('/me', authenticateJWT, authController.getMe);
router.put('/me', authenticateJWT, authController.updateProfile);

export default router;

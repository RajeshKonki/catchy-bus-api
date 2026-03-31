import { Router } from 'express';
import { CollegeController } from '../controllers/college.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();
const collegeController = new CollegeController();

router.get('/', authenticateJWT, requireActiveSubscription, collegeController.getAll);
router.get('/:id', authenticateJWT, requireActiveSubscription, collegeController.getById);
router.post('/', authenticateJWT, requireActiveSubscription, collegeController.create);
router.put('/:id', authenticateJWT, requireActiveSubscription, collegeController.update);
router.delete('/:id', authenticateJWT, requireActiveSubscription, collegeController.delete);

export default router;

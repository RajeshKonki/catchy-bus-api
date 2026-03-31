import { Router } from 'express';
import { SupportController } from '../controllers/support.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();
const supportController = new SupportController();

router.post('/query', authenticateJWT, requireActiveSubscription, supportController.submitQuery);

export default router;

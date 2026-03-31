import { Router } from 'express';
import { BusController } from '../controllers/bus.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();
const busController = new BusController();

router.get('/', authenticateJWT, requireActiveSubscription, busController.getAll);
router.get('/number/:busNumber', authenticateJWT, requireActiveSubscription, busController.getByNumber);
router.get('/:id', authenticateJWT, requireActiveSubscription, busController.getById);
router.post('/', authenticateJWT, requireActiveSubscription, busController.create);
router.put('/:id', authenticateJWT, requireActiveSubscription, busController.update);
router.delete('/:id', authenticateJWT, requireActiveSubscription, busController.delete);

export default router;

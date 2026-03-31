import { Router } from 'express';
import { RouteController } from '../controllers/route.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();
const routeController = new RouteController();

router.get('/', authenticateJWT, requireActiveSubscription, routeController.getAll);
router.get('/stops', authenticateJWT, requireActiveSubscription, routeController.getAllStops);
router.get('/:id', authenticateJWT, requireActiveSubscription, routeController.getById);
router.post('/', authenticateJWT, requireActiveSubscription, routeController.create);
router.put('/:id', authenticateJWT, requireActiveSubscription, routeController.update);
router.delete('/:id', authenticateJWT, requireActiveSubscription, routeController.delete);

export default router;

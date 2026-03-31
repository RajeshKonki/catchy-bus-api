import { Router } from 'express';
import { DriverController } from '../controllers/driver.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();
const driverController = new DriverController();

router.get('/me/routes', authenticateJWT, requireActiveSubscription, driverController.getMyRoutes);
router.get('/', authenticateJWT, requireActiveSubscription, driverController.getAll);
router.get('/:id', authenticateJWT, requireActiveSubscription, driverController.getById);
router.post('/', authenticateJWT, requireActiveSubscription, driverController.create);
router.put('/:id', authenticateJWT, requireActiveSubscription, driverController.update);
router.delete('/:id', authenticateJWT, requireActiveSubscription, driverController.delete);
router.post('/:id/routes', authenticateJWT, requireActiveSubscription, driverController.addDriverRoute);
router.delete('/:id/routes/:routeId', authenticateJWT, requireActiveSubscription, driverController.removeDriverRoute);

export default router;

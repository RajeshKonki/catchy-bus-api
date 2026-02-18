import { Router } from 'express';
import { DriverController } from '../controllers/driver.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const driverController = new DriverController();

router.get('/', authenticateJWT, driverController.getAll);
router.post('/', authenticateJWT, driverController.create);
router.put('/:id', authenticateJWT, driverController.update);
router.delete('/:id', authenticateJWT, driverController.delete);

export default router;

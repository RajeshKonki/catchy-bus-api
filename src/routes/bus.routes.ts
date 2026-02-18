import { Router } from 'express';
import { BusController } from '../controllers/bus.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const busController = new BusController();

router.get('/', authenticateJWT, busController.getAll);
router.get('/:busNumber', authenticateJWT, busController.getByNumber);
router.post('/', authenticateJWT, busController.create);
router.put('/:id', authenticateJWT, busController.update);
router.delete('/:id', authenticateJWT, busController.delete);

export default router;

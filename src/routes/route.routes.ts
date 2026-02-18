import { Router } from 'express';
import { RouteController } from '../controllers/route.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const routeController = new RouteController();

router.get('/', authenticateJWT, routeController.getAll);
router.get('/:id', authenticateJWT, routeController.getById);
router.post('/', authenticateJWT, routeController.create);
router.put('/:id', authenticateJWT, routeController.update);
router.delete('/:id', authenticateJWT, routeController.delete);

export default router;

import { Router } from 'express';
import { CollegeController } from '../controllers/college.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const collegeController = new CollegeController();

router.get('/', authenticateJWT, collegeController.getAll);
router.get('/:id', authenticateJWT, collegeController.getById);
router.post('/', authenticateJWT, collegeController.create);
router.put('/:id', authenticateJWT, collegeController.update);
router.delete('/:id', authenticateJWT, collegeController.delete);

export default router;

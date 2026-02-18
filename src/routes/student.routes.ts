import { Router } from 'express';
import { StudentController } from '../controllers/student.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const studentController = new StudentController();

router.get('/', authenticateJWT, studentController.getAll);
router.put('/:id', authenticateJWT, studentController.update);
router.delete('/:id', authenticateJWT, studentController.delete);

export default router;

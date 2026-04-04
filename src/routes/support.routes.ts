import { Router } from 'express';
import { SupportController } from '../controllers/support.controller';
import { optionalAuthenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const supportController = new SupportController();

router.post('/query', optionalAuthenticateJWT, supportController.submitQuery);

export default router;

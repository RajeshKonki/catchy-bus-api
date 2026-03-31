import { Router } from 'express';
import multer from 'multer';
import { BulkController } from '../controllers/bulk.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();
const bulkController = new BulkController();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/export/:module', authenticateJWT, requireActiveSubscription, bulkController.export);
router.post('/import/:module', authenticateJWT, requireActiveSubscription, upload.single('file'), bulkController.import);
router.get('/sample/:module', authenticateJWT, requireActiveSubscription, bulkController.getSample);

export default router;

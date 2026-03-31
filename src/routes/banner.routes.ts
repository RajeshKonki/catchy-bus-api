import { Router } from 'express';
import { BannerController } from '../controllers/banner.controller';
import { authenticateJWT, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();
const bannerController = new BannerController();

// Public route for mobile app
router.get('/active', bannerController.getActiveBanners);

// Protected routes (Only super admin)
const adminRoles = ['admin', 'superadmin', 'super_admin'];

router.get('/', authenticateJWT, authorizeRoles(adminRoles), bannerController.getAllBanners);
router.get('/:id', authenticateJWT, authorizeRoles(adminRoles), bannerController.getBannerById);
router.post('/', authenticateJWT, authorizeRoles(adminRoles), bannerController.createBanner);
router.put('/:id', authenticateJWT, authorizeRoles(adminRoles), bannerController.updateBanner);
router.delete('/:id', authenticateJWT, authorizeRoles(adminRoles), bannerController.deleteBanner);

export default router;

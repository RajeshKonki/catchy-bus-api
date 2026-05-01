import { Router } from 'express';
import { BannerController } from '../controllers/banner.controller';
import { authenticateJWT, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();
const bannerController = new BannerController();

// Public route for mobile app — accepts optional ?collegeId= to scope results
router.get('/active', bannerController.getActiveBanners);

// Both super admin and college admins can manage banners
const allowedRoles = ['admin', 'superadmin', 'super_admin', 'college'];

router.get('/', authenticateJWT, authorizeRoles(allowedRoles), bannerController.getAllBanners);
router.get('/:id', authenticateJWT, authorizeRoles(allowedRoles), bannerController.getBannerById);
router.post('/', authenticateJWT, authorizeRoles(allowedRoles), bannerController.createBanner);
router.put('/:id', authenticateJWT, authorizeRoles(allowedRoles), bannerController.updateBanner);
router.delete('/:id', authenticateJWT, authorizeRoles(allowedRoles), bannerController.deleteBanner);

export default router;

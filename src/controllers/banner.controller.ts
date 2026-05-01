import { Request, Response } from 'express';
import { BannerService } from '../services/banner.service';

const bannerService = new BannerService();

export class BannerController {
    async getAllBanners(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const status = req.query.status as string;
            // College admin only sees their own banners
            const collegeId = user?.type === 'college' ? user.id : undefined;
            const result = await bannerService.getAllBanners(status, collegeId);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async getActiveBanners(req: Request, res: Response) {
        try {
            // Mobile passes collegeId as query param so students only see their college banners
            const collegeId = req.query.collegeId as string | undefined;
            const result = await bannerService.getActiveBanners(collegeId);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async getBannerById(req: Request, res: Response) {
        try {
            const result = await bannerService.getBannerById(req.params.id as string);
            if (!result) return res.status(404).json({ message: 'Banner not found' });
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async createBanner(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            // College admin creates banners scoped to their college
            const collegeId = user?.type === 'college' ? user.id : req.body.collegeId || null;
            const result = await bannerService.createBanner(req.body, collegeId);
            res.status(201).json(result);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async updateBanner(req: Request, res: Response) {
        try {
            const result = await bannerService.updateBanner(req.params.id as string, req.body);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async deleteBanner(req: Request, res: Response) {
        try {
            await bannerService.deleteBanner(req.params.id as string);
            res.status(204).send();
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
}

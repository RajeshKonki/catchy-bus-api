import { Request, Response } from 'express';
import { BannerService } from '../services/banner.service';

const bannerService = new BannerService();

export class BannerController {
    async getAllBanners(req: Request, res: Response) {
        console.log('--- FETCHING ALL BANNERS ---');
        console.log('User role from token:', (req as any).user?.role || (req as any).user?.type);
        try {
            const status = req.query.status as string;
            const result = await (bannerService as any).getAllBanners(status);
            console.log('Found banners count:', result.length);
            res.json(result);
        } catch (error: any) {
            console.error('Error fetching banners:', error);
            res.status(500).json({ message: error.message });
        }
    }

    async getActiveBanners(req: Request, res: Response) {
        console.log('--- FETCHING ACTIVE BANNERS ---');
        try {
            const result = await bannerService.getActiveBanners();
            console.log('Found active banners count:', result.length);
            res.json(result);
        } catch (error: any) {
            console.error('Error fetching active banners:', error);
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
            const result = await bannerService.createBanner(req.body);
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

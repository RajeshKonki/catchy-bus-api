import prisma from '../config/db';
import { s3Service } from './s3.service';

export class BannerService {
    // Get all banners (super admin: all, college admin: their college + global)
    async getAllBanners(status?: string, collegeId?: string) {
        const where: any = {};
        if (status) {
            where.status = status.toUpperCase();
        }
        if (collegeId) {
            // College admin sees their own banners only
            where.collegeId = collegeId;
        }

        return await prisma.banner.findMany({
            where,
            orderBy: { order: 'asc' }
        });
    }

    // Mobile: returns global banners + banners for the student's college
    async getActiveBanners(collegeId?: string) {
        console.log('[BannerService] Fetching active banners, collegeId:', collegeId);
        const where: any = { status: 'ACTIVE' };

        if (collegeId) {
            // Return banners that are global (no college) OR belong to this college
            where.OR = [
                { collegeId: null },
                { collegeId }
            ];
        }
        // If no collegeId given, return all active (fallback for super admin preview)

        const banners = await prisma.banner.findMany({
            where,
            orderBy: { order: 'asc' }
        });
        console.log(`[BannerService] Returned ${banners.length} banners.`);
        return banners;
    }

    async getBannerById(id: string) {
        return await prisma.banner.findUnique({ where: { id } });
    }

    async createBanner(data: any, collegeId?: string) {
        const cleanData = await this.sanitizeBannerData(data, collegeId);
        return await prisma.banner.create({ data: cleanData });
    }

    async updateBanner(id: string, data: any) {
        const cleanData = await this.sanitizeBannerData(data);
        return await prisma.banner.update({ where: { id }, data: cleanData });
    }

    async deleteBanner(id: string) {
        return await prisma.banner.delete({ where: { id } });
    }

    private async sanitizeBannerData(data: any, collegeId?: string) {
        const { title, link, status, order } = data;
        let imageUrl = data.imageUrl;

        if (imageUrl) {
            imageUrl = await s3Service.uploadImage(imageUrl, 'banners');
        }

        return {
            title: title || null,
            imageUrl: imageUrl,
            link: link || null,
            status: status ? status.toUpperCase() : 'ACTIVE',
            order: order ? Number(order) : 0,
            // Preserve existing collegeId if not passed (for updates)
            ...(collegeId !== undefined ? { collegeId: collegeId || null } : {})
        };
    }
}

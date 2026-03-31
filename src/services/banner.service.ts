import prisma from '../config/db';
import { s3Service } from './s3.service';

export class BannerService {
    async getAllBanners(status?: string) {
        const where: any = {};
        if (status) {
            where.status = status.toUpperCase();
        }

        return await prisma.banner.findMany({
            where,
            orderBy: {
                order: 'asc'
            }
        });
    }

    async getActiveBanners() {
        console.log('[BannerService] Fetching active banners from database...');
        const banners = await prisma.banner.findMany({
            where: {
                status: 'ACTIVE'
            },
            orderBy: {
                order: 'asc'
            }
        });
        console.log(`[BannerService] Database returned ${banners.length} banners.`);
        return banners;
    }

    async getBannerById(id: string) {
        return await prisma.banner.findUnique({
            where: { id }
        });
    }

    async createBanner(data: any) {
        const cleanData = await this.sanitizeBannerData(data);
        return await prisma.banner.create({
            data: cleanData
        });
    }

    async updateBanner(id: string, data: any) {
        const cleanData = await this.sanitizeBannerData(data);
        return await prisma.banner.update({
            where: { id },
            data: cleanData
        });
    }

    async deleteBanner(id: string) {
        return await prisma.banner.delete({
            where: { id }
        });
    }

    private async sanitizeBannerData(data: any) {
        const { title, link, status, order } = data;
        let imageUrl = data.imageUrl;

        // Upload to S3 if base64
        if (imageUrl) {
            imageUrl = await s3Service.uploadImage(imageUrl, 'banners');
        }

        return {
            title: title || null,
            imageUrl: imageUrl,
            link: link || null,
            status: status ? status.toUpperCase() : 'ACTIVE',
            order: order ? Number(order) : 0
        };
    }
}

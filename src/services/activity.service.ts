import prisma from '../config/db';

export class ActivityService {
    async logActivity(type: string, description: string, userId?: string) {
        return await prisma.activity.create({
            data: {
                type,
                description,
                userId,
                timestamp: new Date()
            }
        });
    }

    async getRecentActivities(limit: number = 10, userId?: string) {
        const where = userId ? { userId } : {};
        return await prisma.activity.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: limit
        });
    }
}

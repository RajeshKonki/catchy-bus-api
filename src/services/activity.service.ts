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

    async getRecentActivities(limit: number = 10) {
        return await prisma.activity.findMany({
            orderBy: { timestamp: 'desc' },
            take: limit
        });
    }
}

import prisma from '../config/db';

export class TrackingService {
    // Simple in-memory or DB-backed location storage
    // For production, Redis is often used for real-time location

    async updateLocation(busId: string, lat: number, lng: number) {
        // We could store the history in an 'Activity' or a dedicated 'LocationHistory' table
        // For now, let's just log it as an activity or update a 'currentLocation' field if it existed
        return await prisma.activity.create({
            data: {
                type: 'location_update',
                description: `Bus ${busId} updated location to ${lat}, ${lng}`,
                timestamp: new Date()
            }
        });
    }

    async getActiveBuses() {
        // Get buses that have updated their location recently (e.g., in the last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return await prisma.activity.findMany({
            where: {
                type: 'location_update',
                timestamp: { gte: fiveMinutesAgo }
            },
            distinct: ['userId'], // assuming userId or a detail field holds busId
            orderBy: { timestamp: 'desc' }
        });
    }
}

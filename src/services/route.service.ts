import prisma from '../config/db';

export class RouteService {
    async getAllRoutes(collegeId?: string, search?: string) {
        const where: any = {};
        if (collegeId) {
            where.collegeId = collegeId;
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { startPoint: { contains: search, mode: 'insensitive' } },
                { endPoint: { contains: search, mode: 'insensitive' } }
            ];
        }
        return await prisma.route.findMany({
            where,
            include: { college: true },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getRouteById(id: string) {
        return await prisma.route.findUnique({
            where: { id },
            include: { buses: true }
        });
    }

    async createRoute(data: any) {
        const cleanData = this.sanitizeRouteData(data);
        return await prisma.route.create({ data: cleanData });
    }

    async updateRoute(id: string, data: any) {
        const cleanData = this.sanitizeRouteData(data);
        return await prisma.route.update({
            where: { id },
            data: cleanData
        });
    }

    private sanitizeRouteData(data: any) {
        const {
            name, startPoint, startAddress, startLat, startLng,
            endPoint, endAddress, endLat, endLng,
            distance, duration, stops, status, collegeId, startTime, endTime,
            reverseStartTime, reverseEndTime
        } = data;

        return {
            name, startPoint, startAddress, startLat, startLng,
            endPoint, endAddress, endLat, endLng,
            distance, duration, stops, status, collegeId, startTime, endTime,
            reverseStartTime, reverseEndTime
        };
    }

    async deleteRoute(id: string) {
        return await prisma.$transaction(async (tx) => {
            // 1. Unlink route from buses
            await tx.bus.updateMany({
                where: { routeId: id },
                data: { routeId: null }
            });

            // 2. Unlink route from trips
            await tx.trip.updateMany({
                where: { routeId: id },
                data: { routeId: null }
            });

            // 3. Delete driverRoutes pointing to this route
            await tx.driverRoute.deleteMany({
                where: { routeId: id }
            });

            // 4. Delete busRoutes pointing to this route
            await tx.busRoute.deleteMany({
                where: { routeId: id }
            });

            // 5. Delete the route itself
            return await tx.route.delete({
                where: { id }
            });
        });
    }

    async getUniqueStopsByCollege(collegeId: string) {
        // Get the college location first to include as 'College Campus'
        const college = await prisma.college.findUnique({
            where: { id: collegeId },
            select: { name: true, lat: true, lng: true }
        });

        // Get all routes for this college
        const routes = await prisma.route.findMany({
            where: { collegeId, status: 'ACTIVE' },
            select: { stops: true }
        });

        const stopMap = new Map<string, any>();

        // Add college location as a default stop
        if (college) {
            stopMap.set(college.name, {
                name: college.name,
                latitude: college.lat,
                longitude: college.lng,
                type: 'college'
            });
        }

        // Process all stops from all routes
        for (const route of routes) {
            const stops = route.stops as any[];
            if (stops && Array.isArray(stops)) {
                for (const stop of stops) {
                    if (stop.name && !stopMap.has(stop.name)) {
                        stopMap.set(stop.name, {
                            name: stop.name,
                            latitude: stop.latitude || stop.lat,
                            longitude: stop.longitude || stop.lng,
                            type: stop.type || 'stop'
                        });
                    }
                }
            }
        }

        return Array.from(stopMap.values());
    }
}

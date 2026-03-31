import prisma from '../config/db';

export class BusService {
    async getAllBuses(status?: string, collegeId?: string, search?: string) {
        const where: any = {};
        if (status) {
            where.status = status.toUpperCase();
        }
        if (collegeId) {
            where.collegeId = collegeId;
        }
        if (search) {
            where.OR = [
                { busNumber: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }

        return await prisma.bus.findMany({
            where,
            include: {
                college: true,
                route: true,
                driver: true,
                busRoutes: {
                    include: {
                        route: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getBusByNumber(busNumber: string) {
        const bus = await prisma.bus.findUnique({
            where: { busNumber },
            include: {
                college: true,
                route: true,
                driver: true,
                students: true,
                busRoutes: {
                    include: {
                        route: true
                    }
                },
                trips: {
                    where: {
                        status: 'STARTED',
                        startTime: {
                            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                        }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        }) as any;

        if (!bus) return null;

        // Derive currentLocation and nextStop from active trip
        if (bus.trips && bus.trips.length > 0) {
            const trip = bus.trips[0];
            const passedStops = (trip.passedStops as any[]) || [];
            
            if (passedStops.length > 0) {
                const lastStop = passedStops[passedStops.length - 1];
                bus.currentLocation = lastStop.name;
                
                // Find next stop if route exists
                if (bus.route && Array.isArray(bus.route.stops)) {
                    const stops = bus.route.stops as any[];
                    const lastIndex = stops.findIndex(s => 
                        (typeof s === 'string' ? s : s.name) === lastStop.name
                    );
                    
                    if (lastIndex !== -1 && lastIndex < stops.length - 1) {
                        const next = stops[lastIndex + 1];
                        bus.nextStop = typeof next === 'string' ? next : next.name;
                    } else if (lastIndex === -1 && stops.length > 0) {
                        // If not found in stops, maybe it was the start point
                        if (lastStop.name === bus.route.startPoint) {
                            const firstStop = stops[0];
                            bus.nextStop = typeof firstStop === 'string' ? firstStop : firstStop.name;
                        } else {
                            bus.nextStop = bus.route.endPoint;
                        }
                    } else {
                        bus.nextStop = 'Terminus Reached';
                    }
                }
            } else {
                bus.currentLocation = bus.route?.startPoint || 'At College';
                if (bus.route && Array.isArray(bus.route.stops) && bus.route.stops.length > 0) {
                    const first = bus.route.stops[0];
                    bus.nextStop = typeof first === 'string' ? first : first.name;
                } else {
                    bus.nextStop = bus.route?.endPoint || 'Final Stop';
                }
            }
        } else {
            bus.currentLocation = 'Inactive';
            bus.nextStop = 'Trip not started';
        }

        return bus;
    }

    async getBusById(id: string) {
        return await prisma.bus.findUnique({
            where: { id },
            include: {
                college: true,
                route: true,
                driver: true,
                students: true,
                busRoutes: {
                    include: {
                        route: true
                    }
                }
            }
        });
    }

    async createBus(data: any) {
        const cleanData = this.sanitizeBusData(data);
        const routeIds = data.routeIds || (data.routeId ? [data.routeId] : []);
        
        return await prisma.bus.create({
            data: {
                ...cleanData,
                routeId: routeIds.length > 0 ? null : cleanData.routeId, // ensure clean legacy state
                busRoutes: {
                    create: routeIds.map((rId: string) => ({
                        route: { connect: { id: rId } }
                    }))
                }
            }
        });
    }

    async updateBus(id: string, data: any) {
        const cleanData = this.sanitizeBusData(data);
        const routeIds = data.routeIds || (data.routeId ? [data.routeId] : null);
        
        // Start a transaction since we need to recreate joined records if provided
        return await prisma.$transaction(async (tx: any) => {
            const bus = await tx.bus.update({
                where: { id },
                data: {
                    ...cleanData,
                    routeId: routeIds !== null ? null : cleanData.routeId // Erase legacy routeId when using new busRoutes
                }
            });

            if (routeIds !== null) {
                // Delete existing ones
                await tx.busRoute.deleteMany({
                    where: { busId: id }
                });
                
                // Recreate them
                if (routeIds.length > 0) {
                    await tx.busRoute.createMany({
                        data: routeIds.map((rId: string) => ({
                            busId: id,
                            routeId: rId
                        }))
                    });
                }
            }
            return bus;
        });
    }

    private sanitizeBusData(data: any) {
        const { busNumber, capacity, title, description, status, collegeId, routeId } = data;
        return {
            busNumber,
            capacity: Number(capacity),
            title,
            description,
            status: status ? status.toUpperCase() : 'ACTIVE',
            collegeId,
            routeId: routeId || null
        };
    }

    async deleteBus(id: string) {
        return await prisma.bus.delete({
            where: { id }
        });
    }
}

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
                    include: {
                        route: true
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
            const activeRoute = trip.route || bus.route;
            
            if (passedStops.length > 0) {
                const lastStop = passedStops[passedStops.length - 1];
                bus.currentLocation = lastStop.name;
                
                // Find next stop if route exists
                if (activeRoute && Array.isArray(activeRoute.stops)) {
                    const stops = activeRoute.stops as any[];
                    const isReverse = trip.isReverse === true;
                    const lastIndex = stops.findIndex(s => 
                        (typeof s === 'string' ? s : s.name) === lastStop.name
                    );
                    
                    if (lastIndex !== -1) {
                        if (isReverse) {
                            if (lastIndex > 0) {
                                const next = stops[lastIndex - 1];
                                bus.nextStop = typeof next === 'string' ? next : next.name;
                            } else {
                                bus.nextStop = bus.route.startPoint || 'College Reached';
                            }
                        } else {
                            if (lastIndex < stops.length - 1) {
                                const next = stops[lastIndex + 1];
                                bus.nextStop = typeof next === 'string' ? next : next.name;
                            } else {
                                bus.nextStop = bus.route.endPoint || 'Terminus Reached';
                            }
                        }
                    } else if (lastIndex === -1 && stops.length > 0) {
                        if (isReverse) {
                            if (lastStop.name === bus.route.endPoint) {
                                const last = stops[stops.length - 1];
                                bus.nextStop = typeof last === 'string' ? last : last.name;
                            } else {
                                bus.nextStop = bus.route.startPoint;
                            }
                        } else {
                            if (lastStop.name === bus.route.startPoint) {
                                const firstStop = stops[0];
                                bus.nextStop = typeof firstStop === 'string' ? firstStop : firstStop.name;
                            } else {
                                bus.nextStop = activeRoute.endPoint;
                            }
                        }
                    } else {
                        bus.nextStop = isReverse ? 'College Reached' : 'Terminus Reached';
                    }
                }
            } else {
                const isReverse = trip.isReverse === true;
                if (isReverse) {
                    bus.currentLocation = activeRoute?.endPoint || 'At Return Start';
                    if (activeRoute && Array.isArray(activeRoute.stops) && activeRoute.stops.length > 0) {
                        const last = activeRoute.stops[activeRoute.stops.length - 1];
                        bus.nextStop = typeof last === 'string' ? last : last.name;
                    } else {
                        bus.nextStop = activeRoute?.startPoint || 'College';
                    }
                } else {
                    bus.currentLocation = activeRoute?.startPoint || 'At College';
                    if (activeRoute && Array.isArray(activeRoute.stops) && activeRoute.stops.length > 0) {
                        const first = activeRoute.stops[0];
                        bus.nextStop = typeof first === 'string' ? first : first.name;
                    } else {
                        bus.nextStop = activeRoute?.endPoint || 'Final Stop';
                    }
                }
            }
        } else {
            bus.currentLocation = 'Inactive';
            bus.nextStop = 'Trip not started';
        }

        // Add top-level flags for client convenience
        const activeTrip = bus.trips && bus.trips.length > 0 ? bus.trips[0] : null;
        bus.isTripActive = !!activeTrip;
        bus.isReverse = activeTrip ? activeTrip.isReverse === true : false;

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
        const { busNumber, capacity, title, description, status, collegeId, routeId, imageUrl } = data;
        return {
            busNumber,
            capacity: Number(capacity),
            title,
            description,
            status: status ? status.toUpperCase() : 'ACTIVE',
            collegeId,
            routeId: routeId || null,
            imageUrl: imageUrl || null
        };
    }

    async deleteBus(id: string) {
        return await prisma.bus.delete({
            where: { id }
        });
    }
}

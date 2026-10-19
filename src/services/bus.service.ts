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
                        startTime: {
                            gte: new Date(Date.now() - 12 * 60 * 60 * 1000)
                        }
                    },
                    include: {
                        route: true
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        }) as any;

        if (!bus) return null;

        const activeTrip = bus.trips ? bus.trips.find((t: any) => t.status === 'STARTED') : null;
        const latestTrip = activeTrip || (bus.trips && bus.trips.length > 0 ? bus.trips[0] : null);

        // Derive currentLocation and nextStop from active trip
        if (latestTrip && latestTrip.status === 'STARTED') {
            const trip = latestTrip;
            const passedStops = (trip.passedStops as any[]) || [];
            const activeRoute = trip.route || bus.route;
            const routeStops = (activeRoute?.stops as any[]) || [];

            let derivedLocation = 'In Transit';
            let derivedNext = 'Calculating...';

            if (passedStops.length > 0) {
                const lastStop = passedStops[passedStops.length - 1];
                derivedLocation = lastStop.name;
                
                const lastIndex = routeStops.findIndex(s => 
                    (typeof s === 'string' ? s : s.name) === lastStop.name
                );
                
                if (lastIndex !== -1) {
                    if (trip.isReverse) {
                        if (lastIndex > 0) {
                            const next = routeStops[lastIndex - 1];
                            derivedNext = typeof next === 'string' ? next : next.name;
                        } else {
                            derivedNext = activeRoute.startPoint || 'College Reached';
                        }
                    } else {
                        if (lastIndex < routeStops.length - 1) {
                            const next = routeStops[lastIndex + 1];
                            derivedNext = typeof next === 'string' ? next : next.name;
                        } else {
                            derivedNext = activeRoute.endPoint || 'Terminus Reached';
                        }
                    }
                }
            } else {
                derivedLocation = trip.isReverse
                    ? (activeRoute?.endPoint || 'Starting Point (Return)')
                    : (activeRoute?.startPoint || 'Starting Point');
                if (routeStops.length > 0) {
                    const next = trip.isReverse ? routeStops[routeStops.length - 1] : routeStops[0];
                    derivedNext = typeof next === 'string' ? next : next.name;
                }
            }

            // Proximity check if lat/lng are available
            if (bus.latitude != null && bus.longitude != null) {
                const travelStops: { name: string; lat: number; lng: number; isStartEnd: boolean }[] = [];
                if (trip.isReverse) {
                    if (activeRoute?.endPoint) {
                        travelStops.push({
                            name: activeRoute.endPoint,
                            lat: activeRoute.endLat || 0,
                            lng: activeRoute.endLng || 0,
                            isStartEnd: true
                        });
                    }
                    for (let i = routeStops.length - 1; i >= 0; i--) {
                        const s = routeStops[i];
                        travelStops.push({
                            name: typeof s === 'string' ? s : s.name,
                            lat: typeof s === 'string' ? 0 : (s.reverseLat || s.lat || s.latitude || 0),
                            lng: typeof s === 'string' ? 0 : (s.reverseLng || s.lng || s.longitude || 0),
                            isStartEnd: false
                        });
                    }
                    if (activeRoute?.startPoint) {
                        travelStops.push({
                            name: activeRoute.startPoint,
                            lat: activeRoute.startLat || 0,
                            lng: activeRoute.startLng || 0,
                            isStartEnd: true
                        });
                    }
                } else {
                    if (activeRoute?.startPoint) {
                        travelStops.push({
                            name: activeRoute.startPoint,
                            lat: activeRoute.startLat || 0,
                            lng: activeRoute.startLng || 0,
                            isStartEnd: true
                        });
                    }
                    for (const s of routeStops) {
                        travelStops.push({
                            name: typeof s === 'string' ? s : s.name,
                            lat: typeof s === 'string' ? 0 : (s.lat || s.latitude || 0),
                            lng: typeof s === 'string' ? 0 : (s.lng || s.longitude || 0),
                            isStartEnd: false
                        });
                    }
                    if (activeRoute?.endPoint) {
                        travelStops.push({
                            name: activeRoute.endPoint,
                            lat: activeRoute.endLat || 0,
                            lng: activeRoute.endLng || 0,
                            isStartEnd: true
                        });
                    }
                }

                let closestStop = null;
                let closestStopIdx = -1;
                let minDistance = Infinity;

                for (let i = 0; i < travelStops.length; i++) {
                    const stop = travelStops[i];
                    if (stop.lat && stop.lng) {
                        const distance = getDistance(bus.latitude, bus.longitude, stop.lat, stop.lng);
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestStop = stop.name;
                            closestStopIdx = i;
                        }
                    }
                }

                if (closestStopIdx !== -1) {
                    if (closestStopIdx < travelStops.length - 1) {
                        derivedNext = travelStops[closestStopIdx + 1].name;
                    } else {
                        derivedNext = trip.isReverse ? 'Depot Reached' : 'Terminus Reached';
                    }

                    if (minDistance > 3.0) {
                        derivedLocation = 'Route Diverted (Off Route)';
                    } else if (minDistance < 0.2) {
                        derivedLocation = closestStop!;
                    } else {
                        derivedLocation = `In Transit (to ${derivedNext})`;
                    }
                }
            }

            bus.currentLocation = derivedLocation;
            bus.nextStop = derivedNext;
        } else {
            bus.currentLocation = 'Inactive';
            bus.nextStop = 'Trip not started';
        }

        // Add top-level flags for client convenience
        bus.isTripActive = latestTrip ? latestTrip.status === 'STARTED' : false;
        bus.isReverse = latestTrip ? latestTrip.isReverse === true : false;

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
        return await prisma.$transaction(async (tx) => {
            // 1. Delete trips associated with this bus
            await tx.trip.deleteMany({
                where: { busId: id }
            });

            // 2. Unlink bus from drivers
            await tx.driver.updateMany({
                where: { busId: id },
                data: { busId: null }
            });

            // 3. Unlink bus from students
            await tx.student.updateMany({
                where: { busId: id },
                data: { busId: null }
            });

            // 4. Delete busRoutes pointing to this bus
            await tx.busRoute.deleteMany({
                where: { busId: id }
            });

            // 5. Delete the bus itself
            return await tx.bus.delete({
                where: { id }
            });
        });
    }
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

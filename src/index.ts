import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import { Server } from 'socket.io';
import { initializeFirebase } from './config/firebase';
import { NotificationService } from './services/notification.service';

dotenv.config();
initializeFirebase();

const app = express();
const server = http.createServer(app);
const notificationService = new NotificationService();
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5001;

// In-memory bus location cache (Will reset on server restart)
const busLocations = new Map<string, any>();
const lastDbUpdateMap = new Map<string, number>();
const sentNotifications = new Set<string>(); // Deduplication: "busId-stopName-type"

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Basic health check
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'OK', message: 'Bus Tracking API is running' });
});

// Import routes
import authRoutes from './routes/auth.routes';
import collegeRoutes from './routes/college.routes';
import busRoutes from './routes/bus.routes';
import routeRoutes from './routes/route.routes';
import driverRoutes from './routes/driver.routes';
import studentRoutes from './routes/student.routes';
import dashboardRoutes from './routes/dashboard.routes';
import bulkRoutes from './routes/bulk.routes';
import supportRoutes from './routes/support.routes';
import bannerRoutes from './routes/banner.routes';
import notificationRoutes from './routes/notification.routes';
import helpdeskRoutes from './routes/helpdesk.routes';

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/colleges', collegeRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/bulk', bulkRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/helpdesk', helpdeskRoutes);

// Socket.io logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join_bus', async (busId: string) => {
        socket.join(busId);
        console.log(`User ${socket.id} joined bus room: ${busId}`);

        // Retrieve last known location from in-memory cache
        const lastLocation = busLocations.get(busId);
        if (lastLocation) {
            // Check for active trip to send correct isTripActive status
            let isTripActive = lastLocation.isTripActive ?? false;
            let currentLocation = lastLocation.currentLocation || 'In Transit';
            let nextStop = lastLocation.nextStop || 'Calculating...';

            // If not cached, check DB quickly
            if (!lastLocation.currentLocation) {
                try {
                    const bus: any = await (prisma.bus as any).findUnique({
                        where: { busNumber: busId },
                        include: {
                            trips: {
                                where: { status: 'STARTED', startTime: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) } },
                                orderBy: { startTime: 'desc' },
                                take: 1
                            }
                        }
                    });
                    if (bus && bus.trips && bus.trips.length > 0) {
                        isTripActive = true;
                    }
                } catch (e) { }
            }

            socket.emit('bus_location_update', {
                busId,
                location: lastLocation,
                currentLocation,
                nextStop,
                isTripActive,
                isReverse: lastLocation.isReverse ?? false,
                timestamp: Date.now(),
                isLastKnown: true
            });
        } else {
            // No cached location – check DB for active trip status only
            try {
                const bus: any = await (prisma.bus as any).findUnique({
                    where: { busNumber: busId },
                    include: {
                        trips: {
                            where: { status: 'STARTED', startTime: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) } },
                            orderBy: { startTime: 'desc' },
                            take: 1
                        }
                    }
                });
                const isTripActive = !!(bus && bus.trips && bus.trips.length > 0);
                // Send trip status even without a location so student UI shows correct state
                socket.emit('trip_status_update', {
                    busId,
                    isTripActive,
                    isReverse: bus?.trips?.[0]?.isReverse ?? false,
                    status: isTripActive ? 'STARTED' : 'NOT_STARTED',
                    timestamp: Date.now()
                });
            } catch (e) { }
        }
    });

    socket.on('update_location', async (data: { busId: string, location: any }) => {
        const { busId, location } = data;
        const currentLat = location.latitude || location.lat;
        const currentLng = location.longitude || location.lng;

        // Save normalized coordinates back to cache
        const normalizedLocation = {
            ...location,
            lat: currentLat,
            lng: currentLng,
            latitude: currentLat,
            longitude: currentLng
        };
        busLocations.set(busId, normalizedLocation);

        // Throttle database update to once every 15s per bus to prevent SQL connection exhaustion
        const now = Date.now();
        const lastUpdate = lastDbUpdateMap.get(busId) || 0;
        if (now - lastUpdate >= 15000) {
            lastDbUpdateMap.set(busId, now);
            (prisma.bus as any).update({
                where: { busNumber: busId },
                data: {
                    latitude: currentLat,
                    longitude: currentLng,
                    bearing: location.bearing || 0
                }
            }).catch((dbErr: any) => {
                console.error(`Error updating coordinates in DB for bus ${busId}:`, dbErr);
            });
        }

        // Derive labels for real-time update
        let currentLocation = 'In Transit';
        let nextStop = 'Calculating...';
        let delayMinutes = 0;
        let isOnTime = true;

        try {
            const bus: any = await (prisma.bus as any).findUnique({
                where: { busNumber: busId },
                include: { route: true }
            });
            const trip: any = await (prisma as any).trip.findFirst({
                where: { busId: bus.id, status: 'STARTED' },
                include: { route: true },
                orderBy: { startTime: 'desc' },
                take: 1
            });

            if (bus && trip) {
                const activeRoute = trip.route || bus.route;
                const passedStops = (trip.passedStops as any[]) || [];
                const routeStops = (activeRoute?.stops as any[]) || [];

                // 1. Initial location based on trip status
                if (passedStops.length > 0) {
                    currentLocation = passedStops[passedStops.length - 1].name;

                    const lastIndex = routeStops.findIndex(s =>
                        (typeof s === 'string' ? s : s.name) === currentLocation
                    );
                    if (lastIndex !== -1) {
                        if (trip.isReverse) {
                            // Return trip: next stop is at a lower index
                            if (lastIndex > 0) {
                                const next = routeStops[lastIndex - 1];
                                nextStop = typeof next === 'string' ? next : next.name;
                            } else {
                                nextStop = 'Depot Reached';
                            }
                        } else {
                            // Normal trip: next stop is at a higher index
                            if (lastIndex < routeStops.length - 1) {
                                const next = routeStops[lastIndex + 1];
                                nextStop = typeof next === 'string' ? next : next.name;
                            } else {
                                nextStop = 'Terminus Reached';
                            }
                        }
                    } else {
                        nextStop = 'Calculating...';
                    }
                } else {
                    currentLocation = trip.isReverse
                        ? (activeRoute?.endPoint || 'Starting Point (Return)')
                        : (activeRoute?.startPoint || 'Starting Point');
                    if (routeStops.length > 0) {
                        const next = trip.isReverse ? routeStops[routeStops.length - 1] : routeStops[0];
                        nextStop = typeof next === 'string' ? next : next.name;
                    }
                }

                // 2. Proximity-based dynamic location updates
                // We find the closest stop to show as currentLocation in the UI
                if (currentLat && currentLng) {
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
                                lat: typeof s === 'string' ? 0 : (s.lat || s.latitude || 0),
                                lng: typeof s === 'string' ? 0 : (s.lng || s.longitude || 0),
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
                            const distance = getDistance(currentLat, currentLng, stop.lat, stop.lng);

                            if (distance < minDistance) {
                                minDistance = distance;
                                closestStop = stop.name;
                                closestStopIdx = i;
                            }

                            // --- PROXIMITY NOTIFICATION LOGIC ---
                            if (!stop.isStartEnd) {
                                // 1 KM Away Notification
                                if (distance <= 1.0 && distance > 0.5) {
                                    const key = `${busId}-${stop.name}-1KM`;
                                    if (!sentNotifications.has(key)) {
                                        sentNotifications.add(key);
                                        await notificationService.notifyBusStudents(
                                            busId,
                                            'Bus is 1 km away!',
                                            `Your bus (${busId}) is approximately 1 km away from ${stop.name}.`,
                                            { type: 'PROXIMITY_1KM', stopName: stop.name }
                                        );
                                    }
                                }

                                // Approaching Stop Notification (500m)
                                if (distance <= 0.5 && distance > 0.1) {
                                    const key = `${busId}-${stop.name}-APPROACHING`;
                                    if (!sentNotifications.has(key)) {
                                        sentNotifications.add(key);
                                        await notificationService.notifyBusStudents(
                                            busId,
                                            'Bus is approaching!',
                                            `Your bus (${busId}) is approaching the ${stop.name} stop. Please prepare to board.`,
                                            { type: 'APPROACHING', stopName: stop.name }
                                        );
                                    }
                                }
                            }
                        }
                    }

                    // Route deviation / Route changed check:
                    // If the closest stop in the route path is more than 3 km away from the current location of the active trip,
                    // we consider that the bus has deviated or changed route, and notify the students.
                    if (minDistance > 3.0 && travelStops.length > 0) {
                        const key = `${busId}-${trip.id}-DEVIATION`;
                        if (!sentNotifications.has(key)) {
                            sentNotifications.add(key);
                            await notificationService.notifyBusStudents(
                                busId,
                                '⚠️ Route Changed',
                                `Bus ${busId} is currently traveling on a different route from its scheduled path.`,
                                { type: 'ROUTE_CHANGED', tripId: trip.id }
                            );
                        }
                        isOnTime = false;
                    }

                    if (closestStopIdx !== -1) {
                        if (closestStopIdx < travelStops.length - 1) {
                            nextStop = travelStops[closestStopIdx + 1].name;
                        } else {
                            nextStop = trip.isReverse ? 'Depot Reached' : 'Terminus Reached';
                        }

                        // If very close to the stop, show stop name, otherwise show "In Transit"
                        if (minDistance > 3.0) {
                            currentLocation = 'Route Diverted (Off Route)';
                        } else if (minDistance < 0.2) {
                            currentLocation = closestStop!;
                        } else {
                            currentLocation = `In Transit (to ${nextStop})`;
                        }
                    }
                }

                // 3. Delay calculation
                if (nextStop !== 'Calculating...' && nextStop !== 'Terminus') {
                    const targetStop = routeStops.find(s => (typeof s === 'string' ? s : s.name) === nextStop);
                    if (targetStop && targetStop.expectedTime) {
                        try {
                            const expected = parseTime(targetStop.expectedTime);
                            const now = new Date();
                            const diff = Math.floor((now.getTime() - expected.getTime()) / 60000);
                            if (diff > 5) {
                                delayMinutes = diff;
                                isOnTime = false;
                            }
                        } catch (e) { }
                    }
                }

                busLocations.set(busId, {
                    ...normalizedLocation,
                    currentLocation,
                    nextStop,
                    isTripActive: true,
                    isReverse: trip.isReverse,
                });

                // Broadcast to all students in the room (include isTripActive so student UI stays in sync)
                io.to(busId).emit('bus_location_update', {
                    busId,
                    location: normalizedLocation,
                    currentLocation,
                    nextStop,
                    isOnTime,
                    delayMinutes,
                    isTripActive: true,
                    isReverse: trip.isReverse,
                    timestamp: Date.now()
                });
                console.log(`📍 Location update for ${busId}:`, normalizedLocation, `[${currentLocation} -> ${nextStop}] ${isOnTime ? 'On Time' : 'Delayed ' + delayMinutes + 'm'}`);
            }
        } catch (err) {
            console.error('Error deriving labels:', err);
        }
    });

    /** Haversine distance in metres */
    function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    socket.on('start_trip', async (payload: string | { busNumber: string; routeId?: string; driverLat?: number; driverLng?: number; isReverse?: boolean }) => {
        try {
            const busNumber = typeof payload === 'string' ? payload : payload.busNumber;
            let routeId = typeof payload === 'string' ? undefined : payload.routeId;
            if (routeId === 'null' || routeId === 'undefined' || !routeId) {
                routeId = undefined;
            }
            const driverLat = typeof payload === 'string' ? undefined : payload.driverLat;
            const driverLng = typeof payload === 'string' ? undefined : payload.driverLng;
            const isReverse = typeof payload === 'string' ? false : (payload.isReverse === true || (payload.isReverse as any) === 'true');

            const isResuming = typeof payload === 'string' ? false : (payload as any).isResuming === true;

            const bus: any = await (prisma.bus as any).findUnique({ where: { busNumber } });
            if (!bus) throw new Error('Bus not found');

            // ── Geofence check ──────────────────────────────────────────────
            // Normal trip:  driver must be within 1 km of route START point.
            // Reverse trip: driver must be within 1 km of route END point
            //               (because the return journey begins at the destination).
            if (routeId && driverLat != null && driverLng != null) {
                const route: any = await (prisma as any).route.findUnique({ where: { id: routeId } });
                if (route) {
                    const targetLat = isReverse ? route.endLat : route.startLat;
                    const targetLng = isReverse ? route.endLng : route.startLng;

                    if (targetLat && targetLng) {
                        const dist = haversineMetres(driverLat, driverLng, targetLat, targetLng);
                        if (dist > 1000) {
                            socket.emit('trip_start_error', {
                                code: isReverse ? 'TOO_FAR_FROM_END' : 'TOO_FAR_FROM_START',
                                message: `You are ${Math.round(dist)}m from the ${isReverse ? 'return start' : 'start'} point. Move within 1km to start.`,
                                distanceMetres: Math.round(dist)
                            });
                            return;
                        }
                    }
                }
            }

            // ── Check for existing active trip ────────────────────────────────
            const activeTrips = await (prisma as any).trip.findMany({
                where: { busId: bus.id, status: 'STARTED' }
            });

            if (isResuming && activeTrips.length > 0) {
                console.log(`♻️ Resuming existing trip for bus ${busNumber}.`);
                
                // Broadcast resumption to all clients so they know the trip is continuing
                io.to(busNumber).emit('trip_status_update', {
                    busId: busNumber,
                    isTripActive: true,
                    status: 'STARTED',
                    isReverse: activeTrips[0].isReverse,
                    timestamp: Date.now(),
                    type: 'trip_resumed'
                });
                return; // Stop here, do NOT create a new trip or close the existing one
            }

            // Close any existing active trips for this bus to ensure a fresh start
            // and broadcast completion updates for each of them so client UI stays in sync
            for (const activeTrip of activeTrips) {
                await (prisma as any).trip.update({
                    where: { id: activeTrip.id },
                    data: { status: 'COMPLETED', endTime: new Date() }
                });

                console.log(`🧹 Auto-completed previous active trip ${activeTrip.id} (isReverse: ${activeTrip.isReverse}) for bus ${busNumber}`);

                io.to(busNumber).emit('trip_status_update', {
                    busId: busNumber,
                    isTripActive: false,
                    status: 'COMPLETED',
                    isReverse: activeTrip.isReverse,
                    timestamp: Date.now()
                });

                // Notify students who did not have their attendance marked
                try {
                    await notificationService.notifyUnmarkedAttendance(busNumber, activeTrip.id);
                } catch (err) {
                    console.error('Error sending unmarked attendance notifications:', err);
                }
            }

            console.log(`🚀 Starting trip for bus ${busNumber}. routeId: ${routeId}, isReverse: ${isReverse}`);
            // Create a brand new trip
            let trip = await (prisma as any).trip.create({
                data: {
                    busId: bus.id,
                    routeId: routeId || null,
                    status: 'STARTED',
                    passedStops: [],
                    isReverse: isReverse,
                }
            });

            // UPDATE: Teleport bus to starting point for a clean start
            const startRoute = routeId ? await (prisma as any).route.findUnique({ where: { id: routeId } }) : bus.route;
            if (startRoute) {
                const startLat = isReverse ? startRoute.endLat : startRoute.startLat;
                const startLng = isReverse ? startRoute.endLng : startRoute.startLng;

                if (startLat && startLng) {
                    await (prisma.bus as any).update({
                        where: { id: bus.id },
                        data: { latitude: startLat, longitude: startLng }
                    });
                }
            }

            const currentStartLat = isReverse ? (startRoute as any)?.endLat : (startRoute as any)?.startLat;
            const currentStartLng = isReverse ? (startRoute as any)?.endLng : (startRoute as any)?.startLng;

            socket.emit('trip_started', {
                ...trip,
                routeId: trip.routeId,
                isReverse: trip.isReverse,
                latitude: currentStartLat ?? bus.latitude,
                longitude: currentStartLng ?? bus.longitude
            });
            console.log(`🚀 Trip started for bus ${busNumber} on route ${routeId || 'default'} [${isReverse ? 'REVERSE' : 'NORMAL'}]`);

            io.to(busNumber).emit('trip_status_update', {
                busId: busNumber,
                isTripActive: true,
                status: 'STARTED',
                routeId: trip.routeId,
                isReverse: trip.isReverse,
                timestamp: Date.now()
            });

            const tripLabel = isReverse ? 'Return Trip' : 'Trip';
            await notificationService.notifyBusStudents(
                busNumber,
                `Bus ${busNumber} ${tripLabel} Started`,
                isReverse
                    ? `The driver has started the return trip. Students will be dropped at their stops.`
                    : `The driver has started the trip. You can now track your bus location in real-time.`,
                { type: 'TRIP_STARTED', isReverse: String(isReverse) }
            );
        } catch (error: any) {
            console.error('❌ Error starting trip:', error.message);
            socket.emit('trip_start_error', { code: 'SERVER_ERROR', message: error.message });
        }
    });

    socket.on('mark_attendance', async (data: { busId: string, stopName: string, studentIds: string[] }) => {
        const { busId, stopName, studentIds } = data;
        try {
            // Find bus by busNumber first (since busId from client is actually busNumber)
            const bus: any = await (prisma.bus as any).findUnique({
                where: { busNumber: busId }
            });
            if (!bus) throw new Error('Bus not found');

            const trip: any = await (prisma as any).trip.findFirst({
                where: { busId: bus.id, status: 'STARTED' },
                orderBy: { createdAt: 'desc' },
                take: 1
            });
            if (!trip) throw new Error('No active trip found for this bus');

            await Promise.all(studentIds.map(studentId =>
                (prisma.attendance as any).create({
                    data: {
                        studentId,
                        busId: bus.id,
                        stopName,
                        status: 'PRESENT'
                    }
                })
            ));

            // Record this stop as passed in the active trip
            const passedStops = (trip.passedStops as any[]) || [];

            // Note previously boarded students to avoid duplicate notifications
            const stopIndex = passedStops.findIndex((s: any) => s.name === stopName);
            let previousStudentIds: string[] = [];

            if (stopIndex === -1) {
                passedStops.push({
                    name: stopName,
                    time: new Date().toISOString(),
                    boarded: studentIds.length,
                    studentIds: studentIds
                });
            } else {
                previousStudentIds = passedStops[stopIndex].studentIds || [];
                passedStops[stopIndex].boarded = studentIds.length;
                passedStops[stopIndex].studentIds = studentIds;
                passedStops[stopIndex].time = new Date().toISOString();
            }

            await (prisma as any).trip.update({
                where: { id: trip.id },
                data: { passedStops }
            });

            console.log(`✅ Attendance marked for ${studentIds.length} students at ${stopName} (Bus: ${busId})`);
            socket.emit('attendance_success', { stopName, count: studentIds.length });
            
            // Broadcast room-wide stop reached event so all student clients sync immediately
            io.to(busId).emit('trip_status_update', {
                type: 'stop_reached',
                busNumber: busId,
                stopName,
                timestamp: Date.now()
            });

            // 1. Send PERSONAL notification ONLY to newly attended students
            const newStudentIds = studentIds.filter(id => !previousStudentIds.includes(id));

            if (newStudentIds.length > 0) {
                const attendedStudents = await (prisma.student as any).findMany({
                    where: { id: { in: newStudentIds } },
                    select: { id: true, fcmToken: true, name: true, pickupStop: true }
                });

                // Send real-time Socket.io notification for each student who is online
                for (const student of attendedStudents) {
                    io.to(busId).emit('trip_status_update', {
                        type: 'attendance_marked',
                        studentId: student.id,
                        studentName: student.name,
                        pickupStop: student.pickupStop || stopName,
                        busNumber: busId,
                        timestamp: Date.now()
                    });
                }

                const personalTokens = attendedStudents
                    .map((s: any) => s.fcmToken)
                    .filter((t: string | null): t is string => !!t);

                if (personalTokens.length > 0) {
                    await notificationService.sendPushNotification(
                        personalTokens,
                        `✅ Attendance Marked`,
                        `You have been marked present at the ${stopName} stop. Bus ${busId} is on its way!`,
                        { type: 'ATTENDANCE_MARKED', stopName, busId }
                    );
                }
            }

            // 2. Send bus-wide notification to ALL students on this bus ONLY if this is the first time the stop is reached
            if (stopIndex === -1) {
                await notificationService.notifyBusStudents(
                    busId,
                    `Bus reached ${stopName}`,
                    `Bus ${busId} has reached the ${stopName} stop.`,
                    { type: 'STOP_REACHED', stopName }
                );
            }
        } catch (error: any) {
            console.error('❌ Error marking attendance:', error.message);
            socket.emit('attendance_error', { message: 'Failed to mark attendance' });
        }
    });

    // Mark a stop as skipped
    socket.on('skip_stop', async (data: { busId: string, stopName: string, reason: string }) => {
        try {
            const { busId, stopName, reason } = data;

            const bus: any = await (prisma.bus as any).findUnique({
                where: { busNumber: busId }
            });

            if (!bus) return;

            const trip: any = await (prisma as any).trip.findFirst({
                where: { busId: bus.id, status: 'STARTED' },
                orderBy: { createdAt: 'desc' }
            });

            if (!trip) return;

            let passedStops = (trip.passedStops as any[]) || [];
            const stopIndex = passedStops.findIndex(s => s.name === stopName);

            if (stopIndex === -1) {
                passedStops.push({
                    name: stopName,
                    time: new Date().toISOString(),
                    boarded: 0,
                    isSkipped: true,
                    skipReason: reason
                });
            } else {
                passedStops[stopIndex].isSkipped = true;
                passedStops[stopIndex].skipReason = reason;
                passedStops[stopIndex].boarded = 0;
                passedStops[stopIndex].time = new Date().toISOString();
            }

            await (prisma as any).trip.update({
                where: { id: trip.id },
                data: { passedStops }
            });

            // Broadcast the skip update to the bus room
            io.to(busId).emit('stop_skipped', { busId, stopName, reason });
            socket.emit('stop_skipped', { stopName });

            // Send push and database notifications to the students on this bus
            await notificationService.notifyBusStudents(
                busId,
                '⚠️ Stop Skipped',
                `Bus ${busId} has skipped the ${stopName} stop.${reason ? ` Reason: ${reason}` : ''}`,
                { type: 'STOP_SKIPPED', stopName, reason }
            );
        } catch (error) {
            console.error('Error skipping stop:', error);
        }
    });

    socket.on('end_trip', async (payload: string | { busNumber: string; driverLat?: number; driverLng?: number }) => {
        try {
            const busNumber = typeof payload === 'string' ? payload : payload.busNumber;
            const driverLat = typeof payload === 'string' ? undefined : payload.driverLat;
            const driverLng = typeof payload === 'string' ? undefined : payload.driverLng;

            const bus: any = await (prisma.bus as any).findUnique({ where: { busNumber } });
            if (!bus) throw new Error('Bus not found');

            const trip: any = await (prisma as any).trip.findFirst({
                where: { busId: bus.id, status: 'STARTED' },
                orderBy: { createdAt: 'desc' },
                take: 1
            });

            if (trip) {
                // ── Geofence: driver must be within 1 km of route end point ──
                if (trip.routeId && driverLat != null && driverLng != null) {
                    const route: any = await (prisma as any).route.findUnique({ where: { id: trip.routeId } });
                    if (route) {
                        // If it's a return trip, the end point is the route's START point
                        const targetLat = trip.isReverse ? route.startLat : route.endLat;
                        const targetLng = trip.isReverse ? route.startLng : route.endLng;

                        if (targetLat && targetLng) {
                            const dist = haversineMetres(driverLat, driverLng, targetLat, targetLng);
                            if (dist > 1000) {
                                socket.emit('trip_end_error', {
                                    code: 'TOO_FAR_FROM_END',
                                    message: `You are ${Math.round(dist)}m from the ${trip.isReverse ? 'destination (route start)' : 'destination'}. Move within 1km to end.`,
                                    distanceMetres: Math.round(dist)
                                });
                                return;
                            }
                        }
                    }
                }

                await (prisma as any).trip.update({
                    where: { id: trip.id },
                    data: { status: 'COMPLETED', endTime: new Date() }
                });
                console.log(`🏁 Trip completed for bus ${busNumber}`);
                
                // Clear active status from cache so new connections don't get a stale active state
                const cachedLoc = busLocations.get(busNumber);
                if (cachedLoc) {
                    busLocations.set(busNumber, { ...cachedLoc, isTripActive: false });
                }

                socket.emit('trip_ended');

                io.to(busNumber).emit('trip_status_update', {
                    busId: busNumber,
                    isTripActive: false,
                    status: 'COMPLETED',
                    isReverse: trip.isReverse,
                    timestamp: Date.now()
                });

                await notificationService.notifyBusStudents(
                    busNumber,
                    `Trip Completed`,
                    `Bus ${busNumber} has reached its destination and completed the trip.`,
                    { type: 'TRIP_COMPLETED' }
                );

                // Notify students who did not have their attendance marked
                try {
                    await notificationService.notifyUnmarkedAttendance(busNumber, trip.id);
                } catch (err) {
                    console.error('Error sending unmarked attendance notifications:', err);
                }
            }
        } catch (error: any) {
            console.error('❌ Error ending trip:', error.message);
            socket.emit('trip_end_error', { code: 'SERVER_ERROR', message: error.message });
        }
    });

    socket.on('cancel_trip', async (data: { busNumber: string, reason: string }) => {
        try {
            const bus: any = await (prisma.bus as any).findUnique({
                where: { busNumber: data.busNumber }
            });
            if (!bus) throw new Error('Bus not found');

            const lastActiveTrip: any = await (prisma as any).trip.findFirst({
                where: { busId: bus.id, status: 'STARTED' },
                orderBy: { createdAt: 'desc' }
            });

            const updateResult: any = await (prisma as any).trip.updateMany({
                where: { busId: bus.id, status: 'STARTED' },
                data: { status: 'CANCELLED', endTime: new Date() }
            });

            if (updateResult.count > 0) {
                console.log(`🛑 Trip cancelled for bus ${data.busNumber}: ${data.reason}`);
                
                // Clear active status from cache so new connections don't get a stale active state
                const cachedLoc = busLocations.get(data.busNumber);
                if (cachedLoc) {
                    busLocations.set(data.busNumber, { ...cachedLoc, isTripActive: false });
                }

                socket.emit('trip_cancelled');

                // Broadcast trip cancelled to ALL students watching this bus room
                io.to(data.busNumber).emit('trip_status_update', {
                    busId: data.busNumber,
                    isTripActive: false,
                    status: 'CANCELLED',
                    isReverse: lastActiveTrip ? lastActiveTrip.isReverse : false,
                    reason: data.reason,
                    timestamp: Date.now()
                });

                // Send push notification
                await notificationService.notifyBusStudents(
                    data.busNumber,
                    `Trip Cancelled`,
                    `The trip for bus ${data.busNumber} has been cancelled. Reason: ${data.reason}`,
                    { type: 'TRIP_CANCELLED', reason: data.reason }
                );
            }
        } catch (error: any) {
            console.error('❌ Error cancelling trip:', error.message);
        }
    });

    socket.on('get_all_students_for_bus', async (busNumber: string) => {
        try {
            const bus = await prisma.bus.findUnique({ where: { busNumber } });
            if (!bus) {
                socket.emit('all_students_list', { busNumber, students: [] });
                return;
            }
            const students = await prisma.student.findMany({
                where: { busId: bus.id }
            });
            socket.emit('all_students_list', { busNumber, students });
        } catch (error: any) {
            console.error('❌ Error getting all students for bus:', error.message);
        }
    });

    socket.on('get_students_by_stop', async (data: { busNumber: string, stopName: string }) => {
        const { busNumber, stopName } = data;
        console.log(`🔍 Getting students for stop: "${stopName}" on bus: "${busNumber}"`);
        try {
            const bus = await prisma.bus.findUnique({ where: { busNumber: busNumber } });
            if (!bus) {
                console.log(`⚠️ Bus "${busNumber}" not found in database!`);
                socket.emit('students_list', { stopName, students: [] });
                return;
            }

            // Determine if the active trip is a reverse trip so the client
            // can show the correct UI label ("Drop-off" vs "Board").
            const activeTrip: any = await (prisma as any).trip.findFirst({
                where: { busId: bus.id, status: 'STARTED' },
                orderBy: { createdAt: 'desc' },
                take: 1,
            });
            const isReverse: boolean = activeTrip?.isReverse ?? false;

            // In both normal and reverse trips, students are matched by pickupStop —
            // it is their home stop. On a normal trip the bus picks them up there;
            // on a reverse/return trip the bus drops them off there.
            const students = await prisma.student.findMany({
                where: {
                    busId: bus.id,
                    pickupStop: {
                        contains: stopName,
                        mode: 'insensitive'
                    }
                }
            });
            console.log(`✅ Found ${students.length} students for stop: "${stopName}" on bus: ${busNumber} [${isReverse ? 'DROP-OFF' : 'PICK-UP'}]`);
            if (students.length > 0) {
                console.log(`📋 Students: ${students.map((s: any) => s.name).join(', ')}`);
            }
            // Pass isReverse to the client so it can label the list correctly
            socket.emit('students_list', { stopName, students, isReverse });
        } catch (error: any) {
            console.error('❌ Error getting students by stop:', error.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT} (0.0.0.0)`);
});

function parseTime(timeStr: string): Date {
    const parts = timeStr.trim().split(' ');
    const timeParts = parts[0].split(':');
    let hour = parseInt(timeParts[0]);
    const minute = parseInt(timeParts[1]);

    if (parts.length > 1) {
        if (parts[1].toUpperCase() === 'PM' && hour < 12) hour += 12;
        if (parts[1].toUpperCase() === 'AM' && hour === 12) hour = 0;
    }

    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
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

export { prisma };
// Triggering server reload to refresh Prisma Client cache...

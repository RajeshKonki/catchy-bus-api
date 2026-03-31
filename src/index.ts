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
                                where: { status: 'STARTED', startTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
                                orderBy: { startTime: 'desc' },
                                take: 1
                            }
                        }
                    });
                    if (bus && bus.trips && bus.trips.length > 0) {
                        isTripActive = true;
                    }
                } catch (e) {}
            }

            socket.emit('bus_location_update', {
                busId,
                location: lastLocation,
                currentLocation,
                nextStop,
                isTripActive,
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
                            where: { status: 'STARTED', startTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
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
                    status: isTripActive ? 'STARTED' : 'NOT_STARTED',
                    timestamp: Date.now()
                });
            } catch (e) {}
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
                orderBy: { startTime: 'desc' },
                take: 1
            });

            if (bus && trip) {
                const passedStops = (trip.passedStops as any[]) || [];
                const routeStops = (bus.route?.stops as any[]) || [];
                
                // 1. Initial location based on trip status
                if (passedStops.length > 0) {
                    currentLocation = passedStops[passedStops.length - 1].name;
                    
                    const lastIndex = routeStops.findIndex(s => 
                        (typeof s === 'string' ? s : s.name) === currentLocation
                    );
                    if (lastIndex !== -1 && lastIndex < routeStops.length - 1) {
                        const next = routeStops[lastIndex + 1];
                        nextStop = typeof next === 'string' ? next : next.name;
                    } else {
                        nextStop = 'Terminus Reached';
                    }
                } else {
                    currentLocation = bus.route?.startPoint || 'Starting Point';
                    if (routeStops.length > 0) {
                        const first = routeStops[0];
                        nextStop = typeof first === 'string' ? first : first.name;
                    }
                }

                // 2. Proximity-based dynamic location updates
                // We find the closest stop to show as currentLocation in the UI
                if (currentLat && currentLng) {
                    let closestStop = null;
                    let minDistance = Infinity; 

                    for (const stop of routeStops) {
                        const stopName = typeof stop === 'string' ? stop : stop.name;
                        const stopLat = typeof stop === 'string' ? 0 : (stop.lat || stop.latitude);
                        const stopLng = typeof stop === 'string' ? 0 : (stop.lng || stop.longitude);

                        if (stopLat && stopLng) {
                            const distance = getDistance(currentLat, currentLng, stopLat, stopLng);
                            
                            if (distance < minDistance) {
                                minDistance = distance;
                                closestStop = stopName;
                            }

                            // --- PROXIMITY NOTIFICATION LOGIC ---
                            // 1 KM Away Notification
                            if (distance <= 1.0 && distance > 0.5) {
                                const key = `${busId}-${stopName}-1KM`;
                                if (!sentNotifications.has(key)) {
                                    sentNotifications.add(key);
                                    await notificationService.notifyBusStudents(
                                        busId,
                                        'Bus is 1 km away!',
                                        `Your bus (${busId}) is approximately 1 km away from ${stopName}.`,
                                        { type: 'PROXIMITY_1KM', stopName }
                                    );
                                }
                            }

                            // Approaching Stop Notification (500m)
                            if (distance <= 0.5 && distance > 0.1) {
                                const key = `${busId}-${stopName}-APPROACHING`;
                                if (!sentNotifications.has(key)) {
                                    sentNotifications.add(key);
                                    await notificationService.notifyBusStudents(
                                        busId,
                                        'Bus is approaching!',
                                        `Your bus (${busId}) is approaching the ${stopName} stop. Please prepare to board.`,
                                        { type: 'APPROACHING', stopName }
                                    );
                                }
                            }
                        }
                    }

                    if (closestStop) {
                        const idx = routeStops.findIndex(s => (typeof s === 'string' ? s : s.name) === closestStop);
                        if (idx !== -1 && idx < routeStops.length - 1) {
                            const next = routeStops[idx + 1];
                            nextStop = typeof next === 'string' ? next : next.name;
                        } else if (idx === routeStops.length - 1) {
                            nextStop = 'Terminus';
                        }
                        
                        if (minDistance < 0.2) {
                            currentLocation = closestStop;
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
                        } catch (e) {}
                    }
                }

                busLocations.set(busId, {
                    ...normalizedLocation,
                    currentLocation,
                    nextStop,
                    isTripActive: true,
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
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    socket.on('start_trip', async (payload: string | { busNumber: string; routeId?: string; driverLat?: number; driverLng?: number }) => {
        try {
            const busNumber  = typeof payload === 'string' ? payload : payload.busNumber;
            const routeId    = typeof payload === 'string' ? undefined : payload.routeId;
            const driverLat  = typeof payload === 'string' ? undefined : payload.driverLat;
            const driverLng  = typeof payload === 'string' ? undefined : payload.driverLng;

            const bus: any = await (prisma.bus as any).findUnique({ where: { busNumber } });
            if (!bus) throw new Error('Bus not found');

            // ── Geofence: driver must be within 1 km of route start ──
            if (routeId && driverLat != null && driverLng != null) {
                const route: any = await (prisma as any).route.findUnique({ where: { id: routeId } });
                if (route?.startLat && route?.startLng) {
                    const dist = haversineMetres(driverLat, driverLng, route.startLat, route.startLng);
                    if (dist > 1000) {
                        socket.emit('trip_start_error', {
                            code: 'TOO_FAR_FROM_START',
                            message: `You are ${Math.round(dist)}m from the start point. Move within 1km to start.`,
                            distanceMetres: Math.round(dist)
                        });
                        return;
                    }
                }
            }

            // Auto-close stale trips (> 12 hours old)
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
            await (prisma as any).trip.updateMany({
                where: { busId: bus.id, status: 'STARTED', startTime: { lt: twelveHoursAgo } },
                data: { status: 'COMPLETED', endTime: new Date() }
            });

            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            let trip: any = await (prisma as any).trip.findFirst({
                where: { busId: bus.id, status: 'STARTED', startTime: { gte: twentyFourHoursAgo } },
                orderBy: { startTime: 'desc' }
            });

            if (!trip) {
                trip = await (prisma as any).trip.create({
                    data: { busId: bus.id, routeId: routeId || null, status: 'STARTED', passedStops: [] }
                });
            }

            socket.emit('trip_started', { ...trip, routeId: trip.routeId });
            console.log(`🚀 Trip started for bus ${busNumber} on route ${routeId || 'default'}`);

            io.to(busNumber).emit('trip_status_update', {
                busId: busNumber, isTripActive: true, status: 'STARTED',
                routeId: trip.routeId, timestamp: Date.now()
            });

            await notificationService.notifyBusStudents(
                busNumber,
                `Bus ${busNumber} Trip Started`,
                `The driver has started the trip. You can now track your bus location in real-time.`,
                { type: 'TRIP_STARTED' }
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

            // 1. Send PERSONAL notification ONLY to newly attended students
            const newStudentIds = studentIds.filter(id => !previousStudentIds.includes(id));
            
            if (newStudentIds.length > 0) {
                const attendedStudents = await (prisma.student as any).findMany({
                    where: { id: { in: newStudentIds } },
                    select: { fcmToken: true, name: true }
                });

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

                // Broadcast the skip update to the bus room only
                io.to(busId).emit('stop_skipped', { busId, stopName });
                socket.emit('stop_skipped', { stopName });
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
                    if (route?.endLat && route?.endLng) {
                        const dist = haversineMetres(driverLat, driverLng, route.endLat, route.endLng);
                        if (dist > 1000) {
                            socket.emit('trip_end_error', {
                                code: 'TOO_FAR_FROM_END',
                                message: `You are ${Math.round(dist)}m from the destination. Move within 1km to end.`,
                                distanceMetres: Math.round(dist)
                            });
                            return;
                        }
                    }
                }

                await (prisma as any).trip.update({
                    where: { id: trip.id },
                    data: { status: 'COMPLETED', endTime: new Date() }
                });
                console.log(`🏁 Trip completed for bus ${busNumber}`);
                socket.emit('trip_ended');

                io.to(busNumber).emit('trip_status_update', {
                    busId: busNumber, isTripActive: false, status: 'COMPLETED', timestamp: Date.now()
                });

                await notificationService.notifyBusStudents(
                    busNumber,
                    `Trip Completed`,
                    `Bus ${busNumber} has reached its destination and completed the trip.`,
                    { type: 'TRIP_COMPLETED' }
                );
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

            const trip: any = await (prisma as any).trip.findFirst({
                where: { busId: bus.id, status: 'STARTED' },
                orderBy: { createdAt: 'desc' }
            });

            if (trip) {
                await (prisma as any).trip.update({
                    where: { id: trip.id },
                    data: { status: 'CANCELLED', endTime: new Date() }
                });
                console.log(`🛑 Trip cancelled for bus ${data.busNumber}: ${data.reason}`);
                socket.emit('trip_cancelled');

                // Broadcast trip cancelled to ALL students watching this bus room
                io.to(data.busNumber).emit('trip_status_update', {
                    busId: data.busNumber,
                    isTripActive: false,
                    status: 'CANCELLED',
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
            // First check if the bus exists
            const bus = await prisma.bus.findUnique({ where: { busNumber: busNumber } });
            if (!bus) {
                console.log(`⚠️ Bus "${busNumber}" not found in database!`);
                socket.emit('students_list', { stopName, students: [] });
                return;
            }

            const students = await prisma.student.findMany({
                where: {
                    busId: bus.id,
                    pickupStop: {
                        contains: stopName,
                        mode: 'insensitive'
                    }
                }
            });
            console.log(`✅ Found ${students.length} students for stop: "${stopName}" on bus: ${busNumber}`);
            if (students.length > 0) {
                console.log(`📋 Students: ${students.map(s => s.name).join(', ')}`);
            }
            socket.emit('students_list', { stopName, students });
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

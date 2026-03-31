import * as admin from 'firebase-admin';
import prisma from '../config/db';

export class NotificationService {
    /**
     * Send push notification to a list of FCM tokens
     */
    async sendPushNotification(tokens: string[], title: string, body: string, data?: Record<string, any>) {
        if (!tokens || tokens.length === 0) return;

        // FCM data payload requires all values to be strings
        const stringData: Record<string, string> = {};
        if (data) {
            Object.keys(data).forEach(key => {
                stringData[key] = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
            });
        }

        const message: admin.messaging.MulticastMessage = {
            tokens: tokens.filter(t => t && t.length > 0),
            notification: {
                title,
                body,
            },
            data: stringData,
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'bus_updates'
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default'
                    }
                }
            }
        };

        try {
            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`[Notification] Sent ${response.successCount}/${tokens.length} push messages; ${response.failureCount} failed.`);
            
            if (response.failureCount > 0) {
                response.responses.forEach((resp: any, idx: number) => {
                    if (!resp.success) {
                        console.error(`[Notification] Failed token [${idx}]: ${resp.error?.message}`);
                    }
                });
            }
        } catch (error) {
            console.error('[Notification] Error sending push notification:', error);
        }
    }

    /**
     * Send notification to all students assigned to a specific bus
     * Stores in DB and sends push notification
     */
    async notifyBusStudents(busIdentifier: string, title: string, body: string, actionData?: any) {
        try {
            // Try to find by busNumber first, then by ID as fallback
            let bus = await (prisma as any).bus.findUnique({
                where: { busNumber: busIdentifier },
                include: { students: true }
            });

            if (!bus) {
                bus = await (prisma as any).bus.findUnique({
                    where: { id: busIdentifier },
                    include: { students: true }
                });
            }

            if (!bus || !bus.students || bus.students.length === 0) {
                console.log(`[Notification] No target students found for bus: ${busIdentifier}`);
                return;
            }

            // Filter students by their notification settings
            const targetStudents = bus.students.filter((student: any) => {
                const settings = student.notificationSettings as any || {};
                
                // Identify the type of notification
                const type = actionData?.type || '';
                
                if (type.includes('PROXIMITY')) {
                    return settings.proximity !== false; // Default to true
                }
                
                if (type.includes('TRIP_STARTED')) {
                    return settings.tripStarted !== false; // Default to true
                }
                
                if (type.includes('DELAY')) {
                    return settings.delay !== false; // Default to true
                }

                // Default allow for other types (e.g. general updates)
                return true;
            });

            if (targetStudents.length === 0) {
                console.log(`[Notification] All ${bus.students.length} students have disabled this type of alert: ${actionData?.type}`);
                return;
            }

            // 1. Store in DB for each student in parallel
            await (prisma as any).notification.createMany({
                data: targetStudents.map((student: any) => ({
                    title,
                    body,
                    studentId: student.id,
                    phoneNumber: student.phone, // Store phone number for filtering
                    data: { busNumber: busIdentifier, ...actionData }
                }))
            });

            // 2. Send push notifications
            const tokens = targetStudents
                .map((s: any) => s.fcmToken)
                .filter((t: string | null): t is string => !!t);

            if (tokens.length > 0) {
                await this.sendPushNotification(tokens, title, body, {
                    busNumber: busIdentifier,
                    ...actionData
                });
            }
        } catch (error) {
            console.error('[Notification] Error notifying bus students:', error);
        }
    }
}

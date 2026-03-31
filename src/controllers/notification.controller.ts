import { Request, Response } from 'express';
import prisma from '../config/db';

export class NotificationController {
    /**
     * Get all notifications for the current student
     */
    async getNotifications(req: Request, res: Response) {
        try {
            const { phoneNumber } = req.query;
            const user = (req as any).user;
            
            console.log('[NotificationController] Fetching for user:', user?.id, 'role:', user?.type, 'queryPhone:', phoneNumber);

            // Filter by phone number if provided, otherwise by student ID
            const where: any = {};
            if (phoneNumber) {
                where.phoneNumber = String(phoneNumber);
            } else if (user && user.id) {
                where.studentId = user.id;
            } else {
                console.warn('[NotificationController] Unauthorized access attempt - no valid user ID or phone number');
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

            const notifications = await prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: 50 // Limit to latest 50
            });

            return res.status(200).json({
                success: true,
                data: notifications
            });
        } catch (error) {
            console.error('[NotificationController] Error fetching notifications:', error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    /**
     * Mark a notification as read
     */
    async markAsRead(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const user = (req as any).user;

            const notification = await prisma.notification.update({
                where: { 
                    id, 
                    studentId: user.id // Ensure they own it
                },
                data: { isRead: true }
            });

            return res.status(200).json({
                success: true,
                data: notification
            });
        } catch (error) {
            console.error('[NotificationController] Error marking as read:', error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    /**
     * Mark all as read
     */
    async markAllAsRead(req: Request, res: Response) {
        try {
            const user = (req as any).user;

            await prisma.notification.updateMany({
                where: { 
                    studentId: user.id,
                    isRead: false
                },
                data: { isRead: true }
            });

            return res.status(200).json({
                success: true,
                message: 'All notifications marked as read'
            });
        } catch (error) {
            console.error('[NotificationController] Error marking all as read:', error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
}

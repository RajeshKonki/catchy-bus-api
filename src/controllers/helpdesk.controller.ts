import { Request, Response } from 'express';
import prisma from '../config/db';

export class HelpdeskController {
    /**
     * Get unread notifications/queries for the current user
     */
    async getNotifications(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            if (!user) return res.status(401).json({ message: 'Unauthorized' });

            let where: any = {
                isRead: false
            };

            if (user.type === 'admin') {
                // Superadmin sees queries where targetId is null (from colleges)
                where.targetId = null;
            } else if (user.type === 'college') {
                // College Admin sees queries for their specifically (from drivers/students)
                where.targetId = user.id;
            } else {
                return res.status(403).json({ message: 'Forbidden' });
            }

            const queries = await prisma.helpdeskQuery.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: 10
            });

            res.json(queries);
        } catch (error: any) {
            console.error('[HelpdeskController] Error:', error);
            res.status(500).json({ message: error.message });
        }
    }

    /**
     * Mark a query as read
     */
    async markAsRead(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            await prisma.helpdeskQuery.update({
                where: { id },
                data: { isRead: true }
            });

            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    /**
     * Mark all as read
     */
    async markAllAsRead(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            if (!user) return res.status(401).json({ message: 'Unauthorized' });

            const where: any = { isRead: false };
            if (user.type === 'admin') {
                where.targetId = null;
            } else if (user.type === 'college') {
                where.targetId = user.id;
            }

            await prisma.helpdeskQuery.updateMany({
                where,
                data: { isRead: true }
            });

            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
}

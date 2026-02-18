import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { ActivityService } from '../services/activity.service';

const dashboardService = new DashboardService();
const activityService = new ActivityService();

export class DashboardController {
    async getSummary(req: Request, res: Response) {
        try {
            const stats = await dashboardService.getStats();
            res.json(stats);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async getActivities(req: Request, res: Response) {
        try {
            const activities = await activityService.getRecentActivities();
            res.json(activities);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async createActivity(req: Request, res: Response) {
        try {
            const { type, description } = req.body;
            // @ts-ignore
            const userId = req.user?.id;
            const activity = await activityService.logActivity(type, description, userId);
            res.status(201).json(activity);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
}

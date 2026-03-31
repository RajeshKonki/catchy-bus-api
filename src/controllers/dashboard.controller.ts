import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { ActivityService } from '../services/activity.service';

const dashboardService = new DashboardService();
const activityService = new ActivityService();

export class DashboardController {
    async getSummary(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            console.log('--- DASHBOARD STATS REQUEST ---');
            console.log('User from token:', JSON.stringify(user));

            const collegeId = user?.type === 'college' ? user.id : undefined;
            console.log('Determined collegeId index:', collegeId);

            const stats = await dashboardService.getStats(collegeId);
            const subscriptionWarning = (req as any).subscriptionWarning;

            console.log('Computed stats:', JSON.stringify(stats));
            res.json({ ...stats, subscriptionWarning, debugCollegeId: collegeId });
        } catch (error: any) {
            console.error('Error fetching dashboard summary:', error);
            res.status(500).json({ message: error.message });
        }
    }

    async getActivities(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            console.log('--- ACTIVITIES REQUEST ---');
            console.log('User from token:', JSON.stringify(user));

            const userId = user?.type === 'college' ? user.id : undefined;
            console.log('Filtering activities by userId:', userId);

            const activities = await activityService.getRecentActivities(10, userId);
            res.json(activities);
        } catch (error: any) {
            console.error('Error fetching activities:', error);
            res.status(500).json({ message: error.message });
        }
    }

    async createActivity(req: Request, res: Response) {
        try {
            const { type, description } = req.body;
            // @ts-ignore
            const userId = req.user?.id;
            console.log('Attempting to log activity:', { type, description, userId });
            const activity = await activityService.logActivity(type, description, userId);
            console.log('Activity logged successfully:', activity);
            res.status(201).json(activity);
        } catch (error: any) {
            console.error('Error creating activity:', error);
            res.status(500).json({ message: error.message });
        }
    }
}

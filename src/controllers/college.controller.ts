import { Request, Response } from 'express';
import { CollegeService } from '../services/college.service';
import { ActivityService } from '../services/activity.service';

const collegeService = new CollegeService();
const activityService = new ActivityService();

export class CollegeController {
    async getAll(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const search = req.query['search'] as string;
            const collegeId = user?.type === 'college' ? user.id : undefined;
            const colleges = await collegeService.getAllColleges(collegeId, search);
            res.json(colleges);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async getById(req: Request, res: Response) {
        try {
            const college = await collegeService.getCollegeById(req.params.id as string);
            if (!college) return res.status(404).json({ message: 'College not found' });
            res.json(college);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async create(req: Request, res: Response) {
        try {
            const college = await collegeService.createCollege(req.body);

            // Log activity (Mirrors Firebase Cloud Function behavior)
            await activityService.logActivity(
                'add',
                `Added new college: ${college.name}`,
                (req as any).user?.id
            );

            res.status(201).json(college);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const college = await collegeService.updateCollege(req.params.id as string, req.body);
            res.json(college);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            await collegeService.deleteCollege(req.params.id as string);
            res.status(204).send();
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }
}

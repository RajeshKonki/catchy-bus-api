import { Request, Response } from 'express';
import { SupportService } from '../services/support.service';

const supportService = new SupportService();

export class SupportController {
    async submitQuery(req: Request, res: Response) {
        try {
            const { query, subject, email } = req.body;
            const user = (req as any).user;
            const userId = user?.id;
            const type = user?.type;

            if (!query) {
                return res.status(400).json({ message: 'Query content is required' });
            }

            const result = await supportService.sendSupportQuery(userId, type, query, subject, email);
            res.json(result);
        } catch (error: any) {
            console.error('Support query error:', error);
            res.status(500).json({ message: error.message || 'Internal server error' });
        }
    }
}

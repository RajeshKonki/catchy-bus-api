import { Request, Response } from 'express';
import { BulkService } from '../services/bulk.service';

const bulkService = new BulkService();

export class BulkController {
    async export(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const collegeId = user?.type === 'college' ? user.id : undefined;
            const { module } = req.params as { module: string };
            const csv = await bulkService.exportData(module, collegeId);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${module}_export.csv`);
            res.status(200).send(csv);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async import(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const collegeId = user?.type === 'college' ? user.id : undefined;
            const { module } = req.params as { module: string };
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }
            const csvContent = req.file.buffer.toString('utf-8');
            const results = await bulkService.importData(module, csvContent, collegeId);
            res.json(results);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async getSample(req: Request, res: Response) {
        try {
            const { module } = req.params as { module: string };
            const csv = bulkService.getSampleFormat(module);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${module}_sample.csv`);
            res.status(200).send(csv);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
}

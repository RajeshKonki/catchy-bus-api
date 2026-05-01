import { Request, Response } from 'express';
import { BulkService } from '../services/bulk.service';
import * as XLSX from 'xlsx';

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

            const filename = (req.file.originalname ?? '').toLowerCase();
            const mimetype = req.file.mimetype ?? '';
            const isXlsx =
                mimetype.includes('spreadsheetml') ||
                mimetype.includes('excel') ||
                filename.endsWith('.xlsx') ||
                filename.endsWith('.xls');

            let csvContent: string;

            if (isXlsx) {
                // Parse the Excel buffer and convert the first sheet to CSV
                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const firstSheetName = workbook.SheetNames[0];
                if (!firstSheetName) {
                    return res.status(400).json({ message: 'Excel file has no sheets' });
                }
                const sheet = workbook.Sheets[firstSheetName];
                csvContent = XLSX.utils.sheet_to_csv(sheet, { forceQuotes: false });
            } else {
                // Treat as plain CSV (UTF-8)
                csvContent = req.file.buffer.toString('utf-8');
            }

            const results = await bulkService.importData(module, csvContent, collegeId);
            res.json(results);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async getSample(req: Request, res: Response) {
        try {
            const { module } = req.params as { module: string };
            const csv = await bulkService.getSampleFormat(module);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${module}_sample.csv`);
            res.status(200).send(csv);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
}

import { Request, Response } from 'express';
import { DriverService } from '../services/driver.service';
import { ActivityService } from '../services/activity.service';
import { PrismaClient } from '@prisma/client';

const driverService = new DriverService();
const activityService = new ActivityService();
const prisma = new PrismaClient();

export class DriverController {
    async getAll(req: Request, res: Response) {
        try {
            const drivers = await driverService.getAllDrivers();
            res.json(drivers);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async create(req: Request, res: Response) {
        try {
            const driver = await driverService.createDriver(req.body);

            // Log activity
            await activityService.logActivity(
                'add',
                `Registered new driver: ${driver.name}`,
                (req as any).user?.id
            );

            res.status(201).json(driver);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const driver = await driverService.updateDriver(req.params.id as string, req.body);
            res.json(driver);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const driver = await prisma.driver.findUnique({ where: { id: req.params.id } });
            await driverService.deleteDriver(req.params.id as string);

            // Log activity
            await activityService.logActivity(
                'delete',
                `Deleted driver: ${driver?.name || 'Unknown'}`,
                (req as any).user?.id
            );

            res.status(204).send();
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }
}

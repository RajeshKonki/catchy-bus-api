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
            const user = (req as any).user;
            const search = req.query['search'] as string;
            const collegeId = user?.type === 'college' ? user.id : undefined;
            const drivers = await driverService.getAllDrivers(collegeId, search);
            res.json(drivers);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async getById(req: Request, res: Response) {
        try {
            const driver = await driverService.getDriverById(req.params.id as string);
            if (!driver) return res.status(404).json({ message: 'Driver not found' });
            res.json(driver);
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
            const driver = await prisma.driver.findUnique({ where: { id: req.params.id as string } });
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

    /** GET /api/drivers/me/routes — routes assigned to the calling driver or their bus */
    async getMyRoutes(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            
            // 1. Get explicitly assigned driver routes
            const driverRoutes = await (prisma as any).driverRoute.findMany({
                where: { driverId: user.id },
                include: { route: true }
            });
            let routes = driverRoutes.map((dr: any) => dr.route).filter(Boolean);
            
            // 2. Get implicitly assigned routes attached to the driver's bus
            const driver = await (prisma as any).driver.findUnique({
                where: { id: user.id },
                include: { 
                    bus: { 
                        include: { 
                            busRoutes: { include: { route: true } }, 
                            route: true 
                        } 
                    } 
                }
            });
            
            if (driver?.bus) {
                if (driver.bus.busRoutes && driver.bus.busRoutes.length > 0) {
                    routes.push(...driver.bus.busRoutes.map((br: any) => br.route).filter(Boolean));
                }
                if (driver.bus.route) {
                    routes.push(driver.bus.route);
                }
            }
            
            // Remove duplicates by route id
            const uniqueRoutes = Array.from(new Map(routes.map((r: any) => [r.id, r])).values());
            
            res.json(uniqueRoutes);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
    async addDriverRoute(req: Request, res: Response) {
        try {
            const { routeId } = req.body;
            const record = await (prisma as any).driverRoute.upsert({
                where: { driverId_routeId: { driverId: req.params.id, routeId } },
                create: { driverId: req.params.id, routeId },
                update: {}
            });
            res.status(201).json(record);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    /** DELETE /api/drivers/:id/routes/:routeId — unassign a route from a driver */
    async removeDriverRoute(req: Request, res: Response) {
        try {
            await (prisma as any).driverRoute.delete({
                where: { driverId_routeId: { driverId: req.params.id, routeId: req.params.routeId } }
            });
            res.status(204).send();
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }
}

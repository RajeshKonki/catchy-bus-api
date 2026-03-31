import { Request, Response } from 'express';
import { RouteService } from '../services/route.service';
import prisma from '../config/db';

const routeService = new RouteService();

export class RouteController {
    async getAll(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const search = req.query['search'] as string;
            let collegeId = user?.collegeId || (user?.type === 'college' ? user.id : undefined);
            
            if (!collegeId && user?.id) {
                if (user.type === 'student' || user.type === 'parent') {
                    const student = await prisma.student.findUnique({ where: { id: user.id } });
                    collegeId = student?.collegeId;
                } else if (user.type === 'driver') {
                    const driver = await prisma.driver.findUnique({ where: { id: user.id } });
                    collegeId = driver?.collegeId;
                }
            }
            
            const routes = await routeService.getAllRoutes(collegeId, search);
            res.json(routes);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async getById(req: Request, res: Response) {
        try {
            const route = await routeService.getRouteById(req.params.id as string);
            if (!route) return res.status(404).json({ message: 'Route not found' });
            res.json(route);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async create(req: Request, res: Response) {
        try {
            const route = await routeService.createRoute(req.body);
            res.status(201).json(route);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const route = await routeService.updateRoute(req.params.id as string, req.body);
            res.json(route);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            await routeService.deleteRoute(req.params.id as string);
            res.status(204).send();
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async getAllStops(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            let collegeId = user?.collegeId || (user?.type === 'college' ? user.id : undefined);
            
            if (!collegeId && user?.id) {
                if (user.type === 'student' || user.type === 'parent') {
                    const student = await prisma.student.findUnique({ where: { id: user.id } });
                    collegeId = student?.collegeId;
                } else if (user.type === 'driver') {
                    const driver = await prisma.driver.findUnique({ where: { id: user.id } });
                    collegeId = driver?.collegeId;
                }
            }

            if (!collegeId) {
                return res.status(400).json({ message: 'College ID is required' });
            }

            const stops = await routeService.getUniqueStopsByCollege(collegeId);
            res.json(stops);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
}

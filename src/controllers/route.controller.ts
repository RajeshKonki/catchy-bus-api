import { Request, Response } from 'express';
import { RouteService } from '../services/route.service';

const routeService = new RouteService();

export class RouteController {
    async getAll(req: Request, res: Response) {
        try {
            const routes = await routeService.getAllRoutes();
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
}

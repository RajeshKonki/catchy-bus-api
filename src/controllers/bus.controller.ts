import { Request, Response } from 'express';
import { BusService } from '../services/bus.service';
import prisma from '../config/db';

const busService = new BusService();

export class BusController {
    async getAll(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const search = req.query['search'] as string;
            const status = req.query['status'] as string;
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
            
            const buses = await busService.getAllBuses(status, collegeId, search);
            res.json(buses);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async getByNumber(req: Request, res: Response) {
        try {
            const bus = await busService.getBusByNumber(req.params.busNumber as string);
            if (!bus) return res.status(404).json({ message: 'Bus not found' });
            res.json(bus);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async getById(req: Request, res: Response) {
        try {
            const bus = await busService.getBusById(req.params.id as string);
            if (!bus) return res.status(404).json({ message: 'Bus not found' });
            res.json(bus);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async create(req: Request, res: Response) {
        try {
            const bus = await busService.createBus(req.body);
            res.status(201).json(bus);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const bus = await busService.updateBus(id, req.body);
            res.json(bus);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            await busService.deleteBus(id);
            res.status(204).send();
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }
}

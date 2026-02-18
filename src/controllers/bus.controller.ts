import { Request, Response } from 'express';
import { BusService } from '../services/bus.service';

const busService = new BusService();

export class BusController {
    async getAll(req: Request, res: Response) {
        try {
            const buses = await busService.getAllBuses();
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

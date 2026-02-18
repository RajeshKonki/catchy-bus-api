import prisma from '../config/db';

export class BusService {
    async getAllBuses() {
        return await prisma.bus.findMany({
            include: {
                college: true,
                route: true,
                driver: true
            }
        });
    }

    async getBusByNumber(busNumber: string) {
        return await prisma.bus.findUnique({
            where: { busNumber },
            include: {
                college: true,
                route: true,
                driver: true,
                students: true
            }
        });
    }

    async createBus(data: any) {
        return await prisma.bus.create({
            data
        });
    }

    async updateBus(id: string, data: any) {
        return await prisma.bus.update({
            where: { id },
            data
        });
    }

    async deleteBus(id: string) {
        return await prisma.bus.delete({
            where: { id }
        });
    }
}

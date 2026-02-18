import prisma from '../config/db';

export class DriverService {
    async getAllDrivers() {
        return await prisma.driver.findMany({
            include: {
                college: true,
                bus: true
            }
        });
    }

    async createDriver(data: any) {
        return await prisma.driver.create({ data });
    }

    async updateDriver(id: string, data: any) {
        return await prisma.driver.update({
            where: { id },
            data
        });
    }

    async deleteDriver(id: string) {
        return await prisma.driver.delete({ where: { id } });
    }
}

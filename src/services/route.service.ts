import prisma from '../config/db';

export class RouteService {
    async getAllRoutes() {
        return await prisma.route.findMany({
            include: { college: true }
        });
    }

    async getRouteById(id: string) {
        return await prisma.route.findUnique({
            where: { id },
            include: { buses: true }
        });
    }

    async createRoute(data: any) {
        return await prisma.route.create({ data });
    }

    async updateRoute(id: string, data: any) {
        return await prisma.route.update({
            where: { id },
            data
        });
    }

    async deleteRoute(id: string) {
        return await prisma.route.delete({ where: { id } });
    }
}

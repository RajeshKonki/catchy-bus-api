import prisma from '../config/db';

export class DashboardService {
    async getStats() {
        const [totalColleges, activeRoutes, totalBuses, activeDrivers, totalStudents] = await Promise.all([
            prisma.college.count(),
            prisma.route.count({ where: { status: 'ACTIVE' } }),
            prisma.bus.count(),
            prisma.driver.count({ where: { status: 'ACTIVE' } }),
            prisma.student.count()
        ]);

        return {
            totalColleges,
            activeRoutes,
            totalBuses,
            activeDrivers,
            totalStudents,
            liveBuses: 0 // This would come from dynamic cache/realtime state later
        };
    }
}

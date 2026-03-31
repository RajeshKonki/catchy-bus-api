import prisma from '../config/db';

export class DashboardService {
    async getStats(collegeId?: string) {
        const whereClause = collegeId ? { collegeId } : {};
        const collegeWhere = collegeId ? { id: collegeId } : {};

        const [colleges, routes, buses, drivers, students] = await Promise.all([
            prisma.college.count({ where: collegeWhere }),
            prisma.route.count({ where: { ...whereClause, status: 'ACTIVE' } }),
            prisma.bus.count({ where: whereClause }),
            prisma.driver.count({ where: { ...whereClause, status: 'ACTIVE' } }),
            prisma.student.count({ where: whereClause })
        ]);

        return {
            colleges: colleges || 0,
            routes: routes || 0,
            buses: buses || 0,
            drivers: drivers || 0,
            students: students || 0,
            liveBuses: 0
        };
    }
}

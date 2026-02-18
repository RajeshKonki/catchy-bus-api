import prisma from '../config/db';

export class CollegeService {
    async getAllColleges() {
        return await prisma.college.findMany({
            include: {
                _count: {
                    select: { buses: true, routes: true, drivers: true, students: true }
                }
            }
        });
    }

    async getCollegeById(id: string) {
        return await prisma.college.findUnique({
            where: { id },
            include: {
                routes: true,
                buses: true,
                drivers: true
            }
        });
    }

    async createCollege(data: any) {
        return await prisma.college.create({
            data
        });
    }

    async updateCollege(id: string, data: any) {
        return await prisma.college.update({
            where: { id },
            data
        });
    }

    async deleteCollege(id: string) {
        return await prisma.college.delete({
            where: { id }
        });
    }
}

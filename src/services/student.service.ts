import prisma from '../config/db';

export class StudentService {
    async getAllStudents() {
        return await prisma.student.findMany({
            include: {
                college: true,
                bus: true
            }
        });
    }

    async updateStudent(id: string, data: any) {
        return await prisma.student.update({
            where: { id },
            data
        });
    }

    async deleteStudent(id: string) {
        return await prisma.student.delete({ where: { id } });
    }
}

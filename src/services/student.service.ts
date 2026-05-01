import prisma from '../config/db';
import { emailService } from './email.service';
import { s3Service } from './s3.service';

export class StudentService {
    async getAllStudents(collegeId?: string, search?: string, busNumber?: string, pickupStop?: string) {
        const where: any = {};
        if (collegeId) {
            where.collegeId = collegeId;
        }
        if (busNumber) {
            where.bus = { busNumber };
        }
        if (pickupStop) {
            where.pickupStop = {
                contains: pickupStop,
                mode: 'insensitive'
            };
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { department: { contains: search, mode: 'insensitive' } },
                { year: { contains: search, mode: 'insensitive' } }
            ];
        }

        return await prisma.student.findMany({
            where,
            include: {
                college: true,
                bus: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getStudentById(id: string) {
        return await prisma.student.findUnique({
            where: { id },
            include: {
                college: true,
                bus: true
            }
        });
    }

    async createStudent(data: any) {
        const cleanData = await this.sanitizeStudentData(data, false) as any;
        const student = await prisma.student.create({ data: cleanData });
        return student;
    }

    async updateStudent(id: string, data: any) {
        const cleanData = await this.sanitizeStudentData(data, true);
        return await prisma.student.update({
            where: { id },
            data: cleanData as any
        });
    }

    private async sanitizeStudentData(data: any, isUpdate: boolean = false) {
        const { studentId, name, email, phone, collegeId, busId, status, pickupStop, notificationSettings, department, year } = data;
        let profilePictureUrl = data.profilePictureUrl;


        // Upload to S3 if base64
        if (profilePictureUrl) {
            profilePictureUrl = await s3Service.uploadImage(profilePictureUrl, 'students');
        }

        const cleanData: any = {
            studentId: studentId || null,
            name,
            email: email || null,
            phone,
            status: status ? status.toUpperCase() : 'ACTIVE',
            profilePictureUrl: profilePictureUrl || null,
            pickupStop: pickupStop || null,
            notificationSettings: notificationSettings || undefined,
            department: department || null,
            year: year || null,
        };

        if (collegeId) {
            cleanData.college = { connect: { id: collegeId } };
        }

        if (busId) {
            cleanData.bus = { connect: { id: busId } };
        } else if (isUpdate && (busId === null || busId === '')) {
            cleanData.bus = { disconnect: true };
        }

        return cleanData;
    }


    async deleteStudent(id: string) {
        return await prisma.student.delete({ where: { id } });
    }
}

import prisma from '../config/db';
import { s3Service } from './s3.service';

export class DriverService {
    async getAllDrivers(collegeId?: string, search?: string) {
        const where: any = {};
        if (collegeId) {
            where.collegeId = collegeId;
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { licenseNumber: { contains: search, mode: 'insensitive' } }
            ];
        }
        return await prisma.driver.findMany({
            where,
            include: {
                college: true,
                bus: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getDriverById(id: string) {
        return await prisma.driver.findUnique({
            where: { id },
            include: {
                college: true,
                bus: true
            }
        });
    }

    async createDriver(data: any) {
        const cleanData = await this.sanitizeDriverData(data);
        return await prisma.driver.create({ data: cleanData });
    }

    async updateDriver(id: string, data: any) {
        const cleanData = await this.sanitizeDriverData(data);
        // Remove password from update if not provided
        if (!cleanData.password) {
            delete (cleanData as any).password;
        }
        return await prisma.driver.update({
            where: { id },
            data: cleanData
        });
    }

    private async sanitizeDriverData(data: any) {
        const {
            name, email, loginPassword, password,
            phone, licenseNumber, status,
            collegeId, busId
        } = data;

        let photoUrl = data.photoUrl || data.profilePictureUrl;

        // Upload to S3 if base64
        if (photoUrl) {
            photoUrl = await s3Service.uploadImage(photoUrl, 'drivers');
        }

        return {
            name,
            email,
            password: password || loginPassword, // Map loginPassword to password
            phone,
            licenseNumber,
            status: status ? status.toUpperCase() : 'ACTIVE',
            collegeId,
            busId: busId || null,
            photoUrl: photoUrl || null
        };
    }

    async deleteDriver(id: string) {
        return await prisma.driver.delete({ where: { id } });
    }
}

import prisma from '../config/db';
import { emailService } from './email.service';
import { s3Service } from './s3.service';

export class CollegeService {
    async getAllColleges(collegeId?: string, search?: string) {
        const where: any = {};
        if (collegeId) {
            where.id = collegeId;
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { contactPerson: { contains: search, mode: 'insensitive' } }
            ];
        }
        return await prisma.college.findMany({
            where,
            include: {
                _count: {
                    select: { buses: true, routes: true, drivers: true, students: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getCollegeById(id: string) {
        const college = await prisma.college.findUnique({
            where: { id },
            include: {
                routes: true,
                buses: true,
                drivers: true,
                students: true,
                _count: {
                    select: {
                        buses: true,
                        drivers: true,
                        students: true,
                        routes: true
                    }
                }
            }
        });

        if (!college) return null;

        // Map counts and coordinate names for frontend expectations
        return {
            ...college,
            busCount: college._count.buses,
            driverCount: college._count.drivers,
            studentCount: college._count.students,
            routeCount: college._count.routes,
            latitude: college.lat,
            longitude: college.lng
        };
    }

    async createCollege(data: any) {
        const cleanData = await this.sanitizeCollegeData(data);
        const college = await prisma.college.create({
            data: cleanData
        });

        if (college.email) {
            try {
                const htmlContent = `
                    <h2>Welcome to Catchy Bus, ${college.name}!</h2>
                    <p>Your college portal account has been created successfully.</p>
                    <p><strong>Login URL:</strong> https://catchybustrack.netlify.app</p>
                    <p><strong>Login Email:</strong> ${college.loginEmail}</p>
                    <p><strong>Password:</strong> ${cleanData.loginPassword}</p>
                    <br>
                    <p>Please log in to manage your buses, routes, and tracking features.</p>
                `;

                emailService.sendEmail(college.email, college.name, 'Welcome to Catchy Bus Portal', htmlContent).catch(console.error);
            } catch (err) {
                console.error('Failed to dispatch welcome email to college:', err);
            }
        }

        return college;
    }

    async updateCollege(id: string, data: any) {
        const cleanData = await this.sanitizeCollegeData(data);
        // Remove password if not provided
        if (!cleanData.loginPassword) {
            delete (cleanData as any).loginPassword;
        }
        return await prisma.college.update({
            where: { id },
            data: cleanData
        });
    }

    private async sanitizeCollegeData(data: any) {
        // Handle both frontend naming (lat, lng, availability, imageUrl) 
        // and legacy/alternative naming (latitude, longitude, status, logo)
        const name = data.name;
        const address = data.address;
        const lat = data.lat !== undefined ? data.lat : data.latitude;
        const lng = data.lng !== undefined ? data.lng : data.longitude;
        const phone = data.phone;
        const email = data.email;
        const contactPerson = data.contactPerson;
        const loginEmail = data.loginEmail;
        const loginPassword = data.loginPassword;
        const availability = data.availability !== undefined ? !!data.availability : (data.status === 'Active' || data.status === 'ACTIVE');
        let imageUrl = data.imageUrl !== undefined ? data.imageUrl : data.logo;

        // Upload to S3 if base64
        if (imageUrl) {
            imageUrl = await s3Service.uploadImage(imageUrl, 'colleges');
        }

        const subscriptionStart = data.subscriptionStart ? new Date(data.subscriptionStart) : null;
        const subscriptionType = data.subscriptionType ? Number(data.subscriptionType) : null;
        let subscriptionEnd = null;

        if (subscriptionStart && subscriptionType) {
            subscriptionEnd = new Date(subscriptionStart);
            subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + subscriptionType);
        }

        return {
            name,
            address,
            lat: lat ? Number(lat) : 0,
            lng: lng ? Number(lng) : 0,
            phone,
            email,
            contactPerson,
            loginEmail,
            loginPassword,
            availability: !!availability,
            imageUrl: imageUrl || null,
            subscriptionStart,
            subscriptionType,
            subscriptionEnd
        };
    }

    async deleteCollege(id: string) {
        return await prisma.college.delete({
            where: { id }
        });
    }
}

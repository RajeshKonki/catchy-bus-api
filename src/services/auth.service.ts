import prisma from '../config/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export class AuthService {
    async loginAdmin(email: string, password: string) {
        const admin = await prisma.admin.findUnique({ where: { email } });
        if (!admin) throw new Error('Invalid credentials');

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) throw new Error('Invalid credentials');

        const token = jwt.sign(
            { id: admin.id, role: admin.role, type: 'admin' },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1d' }
        );

        return { token, user: { id: admin.id, email: admin.email, fullName: admin.fullName, role: admin.role } };
    }

    async loginCollege(email: string, password: string) {
        const college = await prisma.college.findUnique({ where: { loginEmail: email } });
        if (!college) throw new Error('Invalid credentials');
        if (!college.availability) throw new Error('College panel is disabled');

        if (password !== college.loginPassword) throw new Error('Invalid credentials');

        const token = jwt.sign(
            { id: college.id, type: 'college' },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1d' }
        );

        return { token, user: { id: college.id, name: college.name, email: college.email } };
    }

    async getMe(id: string, type: string) {
        if (type === 'admin') {
            return await prisma.admin.findUnique({
                where: { id },
                select: { id: true, email: true, fullName: true, role: true }
            });
        } else if (type === 'college') {
            return await prisma.college.findUnique({
                where: { id },
                select: { id: true, name: true, email: true, loginEmail: true }
            });
        }
        return null;
    }
    async updateMe(id: string, type: string, data: any) {
        if (type === 'admin') {
            return await prisma.admin.update({
                where: { id },
                data: {
                    fullName: data.fullName,
                    email: data.email
                },
                select: { id: true, email: true, fullName: true, role: true }
            });
        } else if (type === 'college') {
            return await prisma.college.update({
                where: { id },
                data: {
                    name: data.name,
                    email: data.email
                },
                select: { id: true, name: true, email: true, loginEmail: true }
            });
        }
        return null;
    }
}

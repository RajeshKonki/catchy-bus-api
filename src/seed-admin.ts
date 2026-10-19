import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const admins = [
        {
            email: 'admin@catchybus.com',
            password: 'Catchy@2026',
            fullName: 'Super Admin',
            role: 'superadmin'
        }
    ];

    console.log('🚀 Seeding super admins...');

    for (const adminData of admins) {
        try {
            const hashedPassword = await bcrypt.hash(adminData.password, 10);
            const admin = await prisma.admin.upsert({
                where: { email: adminData.email },
                update: {
                    password: hashedPassword,
                    fullName: adminData.fullName,
                    role: adminData.role,
                },
                create: {
                    email: adminData.email,
                    password: hashedPassword,
                    fullName: adminData.fullName,
                    role: adminData.role,
                },
            });
            console.log(`✅ Admin ${admin.email} created/updated successfully.`);
        } catch (error) {
            console.error(`❌ Error creating admin ${adminData.email}:`, error);
        }
    }

    console.log('✨ Seeding completed.');
    await prisma.$disconnect();
}

main();

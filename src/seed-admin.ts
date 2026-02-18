import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'rajesh.k@gmail.com';
    const password = 'Rajesh@123';
    const fullName = 'Super Admin';
    const role = 'super_admin';

    console.log(`🚀 Creating admin user: ${email}...`);

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const admin = await prisma.admin.upsert({
            where: { email },
            update: {
                password: hashedPassword,
                fullName,
                role,
            },
            create: {
                email,
                password: hashedPassword,
                fullName,
                role,
            },
        });

        console.log('✅ Admin user created/updated successfully:');
        console.log({
            id: admin.id,
            email: admin.email,
            role: admin.role,
        });
    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();

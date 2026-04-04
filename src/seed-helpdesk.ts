import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Helpdesk Queries...');

    // Queries for Superadmin (from Colleges)
    await prisma.helpdeskQuery.createMany({
        data: [
            {
                subject: 'Subscription Extension',
                message: 'We would like to extend our license for 6 more months.',
                senderId: 'college-1', // Mock ID
                senderType: 'COLLEGE',
                senderName: 'Vardhaman College',
                targetId: null, // For Admin
                priority: 'HIGH'
            },
            {
                subject: 'Technical Support',
                message: 'Map integration is slow in our region.',
                senderId: 'college-2',
                senderType: 'COLLEGE',
                senderName: 'Vignan Institute',
                targetId: null,
                priority: 'MEDIUM'
            }
        ]
    });

    // Queries for a specific College (from Students/Drivers)
    // I'll try to find a real college ID if possible, otherwise use a placeholder
    const firstCollege = await prisma.college.findFirst();
    if (firstCollege) {
        await prisma.helpdeskQuery.createMany({
            data: [
                {
                    subject: 'Driver Misbehavior',
                    message: 'Driver was speeding today morning.',
                    senderId: 'student-1',
                    senderType: 'STUDENT',
                    senderName: 'Rahul Kumar',
                    targetId: firstCollege.id,
                    priority: 'URGENT'
                },
                {
                    subject: 'Bus Breakdown',
                    message: 'Bus Number AP10 reached late due to engine issue.',
                    senderId: 'driver-1',
                    senderType: 'DRIVER',
                    senderName: 'Suresh Raina',
                    targetId: firstCollege.id,
                    priority: 'HIGH'
                }
            ]
        });
    }

    console.log('Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

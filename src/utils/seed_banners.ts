import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding banners...');
  
  const banners = [
    {
      title: 'Real-time Tracking',
      imageUrl: 'https://img.freepik.com/free-vector/school-bus-concept-illustration_114360-8457.jpg',
      link: null,
      status: 'ACTIVE' as any,
      order: 1
    },
    {
      title: 'Safety First',
      imageUrl: 'https://img.freepik.com/free-vector/location-tracking-concept-illustration_114360-4814.jpg',
      link: null,
      status: 'ACTIVE' as any,
      order: 2
    },
    {
      title: 'Instant Notifications',
      imageUrl: 'https://img.freepik.com/free-vector/push-notifications-concept-illustration_114360-4986.jpg',
      link: null,
      status: 'ACTIVE' as any,
      order: 3
    }
  ];

  for (const banner of banners) {
    await prisma.banner.create({
      data: banner
    });
  }

  console.log('Banners seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

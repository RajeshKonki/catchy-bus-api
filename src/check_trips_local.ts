import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const latestTrips = await prisma.trip.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { bus: true }
  });

  console.log('--- LATEST TRIPS ---');
  latestTrips.forEach((t: any) => {
    console.log(`[${t.status}] Bus: ${t.bus.busNumber} | Created: ${t.createdAt} | Ended: ${t.endTime || 'N/A'}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });

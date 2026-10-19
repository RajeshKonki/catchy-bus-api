import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const buses = await prisma.bus.findMany({
    include: {
      trips: {
        where: {
          startTime: {
            gte: new Date(Date.now() - 12 * 60 * 60 * 1000)
          }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  console.log('ALL BUSES AND THEIR RECENT TRIPS:');
  console.dir(buses.map(b => ({
    id: b.id,
    busNumber: b.busNumber,
    status: b.status,
    trips: b.trips.map(t => ({ id: t.id, status: t.status, isReverse: t.isReverse, createdAt: t.createdAt }))
  })), { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

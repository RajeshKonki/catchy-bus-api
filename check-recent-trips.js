const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const trips = await prisma.trip.findMany({
    orderBy: { startTime: 'desc' },
    take: 5,
    include: { route: true }
  });
  for (const t of trips) {
    console.log(`Trip ${t.id} - Route: ${t.route.name} - Reverse: ${t.isReverse} - Started: ${t.startTime}`);
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const buses = await prisma.bus.findMany({ include: { route: true }});
  for (const b of buses) {
    if (b.route && b.route.stops) {
      const stops = b.route.stops;
      let hasRev = false;
      for (const s of stops) {
        if (s.reverseLat) hasRev = true;
      }
      if (hasRev) {
        console.log(`Bus ${b.busNumber} has route ${b.route.name} with reverseLat`);
      }
    }
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());

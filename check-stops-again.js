const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const buses = await prisma.bus.findMany({ include: { route: true }});
  for (const b of buses) {
    if (b.route && b.route.stops) {
      const stops = b.route.stops;
      let hasRev = false;
      for (const s of stops) {
        if (s.reverseLat) {
           console.log(`Route ${b.route.name} stop ${s.name} has reverseLat ${s.reverseLat}`);
           hasRev = true;
        }
      }
    }
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());

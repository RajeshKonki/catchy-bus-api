const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const route = await prisma.route.findFirst({ where: { name: 'route test(Rajesh)' } });
  for (const s of route.stops) {
    if (s.name === 'Attrium Mall') {
       console.log("Forward:", s.latitude, s.longitude);
       console.log("Reverse:", s.reverseLat, s.reverseLng);
    }
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());

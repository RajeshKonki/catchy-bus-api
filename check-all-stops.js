const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const route = await prisma.route.findFirst({ where: { name: 'route test(Rajesh)' } });
  for (const s of route.stops) {
       console.log(`${s.name}: reverseLat=${s.reverseLat}, lat=${s.latitude}`);
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const route = await prisma.route.findFirst({ where: { name: 'route test(Rajesh)' } });
  console.log(`Route has ${route.stops.length} stops`);
  for (const s of route.stops) {
       console.log(`- ${s.name}: reverseLat=${s.reverseLat}`);
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());

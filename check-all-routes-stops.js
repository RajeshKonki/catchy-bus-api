const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const routes = await prisma.route.findMany();
  for (const r of routes) {
      console.log(`Route: ${r.name}`);
      for (const s of r.stops || []) {
           console.log(`  - ${s.name}: reverseLat=${s.reverseLat ? 'YES' : 'NO'}`);
      }
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());

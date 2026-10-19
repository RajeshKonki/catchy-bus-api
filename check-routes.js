const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const routes = await prisma.route.findMany();
  for (const r of routes) {
    if (r.stops && Array.isArray(r.stops)) {
      for (const s of r.stops) {
        if (s.reverseLat || s.reverseLatitude) {
           console.log(`Route ${r.name} stop ${s.name} has reverseLat ${s.reverseLat || s.reverseLatitude}`);
        }
      }
    }
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());

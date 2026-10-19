const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const routes = await prisma.route.findMany();
  let hasReverse = false;
  for (const r of routes) {
    if (r.stops && Array.isArray(r.stops)) {
      for (const s of r.stops) {
        if (s.reverseLat) {
          hasReverse = true;
          console.log(`Route ${r.name} has reverseLat: ${s.reverseLat}`);
        }
      }
    }
  }
  if (!hasReverse) console.log("NO ROUTE HAS reverseLat IN DB!");
}
run().catch(console.error).finally(() => prisma.$disconnect());

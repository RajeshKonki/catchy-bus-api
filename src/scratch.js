const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const routes = await prisma.route.findMany();
  console.log(`Found ${routes.length} routes:`);
  for (const r of routes) {
    console.log(`- ID: ${r.id}, Name: ${r.name}, Start: ${r.startPoint}, End: ${r.endPoint}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());

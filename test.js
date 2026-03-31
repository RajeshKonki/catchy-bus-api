const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const drivers = await prisma.driver.findMany({
    include: { bus: { include: { busRoutes: { include: { route: true } } } }, driverRoutes: true }
  });
  console.log(JSON.stringify(drivers, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

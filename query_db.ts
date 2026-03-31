import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const drivers = await prisma.driver.findMany({
    include: { bus: { include: { busRoutes: { include: { route: true } } } }, driverRoutes: true }
  });
  console.log('DRIVERS:', JSON.stringify(drivers, null, 2));
}
main();

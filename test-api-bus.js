const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const bus = await prisma.bus.findUnique({
      where: { busNumber: 'AP 39 TW 2235' },
      include: {
          college: true,
          route: true,
          driver: true,
          students: true,
          busRoutes: {
              include: { route: true }
          }
      }
  });
  console.log(JSON.stringify(bus.route.stops, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());

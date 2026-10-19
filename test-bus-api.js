const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const route = await prisma.route.findFirst({ where: { name: 'route test(Rajesh)' }, include: { buses: true }});
  if (route && route.buses.length > 0) {
    const bus = route.buses[0];
    console.log(`Bus number: ${bus.busNumber}`);
  } else {
    console.log("No bus assigned to this route");
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());

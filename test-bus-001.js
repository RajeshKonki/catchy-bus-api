const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const bus = await prisma.bus.findUnique({ where: { busNumber: 'AP 39 TW 2235' }, include: { route: true }});
  if (bus) {
    console.log(`Route name: ${bus.route?.name}`);
    console.log(JSON.stringify(bus.route?.stops, null, 2));
  } else {
    console.log("No such bus");
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());

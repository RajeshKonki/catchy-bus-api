const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- List of Buses ---');
    const buses = await prisma.bus.findMany({
        select: { id: true, busNumber: true }
    });
    console.log(JSON.stringify(buses, null, 2));

    console.log('\n--- List of Routes ---');
    const routes = await prisma.route.findMany({
        select: { id: true, name: true, startPoint: true, endPoint: true }
    });
    console.log(JSON.stringify(routes, null, 2));

    console.log('\n--- Active Trips ---');
    const trips = await prisma.trip.findMany({
        where: { status: 'STARTED' },
        select: { id: true, busId: true, routeId: true, isReverse: true }
    });
    console.log(JSON.stringify(trips, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking for Trip records with routeId = "null" ---');
    const trips = await prisma.trip.findMany({
        where: { routeId: 'null' }
    });
    console.log(`Found ${trips.length} trips with routeId = "null"`);
    console.log(JSON.stringify(trips, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Inserting trip with routeId="null"...');
    let trip = await prisma.trip.create({
        data: {
            busId: "68154738-b40e-47ff-a9cf-36c3c48107d0",
            routeId: "null",
            status: 'STARTED',
            passedStops: [],
            isReverse: true,
        }
    });
    console.log('Success ("null"):', trip);
}

main()
  .catch(e => console.error('ERROR OUT:', e))
  .finally(async () => await prisma.$disconnect());

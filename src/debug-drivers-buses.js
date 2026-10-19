const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const drivers = await prisma.driver.findMany({
        include: {
            bus: {
                include: {
                    route: true,
                    busRoutes: {
                        include: { route: true }
                    }
                }
            },
            driverRoutes: {
                include: { route: true }
            }
        }
    });

    for (const d of drivers) {
        console.log(`Driver: ${d.name} (${d.phone})`);
        if (d.bus) {
            console.log(`  Bus: ${d.bus.busNumber} (ID: ${d.bus.id})`);
            if (d.bus.route) {
                console.log(`    Bus Direct Route: ${d.bus.route.name} (ID: ${d.bus.route.id})`);
            }
            if (d.bus.busRoutes && d.bus.busRoutes.length > 0) {
                console.log(`    Bus Mapped Routes:`, d.bus.busRoutes.map(br => `${br.route.name} (ID: ${br.route.id})`));
            }
        } else {
            console.log(`  No Bus assigned.`);
        }
        if (d.driverRoutes && d.driverRoutes.length > 0) {
            console.log(`  Driver Assigned Routes:`, d.driverRoutes.map(dr => `${dr.route.name} (ID: ${dr.route.id})`));
        }
        console.log('------------------------------');
    }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

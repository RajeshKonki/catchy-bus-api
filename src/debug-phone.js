
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- List of Drivers ---');
    const drivers = await prisma.driver.findMany({
        select: {
            id: true,
            name: true,
            phone: true
        }
    });
    console.log(JSON.stringify(drivers, null, 2));

    console.log('\n--- List of Students ---');
    const students = await prisma.student.findMany({
        select: {
            id: true,
            name: true,
            phone: true
        }
    });
    console.log(JSON.stringify(students, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

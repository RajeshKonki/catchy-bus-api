import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function test() {
  const bus = await prisma.bus.findUnique({
    where: { busNumber: 'BUS-001' },
    include: {
      route: {
        include: {
          stops: { orderBy: { order: 'asc' } },
          routePath: { orderBy: { order: 'asc' } }
        }
      }
    }
  });
  console.log(bus?.route?.stops.length);
}
test().catch(console.error).finally(() => prisma.$disconnect());

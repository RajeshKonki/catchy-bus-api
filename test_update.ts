import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const bus = await prisma.bus.findFirst();
  if(!bus) return;
  const route = await prisma.route.findFirst();
  if(!route) return;

  console.log("Updating bus", bus.busNumber, "with route", route.name);
  
  await prisma.$transaction(async (tx: any) => {
    if ([route.id]) {
      await tx.busRoute.deleteMany({ where: { busId: bus.id } });
      await tx.busRoute.createMany({
        data: [{ busId: bus.id, routeId: route.id }]
      });
    }
  });

  const updated = await prisma.bus.findUnique({
    where: { id: bus.id },
    include: { busRoutes: true }
  });
  console.log("Updated busRoutes length:", updated?.busRoutes.length);
}
main();

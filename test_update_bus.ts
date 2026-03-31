import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { BusService } from './src/services/bus.service';

async function main() {
  const busService = new BusService();
  const routes = await prisma.route.findMany({ take: 2 });
  if (routes.length === 0) return console.log("No routes to link");
  const bus = await prisma.bus.findFirst();
  if(!bus) return console.log("No bus to test");
  
  console.log(`Connecting Bus ${bus.busNumber} to Route ${routes[0].name}`);
  const payload = {
      busNumber: bus.busNumber,
      capacity: bus.capacity,
      title: bus.title,
      description: bus.description,
      status: bus.status,
      collegeId: bus.collegeId,
      routeIds: [routes[0].id]
  };

  try {
      const updated = await busService.updateBus(bus.id, payload);
      console.log("Updated Bus returned from Service:", updated);
      
      const dbBus = await prisma.bus.findUnique({
          where: { id: bus.id },
          include: { busRoutes: true }
      });
      console.log("DB reads busRoutes:", dbBus?.busRoutes);
  } catch (err) {
      console.error("Error updating:", err);
  }
}
main().catch(console.error).finally(()=>prisma.$disconnect());

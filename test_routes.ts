import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.driver.findFirst();
  if(!user) return console.log("No drivers");
  
  // 1. Get explicitly assigned driver routes
  const driverRoutes = await prisma.driverRoute.findMany({
      where: { driverId: user.id },
      include: { route: true }
  });
  let routes = driverRoutes.map((dr: any) => dr.route).filter(Boolean);
  
  // 2. Get implicitly assigned routes attached to the driver's bus
  const driver = await (prisma as any).driver.findUnique({
      where: { id: user.id },
      include: { 
          bus: { 
              include: { 
                  busRoutes: { include: { route: true } }, 
                  route: true 
              } 
          } 
      }
  });
  
  if (driver?.bus) {
      if (driver.bus.busRoutes && driver.bus.busRoutes.length > 0) {
          routes.push(...driver.bus.busRoutes.map((br: any) => br.route).filter(Boolean));
      }
      if (driver.bus.route) {
          routes.push(driver.bus.route);
      }
  }
  
  // Remove duplicates by route id
  const uniqueRoutes = Array.from(new Map(routes.map((r: any) => [r.id, r])).values());
  
  console.log("Unique Routes for driver", user.name, "bus:", driver?.bus?.busNumber);
  console.log(JSON.stringify(uniqueRoutes, null, 2));
}
main();

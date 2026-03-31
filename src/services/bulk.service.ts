import prisma from '../config/db';
import { json2csv } from 'json-2-csv';
import { parse } from 'csv-parse/sync';

export class BulkService {
    async exportData(module: string, collegeId?: string) {
        let data: any[] = [];
        const whereClause = collegeId ? { collegeId } : {};
        switch (module) {
            case 'colleges':
                data = await prisma.college.findMany({
                    where: collegeId ? { id: collegeId } : {}
                });
                break;
            case 'buses':
                data = await prisma.bus.findMany({
                    where: whereClause,
                    include: { college: true, route: true }
                });
                data = data.map(b => ({
                    ...b,
                    college: b.college.name,
                    route: b.route?.name || ''
                }));
                break;
            case 'drivers':
                data = await prisma.driver.findMany({
                    where: whereClause,
                    include: { college: true, bus: true }
                });
                data = data.map(d => ({
                    ...d,
                    college: d.college.name,
                    bus: d.bus?.busNumber || ''
                }));
                break;
            case 'students':
                data = await prisma.student.findMany({
                    where: whereClause,
                    include: { college: true, bus: true }
                });
                data = data.map(s => ({
                    ...s,
                    college: s.college.name,
                    bus: s.bus?.busNumber || '',
                    pickupStop: s.pickupStop || ''
                }));

                break;
            case 'routes':
                data = await prisma.route.findMany({
                    where: whereClause,
                    include: { college: true }
                });
                data = data.map(r => ({
                    ...r,
                    college: r.college.name,
                    stops: Array.isArray(r.stops) ? (r.stops as any[]).map(s => {
                        if (typeof s === 'string') return s;
                        return `${s.name || ''}:${s.lat || ''},${s.lng || ''}`;
                    }).join(' | ') : ''
                }));
                break;
            default:
                throw new Error('Invalid module');
        }

        // Clean data for CSV (remove IDs, timestamps if preferred, or keep them)
        // For now keep it simple and just convert the whole objects
        return json2csv(data);
    }

    async importData(module: string, csvContent: string, collegeId?: string) {
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true
        }) as any[];

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const record of records) {
            try {
                switch (module) {
                    case 'colleges':
                        await prisma.college.create({
                            data: {
                                name: record.name,
                                address: record.address,
                                lat: parseFloat(record.lat),
                                lng: parseFloat(record.lng),
                                phone: record.phone,
                                email: record.email,
                                loginEmail: record.loginEmail,
                                loginPassword: record.loginPassword,
                                contactPerson: record.contactPerson || null,
                                imageUrl: record.imageUrl || null,
                                availability: record.availability === 'true' || record.availability === '1'
                            } as any
                        });
                        break;
                    case 'students':
                        let effectiveCollegeId = collegeId || record.collegeId;
                        if (!effectiveCollegeId && record.collegeName) {
                            const col = await prisma.college.findFirst({ where: { name: record.collegeName } });
                            effectiveCollegeId = col?.id;
                        }

                        let busId = record.busId;
                        if (!busId && record.busNumber) {
                            const bus = await prisma.bus.findUnique({ where: { busNumber: record.busNumber } });
                            busId = bus?.id;
                        }

                        if (!effectiveCollegeId) throw new Error(`College ${record.collegeName || record.collegeId} not found`);

                        await prisma.student.create({
                            data: {
                                name: record.name,
                                email: record.email || null,
                                phone: record.phone,
                                status: record.status ? (record.status.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') : 'ACTIVE',
                                collegeId: effectiveCollegeId,
                                busId: busId || null,
                                pickupStop: record.pickupStop || null
                            } as any
                        });

                        break;

                    case 'buses':
                        let bEffectiveCollegeId = collegeId || record.collegeId;
                        if (!bEffectiveCollegeId && record.collegeName) {
                            const col = await prisma.college.findFirst({ where: { name: record.collegeName } });
                            bEffectiveCollegeId = col?.id;
                        }
                        if (!bEffectiveCollegeId) throw new Error(`College ${record.collegeName || record.collegeId} not found`);

                        let bRouteId = record.routeId;
                        if (!bRouteId && record.routeName) {
                            const route = await prisma.route.findFirst({ where: { name: record.routeName } });
                            bRouteId = route?.id;
                        }

                        await prisma.bus.create({
                            data: {
                                busNumber: record.busNumber,
                                capacity: parseInt(record.capacity),
                                title: record.title || null,
                                description: record.description || null,
                                status: record.status ? (record.status.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') : 'ACTIVE',
                                collegeId: bEffectiveCollegeId,
                                routeId: bRouteId || null
                            } as any
                        });
                        break;

                    case 'drivers':
                        let dEffectiveCollegeId = collegeId || record.collegeId;
                        if (!dEffectiveCollegeId && record.collegeName) {
                            const col = await prisma.college.findFirst({ where: { name: record.collegeName } });
                            dEffectiveCollegeId = col?.id;
                        }
                        if (!dEffectiveCollegeId) throw new Error(`College ${record.collegeName || record.collegeId} not found`);

                        let dBusId = record.busId;
                        if (!dBusId && record.busNumber) {
                            const bus = await prisma.bus.findUnique({ where: { busNumber: record.busNumber } });
                            dBusId = bus?.id;
                        }

                        await prisma.driver.create({
                            data: {
                                name: record.name,
                                email: record.email,
                                password: record.password || 'Driver@123',
                                phone: record.phone,
                                licenseNumber: record.licenseNumber,
                                status: record.status ? (record.status.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') : 'ACTIVE',
                                collegeId: dEffectiveCollegeId,
                                busId: dBusId || null
                            } as any
                        });
                        break;

                    case 'routes':
                        let rEffectiveCollegeId = collegeId || record.collegeId;
                        if (!rEffectiveCollegeId && record.collegeName) {
                            const col = await prisma.college.findFirst({ where: { name: record.collegeName } });
                            rEffectiveCollegeId = col?.id;
                        }
                        if (!rEffectiveCollegeId) throw new Error(`College ${record.collegeName || record.collegeId} not found`);

                        await prisma.route.create({
                            data: {
                                name: record.name,
                                startPoint: record.startPoint,
                                endPoint: record.endPoint,
                                status: record.status ? (record.status.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') : 'ACTIVE',
                                collegeId: rEffectiveCollegeId,
                                startLat: record.startLat ? parseFloat(record.startLat) : null,
                                startLng: record.startLng ? parseFloat(record.startLng) : null,
                                endLat: record.endLat ? parseFloat(record.endLat) : null,
                                endLng: record.endLng ? parseFloat(record.endLng) : null,
                                distance: record.distance ? parseFloat(record.distance) : null,
                                duration: record.duration ? parseInt(record.duration) : null,
                                stops: record.stops ? record.stops.split('|').map((s: string) => {
                                    const trimmed = s.trim();
                                    if (trimmed.includes(':')) {
                                        const [name, coords] = trimmed.split(':');
                                        const [lat, lng] = coords.split(',');
                                        return {
                                            name: name.trim(),
                                            lat: parseFloat(lat),
                                            lng: parseFloat(lng)
                                        };
                                    }
                                    return trimmed;
                                }) : []
                            } as any
                        });
                        break;
                }
                results.success++;
            } catch (err: any) {
                results.failed++;
                results.errors.push(`Row ${results.success + results.failed}: ${err.message}`);
            }
        }

        return results;
    }

    getSampleFormat(module: string) {
        switch (module) {
            case 'colleges':
                return json2csv([{
                    name: 'Example College',
                    address: '123 Main St',
                    lat: 12.9716,
                    lng: 77.5946,
                    phone: '1234567890',
                    email: 'college@example.com',
                    loginEmail: 'admin@college.com',
                    loginPassword: 'password123',
                    contactPerson: 'John Doe',
                    imageUrl: '',
                    availability: 'true'
                }]);
            case 'students':
                return json2csv([{
                    name: 'Jane Doe',
                    email: 'jane@example.com',
                    phone: '9876543210',
                    collegeName: 'Example College',
                    busNumber: 'BUS-001',
                    pickupStop: 'Stop A',
                    status: 'ACTIVE'
                }]);

            case 'buses':
                return json2csv([{
                    busNumber: 'BUS-001',
                    capacity: 50,
                    title: 'Express Bus',
                    description: 'Route 1 express',
                    collegeName: 'Example College',
                    routeName: 'Route 1',
                    status: 'ACTIVE'
                }]);
            case 'drivers':
                return json2csv([{
                    name: 'Michael Schumacher',
                    email: 'michael@example.com',
                    phone: '5551234567',
                    licenseNumber: 'LIC12345',
                    collegeName: 'Example College',
                    busNumber: 'BUS-001',
                    status: 'ACTIVE'
                }]);
            case 'routes':
                return json2csv([{
                    name: 'Route 1',
                    startPoint: 'Station A',
                    startLat: 12.9716,
                    startLng: 77.5946,
                    endPoint: 'Station B',
                    endLat: 13.0827,
                    endLng: 80.2707,
                    collegeName: 'Example College',
                    distance: 10.5,
                    duration: 30,
                    stops: 'Stop X:12.98,77.60 | Stop Y:13.00,77.65',
                    status: 'ACTIVE'
                }]);
            default:
                throw new Error('Invalid module');
        }
    }
}

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
                    include: {
                        college: true,
                        route: true,
                        busRoutes: {
                            include: { route: true }
                        }
                    }
                });
                data = data.map(b => {
                    const routes = b.busRoutes.map((br: any) => br.route.name);
                    // Also include the legacy route if it exists and isn't already in the list
                    if (b.route && !routes.includes(b.route.name)) {
                        routes.push(b.route.name);
                    }
                    return {
                        id: b.id,
                        busNumber: b.busNumber,
                        capacity: b.capacity,
                        title: b.title,
                        description: b.description,
                        status: b.status,
                        collegeName: b.college.name,
                        routeName: routes.join(' | '),
                        imageUrl: b.imageUrl
                    };
                });
                break;
            case 'drivers':
                data = await prisma.driver.findMany({
                    where: whereClause,
                    include: { college: true, bus: true }
                });
                data = data.map(d => ({
                    id: d.id,
                    name: d.name,
                    email: d.email,
                    phone: d.phone,
                    licenseNumber: d.licenseNumber,
                    collegeName: d.college.name,
                    busNumber: d.bus?.busNumber || '',
                    status: d.status
                }));
                break;
            case 'students':
                data = await prisma.student.findMany({
                    where: whereClause,
                    include: { college: true, bus: true }
                });
                data = data.map(s => ({
                    id: s.id,
                    studentId: s.studentId || '',
                    name: s.name,
                    email: s.email || '',
                    phone: s.phone,
                    collegeName: s.college.name,
                    busNumber: s.bus?.busNumber || '',
                    pickupStop: s.pickupStop || '',
                    department: s.department || '',
                    year: s.year || '',
                    status: s.status,
                    profilePictureUrl: s.profilePictureUrl || ''
                }));

                break;
            case 'routes':
                data = await prisma.route.findMany({
                    where: whereClause,
                    include: { college: true }
                });
                data = data.map(r => ({
                    id: r.id,
                    name: r.name,
                    collegeName: r.college.name,
                    startPoint: r.startPoint,
                    startAddress: r.startAddress || '',
                    departureTime: r.startTime || '',
                    reverseDepartureTime: r.reverseStartTime || '',
                    startLat: r.startLat,
                    startLng: r.startLng,
                    endPoint: r.endPoint,
                    endAddress: r.endAddress || '',
                    arrivalTime: r.endTime || '',
                    reverseArrivalTime: r.reverseEndTime || '',
                    endLat: r.endLat,
                    endLng: r.endLng,
                    distance: r.distance,
                    duration: r.duration,
                    status: r.status,
                    stops: Array.isArray(r.stops) ? (r.stops as any[]).map(s => {
                        if (typeof s === 'string') return s;
                        const lat = s.latitude || s.lat || '';
                        const lng = s.longitude || s.lng || '';
                        const rLat = s.reverseLat || '';
                        const rLng = s.reverseLng || '';
                        let coordsPart = `${lat},${lng}`;
                        if (rLat && rLng) coordsPart += `;${rLat},${rLng}`;

                        const time = s.expectedTime || s.arrivalTime || '';
                        const rTime = s.reverseExpectedTime || s.reverseArrivalTime || '';
                        let timePart = time;
                        if (rTime) timePart += `;${rTime}`;

                        const addr = s.address || '';
                        return `${s.name || ''}:${coordsPart}${addr ? '#' + addr : ''}${timePart ? '@' + timePart : ''}`;
                    }).join(' | ') : ''
                }));
                break;
            default:
                throw new Error('Invalid module');
        }

        // Clean data for CSV
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

        let currentCollegeName: string | null = null;
        if (collegeId) {
            const college = await prisma.college.findUnique({ where: { id: collegeId } });
            currentCollegeName = college?.name || null;
        }

        for (const record of records) {
            try {
                // Security Validation: Ensure College Admin only imports for their own college
                if (collegeId && currentCollegeName && record.collegeName) {
                    if (record.collegeName.trim().toLowerCase() !== currentCollegeName.toLowerCase()) {
                        throw new Error(`Data validation failed: You cannot import data for "${record.collegeName}". This record belongs to another college.`);
                    }
                }

                // Field Validation
                if (module === 'students' && (!record.name || !record.phone)) {
                    throw new Error('Name and Phone are required for students');
                }
                if (module === 'buses' && !record.busNumber) {
                    throw new Error('Bus Number is required');
                }
                if (module === 'drivers' && (!record.name || !record.email || !record.phone)) {
                    throw new Error('Name, Email and Phone are required for drivers');
                }
                if (module === 'routes' && (!record.name || !record.startPoint || !record.endPoint)) {
                    throw new Error('Route Name, Start Point and End Point are required');
                }

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
                            const col = await prisma.college.findFirst({
                                where: { name: { equals: record.collegeName, mode: 'insensitive' } }
                            });
                            effectiveCollegeId = col?.id;
                        }

                        let sBusId = record.busId;
                        if (!sBusId && record.busNumber) {
                            const bus = await prisma.bus.findUnique({ where: { busNumber: record.busNumber } });
                            sBusId = bus?.id;
                        }

                        if (!effectiveCollegeId) throw new Error(`College ${record.collegeName || record.collegeId} not found`);

                        const studentInput = {
                            studentId: record.studentId || null,
                            name: record.name,
                            email: record.email || null,
                            phone: record.phone,
                            status: record.status ? (record.status.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') : 'ACTIVE',
                            collegeId: effectiveCollegeId,
                            busId: sBusId || null,
                            pickupStop: record.pickupStop || null,
                            department: record.department || null,
                            year: record.year || null,
                            profilePictureUrl: record.profilePictureUrl || record.imageUrl || null
                        };

                        if (record.email) {
                            await prisma.student.upsert({
                                where: { email: record.email },
                                update: studentInput as any,
                                create: studentInput as any
                            });
                        } else {
                            await prisma.student.create({ data: studentInput as any });
                        }
                        break;

                    case 'buses':
                        let bEffectiveCollegeId = collegeId || record.collegeId;
                        if (!bEffectiveCollegeId && record.collegeName) {
                            const col = await prisma.college.findFirst({
                                where: { name: { equals: record.collegeName, mode: 'insensitive' } }
                            });
                            bEffectiveCollegeId = col?.id;
                        }
                        if (!bEffectiveCollegeId) throw new Error(`College ${record.collegeName || record.collegeId} not found`);

                        const busRouteNames = record.routeName ? record.routeName.split('|').map((rn: string) => rn.trim()) : [];
                        const bRouteIds: string[] = [];

                        for (const rn of busRouteNames) {
                            const route = await prisma.route.findFirst({
                                where: {
                                    name: { equals: rn, mode: 'insensitive' },
                                    collegeId: bEffectiveCollegeId
                                }
                            });
                            if (route) bRouteIds.push(route.id);
                        }

                        const statusInput = record.status ? record.status.toUpperCase() : 'ACTIVE';
                        const busStatus = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'].includes(statusInput) ? statusInput : 'ACTIVE';

                        const busData = {
                            capacity: parseInt(record.capacity) || 0,
                            title: record.title || null,
                            description: record.description || null,
                            status: busStatus as any,
                            collegeId: bEffectiveCollegeId,
                            imageUrl: record.imageUrl || null,
                        };

                        await prisma.bus.upsert({
                            where: { busNumber: record.busNumber },
                            update: {
                                ...busData,
                                busRoutes: {
                                    deleteMany: {},
                                    create: bRouteIds.map(rId => ({
                                        route: { connect: { id: rId } }
                                    }))
                                }
                            },
                            create: {
                                busNumber: record.busNumber,
                                ...busData,
                                busRoutes: {
                                    create: bRouteIds.map(rId => ({
                                        route: { connect: { id: rId } }
                                    }))
                                }
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

                        const routeData = {
                            name: record.name,
                            startPoint: record.startPoint,
                            startAddress: record.startAddress || null,
                            startLat: record.startLat ? parseFloat(record.startLat) : null,
                            startLng: record.startLng ? parseFloat(record.startLng) : null,
                            endPoint: record.endPoint,
                            endAddress: record.endAddress || null,
                            endLat: record.endLat ? parseFloat(record.endLat) : null,
                            endLng: record.endLng ? parseFloat(record.endLng) : null,
                            startTime: record.departureTime || record.startTime || null,
                            reverseStartTime: record.reverseDepartureTime || record.reverseStartTime || null,
                            endTime: record.arrivalTime || record.endTime || null,
                            reverseEndTime: record.reverseArrivalTime || record.reverseEndTime || null,
                            distance: record.distance ? parseFloat(record.distance) : null,
                            duration: record.duration ? parseInt(record.duration) : null,
                            status: record.status ? (record.status.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') : 'ACTIVE',
                            collegeId: rEffectiveCollegeId,
                            stops: record.stops ? record.stops.split('|').map((s: string) => {
                                const trimmed = s.trim();
                                let namePart = trimmed;
                                let expectedTime = null;
                                let reverseExpectedTime = null;
                                let address = null;
                                let lat = null, lng = null, revLat = null, revLng = null;

                                if (trimmed.includes('@')) {
                                    const parts = trimmed.split('@');
                                    namePart = parts[0].trim();
                                    const times = parts[1].trim().split(';');
                                    expectedTime = times[0]?.trim() || null;
                                    reverseExpectedTime = times[1]?.trim() || null;
                                }

                                if (namePart.includes('#')) {
                                    const parts = namePart.split('#');
                                    namePart = parts[0].trim();
                                    address = parts[1].trim();
                                }

                                if (namePart.includes(':')) {
                                    const [name, coordsPart] = namePart.split(':');
                                    namePart = name.trim();
                                    const coords = coordsPart.split(';');
                                    if (coords[0]) {
                                        const [fl, flg] = coords[0].split(',');
                                        if (fl && flg) {
                                            lat = parseFloat(fl); lng = parseFloat(flg);
                                        }
                                    }
                                    if (coords[1]) {
                                        const [rl, rlg] = coords[1].split(',');
                                        if (rl && rlg) {
                                            revLat = parseFloat(rl); revLng = parseFloat(rlg);
                                        }
                                    }
                                }

                                return { 
                                    name: namePart, 
                                    address: address, 
                                    latitude: lat, longitude: lng, 
                                    reverseLat: revLat, reverseLng: revLng, 
                                    expectedTime: expectedTime, reverseExpectedTime: reverseExpectedTime 
                                };
                            }) : []
                        };

                        await prisma.route.upsert({
                            where: { id: record.id || 'new-route-' + Date.now() }, // Use ID if provided, else create new
                            update: routeData as any,
                            create: routeData as any
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

    async getSampleFormat(module: string) {
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
                    studentId: 'STU12345',
                    name: 'Rahul Sharma',
                    email: 'rahul@example.com',
                    phone: '9876543210',
                    collegeName: 'Example College',
                    busNumber: 'BUS-001',
                    pickupStop: 'Main Gate Stop',
                    department: 'Computer Science',
                    year: '3rd Year',
                    status: 'ACTIVE',
                    profilePictureUrl: 'https://example.com/rahul.jpg'
                }]);

            case 'buses':
                return json2csv([{
                    busNumber: 'BUS-001',
                    capacity: 50,
                    title: 'Express Bus',
                    description: 'Bus for morning routes',
                    collegeName: 'Example College',
                    routeName: 'Morning Route 1 | Evening Route 1',
                    status: 'ACTIVE',
                    imageUrl: 'https://example.com/bus.jpg'
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
                return json2csv([
                    {
                        name: 'Bangalore North Route',
                        startPoint: 'Majestic Bus Stand',
                        startAddress: 'Majestic, Bangalore, Karnataka',
                        departureTime: '08:00',
                        reverseDepartureTime: '17:00',
                        startLat: 12.9716,
                        startLng: 77.5946,
                        endPoint: 'BIT Campus',
                        endAddress: 'BIT Campus, Kengeri, Bangalore',
                        arrivalTime: '09:00',
                        reverseArrivalTime: '16:00',
                        endLat: 12.9081,
                        endLng: 77.5023,
                        collegeName: 'Example College',
                        distance: 12.5,
                        duration: 60,
                        stops: 'Stop A:12.95,77.55;12.951,77.551#Old Airport Road@08:15;16:45 | Stop B:12.92,77.52#Kengeri Satellite Town@08:45',
                        status: 'ACTIVE'
                    },
                    {
                        name: 'Chennai East Route',
                        startPoint: 'Adyar Bus Stand',
                        startAddress: 'Adyar, Chennai, Tamil Nadu',
                        departureTime: '07:30',
                        reverseDepartureTime: '',
                        startLat: 13.0067,
                        startLng: 80.2506,
                        endPoint: 'VIT Campus',
                        endAddress: 'VIT Campus, Kelambakkam, Chennai',
                        arrivalTime: '08:45',
                        reverseArrivalTime: '',
                        endLat: 12.8396,
                        endLng: 80.1264,
                        collegeName: 'Example College',
                        distance: 30.5,
                        duration: 75,
                        stops: 'Stop C:12.90,80.18#OMR Tech Junction@08:00 | Stop D:12.86,80.15#Sathyabama Junction@08:20',
                        status: 'ACTIVE'
                    }
                ]);
            default:
                throw new Error('Invalid module');
        }
    }
}

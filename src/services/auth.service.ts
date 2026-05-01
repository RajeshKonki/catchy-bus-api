import prisma from '../config/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { emailService } from './email.service';
import { smsService } from './sms.service';
import { s3Service } from './s3.service';

export class AuthService {
    async loginAdmin(email: string, password: string) {
        const admin = await prisma.admin.findUnique({ where: { email } });
        if (!admin) throw new Error('Invalid credentials');

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) throw new Error('Invalid credentials');

        const token = jwt.sign(
            { id: admin.id, role: admin.role, type: 'admin' },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1d' }
        );

        return {
            token,
            user: {
                id: admin.id,
                email: admin.email,
                fullName: admin.fullName || '',
                name: admin.fullName || '',
                role: admin.role
            }
        };
    }

    async loginCollege(email: string, password: string) {
        const college = await prisma.college.findUnique({ where: { loginEmail: email } });
        if (!college) throw new Error('Invalid credentials');
        if (!college.availability) throw new Error('College panel is disabled');

        const now = new Date();
        if (college.subscriptionEnd && now > new Date(college.subscriptionEnd)) {
            throw new Error('College subscription has expired. Please contact support.');
        }
        if (college.subscriptionStart && now < new Date(college.subscriptionStart)) {
            const startDate = new Date(college.subscriptionStart).toLocaleDateString();
            throw new Error(`College subscription has not started yet. Access will be available from ${startDate}.`);
        }

        if (password !== college.loginPassword) throw new Error('Invalid credentials');

        const token = jwt.sign(
            { id: college.id, type: 'college' },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1d' }
        );

        return {
            token,
            user: {
                id: college.id,
                name: college.name,
                email: college.email,
                collegeName: college.name,
                collegeLogo: college.imageUrl || '',
                collegeAddress: college.address || '',
                subscriptionStart: college.subscriptionStart,
                subscriptionType: college.subscriptionType,
                subscriptionEnd: college.subscriptionEnd
            }
        };
    }

    async collegeForgotPassword(email: string) {
        const college = await prisma.college.findUnique({ where: { loginEmail: email } });
        if (!college) throw new Error('No college account found with this email');

        console.log(`[Forgot Password] Sending credentials for ${college.loginEmail}. Password: ${college.loginPassword}`);
        await emailService.sendEmail(
            college.email,
            college.name,
            'College Login Credentials',
            `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2>Welcome to Catchy Bus</h2>
                <p>Hello ${college.name},</p>
                <p>You recently requested your login credentials for the Catchy Bus College Panel.</p>
                <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Login Email:</strong> ${college.loginEmail}</p>
                    <p style="margin: 5px 0;"><strong>Password:</strong> ${college.loginPassword}</p>
                </div>
                <p>Please use these credentials to log in at the portal.</p>
                <p>If you didn't request this, please contact support immediately.</p>
                <p>Regards,<br>Catchy Bus Team</p>
            </div>
            `
        );

        return { message: 'Password has been sent to your primary email address' };
    }


    async loginWithFirebase(idToken: string, role: 'student' | 'parent' | 'driver', selectedUserId?: string) {
        const { phone: firebasePhone } = await smsService.verifyFirebaseToken(idToken);
        if (!firebasePhone) throw new Error('Phone number not found in token');

        // Create phone variations to search
        const phoneVariants = [firebasePhone];
        if (firebasePhone.startsWith('+91')) {
            phoneVariants.push(firebasePhone.substring(3));
        } else if (firebasePhone.length === 10) {
            phoneVariants.push(`+91${firebasePhone}`);
        }

        console.log(`[Auth] Firebase verified phone: ${firebasePhone}`);
        console.log(`[Auth] Role: ${role}, Variants being searched: ${JSON.stringify(phoneVariants)}`);

        if (role === 'driver') {
            const driver = await prisma.driver.findFirst({
                where: { phone: { in: phoneVariants } },
                include: { college: true, bus: true }
            });

            if (!driver) {
                console.log(`[Auth] ❌ NO DRIVER match found for variants ${JSON.stringify(phoneVariants)}`);
                throw new Error('No driver account found with this phone number.');
            }
            console.log(`[Auth] ✅ Found driver: ${driver.name} (ID: ${driver.id})`);
            if (driver.status !== 'ACTIVE') throw new Error('Account inactive. Please contact support.');

            // Check College Subscription
            if (driver.college) {
                const now = new Date();
                if (!driver.college.availability) throw new Error('College panel is disabled');
                if (driver.college.subscriptionEnd && now > new Date(driver.college.subscriptionEnd)) {
                    throw new Error('College subscription has expired. Please contact your college.');
                }
                if (driver.college.subscriptionStart && now < new Date(driver.college.subscriptionStart)) {
                    throw new Error('College subscription has not started yet.');
                }
            }

            const token = jwt.sign(
                { id: driver.id, type: 'driver', collegeId: driver.collegeId },
                process.env.JWT_SECRET || 'secret',
                { expiresIn: '30d' }
            );

            return {
                token,
                user: {
                    id: driver.id,
                    name: driver.name,
                    email: driver.email || '',
                    phone: driver.phone,
                    type: 'driver',
                    college: driver.college?.name || '',
                    collegeImageUrl: driver.college?.imageUrl || '',
                    busId: driver.busId || '',
                    busNumber: driver.bus?.busNumber || '',
                    isMultiAccount: false,
                    accounts: []
                }
            };
        }

        // Handle student/parent role
        const students = await prisma.student.findMany({
            where: { phone: { in: phoneVariants } },
            include: { college: true, bus: true }
        });

        if (students.length === 0) throw new Error('No student account found with this phone number.');

        let primaryStudent = students[0];
        if (selectedUserId) {
            primaryStudent = students.find(s => s.id === selectedUserId) || students[0];
        }

        if (primaryStudent.status !== 'ACTIVE') throw new Error('Account inactive. Please contact support.');

        // Check College Subscription
        if (primaryStudent.college) {
            const now = new Date();
            if (!primaryStudent.college.availability) throw new Error('College panel is disabled');
            if (primaryStudent.college.subscriptionEnd && now > new Date(primaryStudent.college.subscriptionEnd)) {
                throw new Error('College subscription has expired. Please contact your college.');
            }
            if (primaryStudent.college.subscriptionStart && now < new Date(primaryStudent.college.subscriptionStart)) {
                throw new Error('College subscription has not started yet.');
            }
        }

        const token = jwt.sign(
            { id: primaryStudent.id, type: role, collegeId: primaryStudent.collegeId },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '30d' }
        );

        return {
            token,
            user: {
                id: primaryStudent.id,
                name: primaryStudent.name,
                email: primaryStudent.email || '',
                phone: primaryStudent.phone,
                type: role,
                college: primaryStudent.college?.name || '',
                collegeImageUrl: primaryStudent.college?.imageUrl || '',
                busId: primaryStudent.busId || '',
                busNumber: primaryStudent.bus?.busNumber || '',
                studentId: primaryStudent.studentId || '',
                department: (primaryStudent as any).department || '',
                year: (primaryStudent as any).year || '',
                isMultiAccount: students.length > 1,
                accounts: students.map(s => ({
                    id: s.id,
                    name: s.name,
                    type: role,
                    phone: s.phone,
                    college: s.college?.name || '',
                    busId: s.busId || '',
                    busNumber: s.bus?.busNumber || '',
                    studentId: s.studentId || '',
                    department: (s as any).department || '',
                    year: (s as any).year || '',
                    profilePictureUrl: s.profilePictureUrl || '',
                    collegeImageUrl: s.college?.imageUrl || ''
                }))
            }
        };
    }



    async getMe(id: string, type: string) {
        if (type === 'admin') {
            const admin = await prisma.admin.findUnique({
                where: { id },
                select: { id: true, email: true, fullName: true, role: true, photoUrl: true }
            });
            if (admin) {
                return {
                    ...admin,
                    fullName: admin.fullName || '',
                    name: admin.fullName || '',
                    photoUrl: admin.photoUrl || ''
                };
            }
        } else if (type === 'college') {
            const college = await prisma.college.findUnique({
                where: { id },
                select: {
                    id: true, name: true, email: true, loginEmail: true,
                    imageUrl: true, address: true,
                    subscriptionStart: true, subscriptionType: true, subscriptionEnd: true
                }
            });
            if (college) {
                return {
                    ...college,
                    collegeName: college.name || '',
                    collegeLogo: college.imageUrl || '',
                    collegeAddress: college.address || ''
                };
            }
        } else if (type === 'driver') {
            const driver = await prisma.driver.findUnique({
                where: { id },
                include: { college: true, bus: true }
            });
            if (driver) {
                return {
                    id: driver.id,
                    name: driver.name,
                    email: driver.email || '',
                    phone: driver.phone,
                    type: 'driver',
                    college: driver.college?.name || '',
                    busId: driver.busId || '',
                    busNumber: driver.bus?.busNumber || '',
                    profilePictureUrl: driver.photoUrl || '',
                    collegeImageUrl: driver.college?.imageUrl || ''
                };
            }
        } else if (type === 'student' || type === 'parent') {
            const student = await prisma.student.findUnique({
                where: { id },
                include: { college: true, bus: true }
            });
            if (student) {
                // Determine phone variants to find siblings
                const phone = student.phone;
                const phoneVariants = [phone];
                if (phone.startsWith('+91')) { phoneVariants.push(phone.substring(3)); }
                else if (phone.length === 10) { phoneVariants.push(`+91${phone}`); }

                const allStudents = await prisma.student.findMany({
                    where: { phone: { in: phoneVariants } },
                    include: { college: true, bus: true }
                });

                return {
                    id: student.id,
                    name: student.name,
                    email: student.email || '',
                    phone: student.phone,
                    type: type,
                    college: student.college?.name || '',
                    busId: student.busId || '',
                    busNumber: student.bus?.busNumber || '',
                    studentId: student.studentId || '',
                    department: (student as any).department || '',
                    year: (student as any).year || '',
                    profilePictureUrl: student.profilePictureUrl || '',
                    collegeImageUrl: student.college?.imageUrl || '',
                    isMultiAccount: allStudents.length > 1,
                    accounts: allStudents.map(s => ({
                        id: s.id,
                        name: s.name,
                        type: type,
                        phone: s.phone,
                        college: s.college?.name || '',
                        busId: s.busId || '',
                        busNumber: s.bus?.busNumber || '',
                        studentId: s.studentId || '',
                        department: (s as any).department || '',
                        year: (s as any).year || '',
                        profilePictureUrl: s.profilePictureUrl || '',
                        collegeImageUrl: s.college?.imageUrl || ''
                    }))
                };
            }
        }
        return null;
    }
    async updateMe(id: string, type: string, data: any) {
        if (type === 'admin') {
            let photoUrl = data.photoUrl || data.avatar;
            if (photoUrl && photoUrl.startsWith('data:image')) {
                photoUrl = await s3Service.uploadImage(photoUrl, 'admins');
            }

            const updatedAdmin = await prisma.admin.update({
                where: { id },
                data: {
                    fullName: data.fullName,
                    email: data.email,
                    ...(photoUrl ? { photoUrl } : {})
                },
                select: { id: true, email: true, fullName: true, role: true, photoUrl: true }
            });
            return {
                ...updatedAdmin,
                name: updatedAdmin.fullName || ''
            };
        } else if (type === 'college') {
            let imageUrl = data.imageUrl || data.avatar;
            if (imageUrl && imageUrl.startsWith('data:image')) {
                imageUrl = await s3Service.uploadImage(imageUrl, 'colleges');
            }

            const updatedCollege = await prisma.college.update({
                where: { id },
                data: {
                    name: data.name,
                    email: data.email,
                    ...(imageUrl ? { imageUrl } : {})
                },
                select: {
                    id: true, name: true, email: true, loginEmail: true,
                    imageUrl: true, address: true,
                    subscriptionStart: true, subscriptionType: true, subscriptionEnd: true
                }
            });
            return {
                ...updatedCollege,
                collegeName: updatedCollege.name || '',
                collegeLogo: updatedCollege.imageUrl || ''
            };
        } else if (type === 'driver') {
            let photoUrl = data.profilePictureUrl || data.photoUrl;
            if (photoUrl) {
                photoUrl = await s3Service.uploadImage(photoUrl, 'drivers');
            }

            const driver = await prisma.driver.update({
                where: { id },
                data: {
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    ...(data.password ? { password: data.password } as any : {}),
                    photoUrl: photoUrl
                },
                include: { college: true, bus: true }
            });
            return {
                id: driver.id,
                name: driver.name,
                email: driver.email || '',
                phone: driver.phone,
                type: 'driver',
                college: driver.college?.name || '',
                busId: driver.busId || '',
                busNumber: driver.bus?.busNumber || '',
                profilePictureUrl: driver.photoUrl || ''
            };
        } else if (type === 'student' || type === 'parent') {
            let profilePictureUrl = data.profilePictureUrl;
            if (profilePictureUrl) {
                profilePictureUrl = await s3Service.uploadImage(profilePictureUrl, 'students');
            }

            const student = await prisma.student.update({
                where: { id },
                data: {
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    ...(data.password ? { password: data.password } as any : {}),
                    profilePictureUrl: profilePictureUrl
                },
                include: { college: true, bus: true }
            });
            return {
                id: student.id,
                name: student.name,
                email: student.email || '',
                phone: student.phone,
                type: type,
                college: student.college?.name || '',
                busId: student.busId || '',
                busNumber: student.bus?.busNumber || '',
                profilePictureUrl: student.profilePictureUrl || ''
            };
        }
        return null;
    }

    async checkPhoneInSystem(phone: string, role: string): Promise<{ exists: boolean }> {
        const phoneVariants = [phone];
        if (phone.startsWith('+91')) {
            phoneVariants.push(phone.substring(3));
        } else if (phone.length === 10) {
            phoneVariants.push(`+91${phone}`);
        }

        if (role === 'driver') {
            const driver = await prisma.driver.findFirst({
                where: { phone: { in: phoneVariants } },
                include: { college: true }
            });

            if (driver?.college) {
                const now = new Date();
                if (!driver.college.availability) return { exists: false };
                if (driver.college.subscriptionEnd && now > new Date(driver.college.subscriptionEnd)) return { exists: false };
                if (driver.college.subscriptionStart && now < new Date(driver.college.subscriptionStart)) return { exists: false };
            }

            return { exists: !!driver };
        }

        // student / parent
        const student = await prisma.student.findFirst({
            where: { phone: { in: phoneVariants } },
            include: { college: true }
        });

        if (student?.college) {
            const now = new Date();
            if (!student.college.availability) return { exists: false };
            if (student.college.subscriptionEnd && now > new Date(student.college.subscriptionEnd)) return { exists: false };
            if (student.college.subscriptionStart && now < new Date(student.college.subscriptionStart)) return { exists: false };
        }

        return { exists: !!student };
    }

    async updateFcmToken(id: string, type: string, fcmToken: string) {
        if (type === 'student' || type === 'parent') {
            await prisma.student.update({
                where: { id },
                data: { fcmToken }
            });
        } else if (type === 'driver') {
            await prisma.driver.update({
                where: { id },
                data: { fcmToken }
            });
        }
    }
}

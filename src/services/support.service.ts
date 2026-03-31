import prisma from '../config/db';
import { emailService } from './email.service';

export class SupportService {

    async sendSupportQuery(userId: string | undefined, type: string | undefined, query: string, subject: string = 'New Support Query', guestEmail?: string) {
        let senderName = 'Guest';
        let senderEmail = guestEmail || 'Not Provided';
        let senderRole = type || 'Guest';
        let targetCollegeEmail: string | null = null;
        let collegeName = 'N/A';

        if (userId && type) {
            if (type === 'college') {
                const college = await prisma.college.findUnique({ where: { id: userId } });
                if (college) {
                    senderName = college.name;
                    senderEmail = college.email;
                    collegeName = college.name;
                    // For college-admin queries, still send to system admins or itself
                }
            } else if (type === 'driver') {
                const driver = await prisma.driver.findUnique({
                    where: { id: userId },
                    include: { college: true }
                });
                if (driver) {
                    senderName = driver.name;
                    senderEmail = driver.email;
                    senderRole = 'Driver';
                    collegeName = driver.college?.name || 'N/A';
                    targetCollegeEmail = driver.college?.email || null;
                }
            } else if (type === 'student' || type === 'parent') {
                const student = await prisma.student.findUnique({
                    where: { id: userId },
                    include: { college: true }
                });
                if (student) {
                    senderName = student.name;
                    senderEmail = student.email || 'N/A';
                    senderRole = type === 'student' ? 'Student' : 'Parent';
                    collegeName = student.college?.name || 'N/A';
                    targetCollegeEmail = student.college?.email || null;
                }
            }
        }

        const admins = await prisma.admin.findMany({
            where: { role: 'superadmin' }
        });

        const adminEmails = admins.map(admin => admin.email);
        
        // Final recipient list
        const recipients = new Set<string>(adminEmails);
        if (targetCollegeEmail) recipients.add(targetCollegeEmail);

        console.log(`Support Query: From ${senderName} (${senderRole}), Recipients:`, Array.from(recipients));

        if (recipients.size === 0) {
            console.warn('No recipients found to send support query to.');
            return { success: true, message: 'Query received, but no recipients configured.' };
        }

        const html = `
            <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">Catchy Bus Support Help Desk</h2>
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <p style="margin: 5px 0;"><strong>Sender Name:</strong> ${senderName}</p>
                    <p style="margin: 5px 0;"><strong>Sender Role:</strong> ${senderRole}</p>
                    <p style="margin: 5px 0;"><strong>Sender Email:</strong> ${senderEmail}</p>
                    <p style="margin: 5px 0;"><strong>Associated College:</strong> ${collegeName}</p>
                </div>
                <hr style="border: none; border-top: 1px solid #e2e8f0;"/>
                <p><strong>Subject:</strong> ${subject}</p>
                <p><strong>Query Content:</strong></p>
                <div style="background: #fff; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; font-style: italic;">
                    ${query.replace(/\n/g, '<br/>')}
                </div>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 20px;"/>
                <p style="font-size: 12px; color: #64748b;">This email was automatically generated from the Catchy Bus Mobile App Help Desk.</p>
            </div>
        `;

        try {
            for (const email of recipients) {
                await emailService.sendEmail(
                    email,
                    'Catchy Bus Admin',
                    `[Help Desk] ${subject} - ${senderName} (${senderRole})`,
                    html
                );
            }
            return { success: true, message: 'Support query sent successfully to college and admin' };
        } catch (error) {
            console.error('Error sending support email:', error);
            throw new Error('Failed to send support email');
        }
    }
}

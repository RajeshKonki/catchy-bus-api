import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth.middleware';

const prisma = new PrismaClient();

/** Returns subscription status info for a given collegeId */
export async function getCollegeSubscriptionStatus(collegeId: string) {
    const college = await prisma.college.findUnique({
        where: { id: collegeId },
        select: {
            id: true,
            name: true,
            availability: true,
            subscriptionStart: true,
            subscriptionEnd: true,
        },
    });

    if (!college) return { valid: false, reason: 'College not found.' };
    if (!college.availability) return { valid: false, reason: 'College panel is disabled.' };

    const now = new Date();

    if (college.subscriptionStart && now < new Date(college.subscriptionStart)) {
        const startDate = new Date(college.subscriptionStart).toLocaleDateString('en-IN');
        return { valid: false, reason: `Subscription has not started yet. Access available from ${startDate}.` };
    }

    if (college.subscriptionEnd) {
        const endDate = new Date(college.subscriptionEnd);
        if (now > endDate) {
            return {
                valid: false,
                reason: `Subscription expired on ${endDate.toLocaleDateString('en-IN')}. Please contact support to renew.`,
            };
        }

        // Warn if expiring within 30 days
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 30) {
            return {
                valid: true,
                warning: true,
                daysLeft,
                message: `Your subscription will expire in ${daysLeft} day${daysLeft === 1 ? '' : 's'} on ${endDate.toLocaleDateString('en-IN')}. Please renew soon.`,
            };
        }
    }

    return { valid: true, warning: false };
}

/**
 * Middleware: enforces active subscription for college / student / driver tokens.
 * Must be placed AFTER authenticateJWT so req.user is populated.
 *
 * - college tokens  → check by user.id (college id in JWT)
 * - student/driver  → check by user.collegeId (set during login)
 * - admin tokens    → always pass through
 */
export const requireActiveSubscription = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized.' });

    // Admins bypass all subscription checks
    if (user.type === 'admin') return next();

    let collegeId: string | undefined;

    if (user.type === 'college') {
        collegeId = user.id;
    } else if (user.type === 'student' || user.type === 'driver' || user.type === 'parent') {
        collegeId = user.collegeId;
    }

    if (!collegeId) return next(); // No college context – let through (e.g. public endpoints)

    try {
        const status = await getCollegeSubscriptionStatus(collegeId);

        if (!status.valid) {
            return res.status(403).json({
                message: status.reason,
                code: 'SUBSCRIPTION_INACTIVE',
            });
        }

        // Attach warning to request so controllers can forward it to responses
        if (status.warning) {
            (req as any).subscriptionWarning = {
                daysLeft: status.daysLeft,
                message: status.message,
            };
        }

        next();
    } catch (err: any) {
        console.error('[Subscription Middleware] Error:', err.message);
        next(); // Don't block on DB errors – fail open
    }
};

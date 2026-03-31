import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: any;
}

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
    console.log('--- AUTHENTICATE JWT ---');
    const token = req.header('Authorization')?.split(' ')[1];

    if (!token) {
        console.log('No token provided');
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        console.log('Token verified, user:', (decoded as any).id);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token verification failed:', error);
        res.status(400).json({ message: 'Invalid token.' });
    }
};

export const authorizeRoles = (roles: string[]) => {
    return (req: any, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role || req.user.type)) {
            return res.status(403).json({ message: 'Access denied. Unauthorized role.' });
        }
        next();
    };
};

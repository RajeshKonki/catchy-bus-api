import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export class AuthController {
    async adminLogin(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            const result = await authService.loginAdmin(email, password);
            res.json(result);
        } catch (error: any) {
            res.status(401).json({ message: error.message });
        }
    }

    async collegeLogin(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            const result = await authService.loginCollege(email, password);
            res.json(result);
        } catch (error: any) {
            res.status(401).json({ message: error.message });
        }
    }

    async getMe(req: Request, res: Response) {
        try {
            // @ts-ignore
            const { id, type } = req.user;
            const user = await authService.getMe(id, type);
            if (!user) return res.status(404).json({ message: 'User not found' });
            res.json(user);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
    async updateProfile(req: Request, res: Response) {
        try {
            // @ts-ignore
            const { id, type } = req.user;
            const user = await authService.updateMe(id, type, req.body);
            res.json(user);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
}

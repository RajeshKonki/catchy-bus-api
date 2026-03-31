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

    async collegeForgotPassword(req: Request, res: Response) {
        try {
            const { email } = req.body;
            console.log(`[Controller] Handling forgot password for: ${email}`);
            const result = await authService.collegeForgotPassword(email);
            console.log(`[Controller] Forgot password processed successfully, sending response.`);
            res.json(result);
        } catch (error: any) {
            console.error(`[Controller] Error in forgot password:`, error.message);
            res.status(400).json({ message: error.message });
        }
    }

    async studentLogin(req: Request, res: Response) {
        try {
            const { idToken, role, selectedUserId } = req.body;

            if (!idToken) {
                return res.status(400).json({ message: 'idToken is required for login' });
            }

            const result = await authService.loginWithFirebase(idToken, role || 'student', selectedUserId);
            res.json(result);
        } catch (error: any) {
            res.status(401).json({ message: error.message });
        }
    }

    async parentLogin(req: Request, res: Response) {
        try {
            const { idToken, selectedUserId } = req.body;

            if (!idToken) {
                return res.status(400).json({ message: 'idToken is required for login' });
            }

            const result = await authService.loginWithFirebase(idToken, 'parent', selectedUserId);
            res.json(result);
        } catch (error: any) {
            res.status(401).json({ message: error.message });
        }
    }

    async driverLogin(req: Request, res: Response) {
        try {
            const { idToken, role, selectedUserId } = req.body;

            if (!idToken) {
                return res.status(400).json({ message: 'idToken is required for login' });
            }

            const result = await authService.loginWithFirebase(idToken, role || 'driver', selectedUserId);
            res.json(result);
        } catch (error: any) {
            res.status(401).json({ message: error.message });
        }
    }

    async checkPhone(req: Request, res: Response) {
        try {
            const { phone, role } = req.body;
            if (!phone || !role) {
                return res.status(400).json({ message: 'phone and role are required' });
            }
            const result = await authService.checkPhoneInSystem(phone, role);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
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

    async updateFcmToken(req: Request, res: Response) {
        try {
            // @ts-ignore
            const { id, type } = req.user;
            const { fcmToken } = req.body;
            await authService.updateFcmToken(id, type, fcmToken);
            res.json({ message: 'FCM token updated successfully' });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
}

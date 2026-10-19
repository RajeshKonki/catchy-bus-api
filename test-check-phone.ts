import { AuthService } from './src/services/auth.service';

async function run() {
    const authService = new AuthService();
    try {
        const res = await authService.checkPhoneInSystem('9999999999', 'student');
        console.log('Result:', res);
    } catch (e) {
        console.error('Error:', e);
    }
}
run();

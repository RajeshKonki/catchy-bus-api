import * as SibApiV3Sdk from '@getbrevo/brevo';
import admin, { initializeFirebase } from '../config/firebase';

export class SmsService {
    private apiInstance: any;

    constructor() {
        // Brevo setup for general SMS (not Firebase Auth)
        this.apiInstance = new (SibApiV3Sdk as any).TransactionalSMSApi();
        this.apiInstance.setApiKey((SibApiV3Sdk as any).TransactionalSMSApiApiKeys.apiKey, process.env.BREVO_API_KEY || '');
    }

    /**
     * Verifies a Firebase ID Token received from a client after Phone Auth
     * @param idToken The token from the client
     * @returns The verified phone number and user UID
     */
    async verifyFirebaseToken(idToken: string) {
        try {
            console.log('🔍 Verifying Firebase token...');
            // Ensure Firebase is initialized
            initializeFirebase();
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            console.log('✅ Token verified for phone:', decodedToken.phone_number);
            return {
                uid: decodedToken.uid,
                phone: decodedToken.phone_number
            };
        } catch (error: any) {
            console.error('❌ Firebase token verification failed!');
            console.error('Error Code:', error.code);
            console.error('Error Message:', error.message);
            throw new Error(`Invalid Firebase token: ${error.message}`);
        }
    }

    /**
     * Sends a transactional SMS using Brevo (fallback/alternative to Firebase)
     */
    async sendSms(phoneNumber: string, content: string) {
        if (!process.env.BREVO_API_KEY) {
            console.warn('BREVO_API_KEY is not set. Skipping SMS send.');
            return null;
        }

        const sendTransacSms = new (SibApiV3Sdk as any).SendTransacSms();
        sendTransacSms.sender = "CatchyBus";
        sendTransacSms.recipient = phoneNumber;
        sendTransacSms.content = content;

        try {
            const data = await this.apiInstance.sendTransacSms(sendTransacSms);
            console.log(`SMS sent successfully to ${phoneNumber}`);
            return data;
        } catch (error: any) {
            console.error('Failed to send SMS via Brevo:', error.response?.text || error.message);
            throw new Error('Failed to send SMS');
        }
    }
}

export const smsService = new SmsService();

import * as SibApiV3Sdk from '@getbrevo/brevo';

export class EmailService {
    private apiInstance: any;

    constructor() {
        this.apiInstance = new (SibApiV3Sdk as any).TransactionalEmailsApi();
        this.apiInstance.setApiKey((SibApiV3Sdk as any).TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY || '');
    }

    async sendEmail(toEmail: string, toName: string, subject: string, htmlContent: string) {
        if (!process.env.BREVO_API_KEY) {
            console.warn('BREVO_API_KEY is not set. Skipping email send.');
            return null;
        }

        const sendSmtpEmail = new (SibApiV3Sdk as any).SendSmtpEmail();
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = htmlContent;
        sendSmtpEmail.sender = { name: "Catchy Bus App", email: "shaiktowsiq@gmail.com" };
        sendSmtpEmail.to = [{ email: toEmail, name: toName }];

        try {
            console.log(`Attempting to send email to ${toEmail} from ${sendSmtpEmail.sender.email}`);
            const data = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
            console.log(`Email sent successfully to ${toEmail}. Message ID: ${data.body?.messageId || 'N/A'}`);
            return data;
        } catch (error: any) {
            console.error('Failed to send email via Brevo:', {
                error: error.response?.text || error.message || error,
                statusCode: error.response?.statusCode,
                body: error.response?.body
            });
            throw new Error('Failed to send email');
        }
    }
}

export const emailService = new EmailService();

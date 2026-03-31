import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import crypto from "crypto";

export class S3Service {
    private s3Client: S3Client | null = null;
    private bucketName: string;
    private region: string;

    constructor() {
        this.bucketName = process.env.AWS_S3_BUCKET_NAME || "";
        this.region = process.env.AWS_REGION || "ap-south-2";

        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            this.s3Client = new S3Client({
                region: this.region,
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                },
            });
        } else {
            console.warn("AWS credentials not found. S3 uploads will be disabled.");
        }
    }

    async uploadImage(base64Data: string, folder: string = "general"): Promise<string> {
        // If s3 is not configured or data is already a URL or empty, return as is
        if (!this.s3Client || !this.bucketName || !base64Data || typeof base64Data !== 'string' || base64Data.startsWith('http')) {
            return base64Data;
        }

        // Detect base64 pattern: data:image/png;base64,xxxx
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            // Not a data URL, return as is
            return base64Data;
        }

        const contentType = matches[1];
        const base64Content = matches[2];
        const buffer = Buffer.from(base64Content, 'base64');
        const extension = contentType.split('/')[1] || 'png';
        const fileName = `${folder}/${crypto.randomBytes(16).toString('hex')}.${extension}`;

        try {
            console.log(`📤 Uploading image to S3: ${fileName} (${contentType})`);
            const upload = new Upload({
                client: this.s3Client,
                params: {
                    Bucket: this.bucketName,
                    Key: fileName,
                    Body: buffer,
                    ContentType: contentType,
                    // ACL: 'public-read' // Uncomment if your bucket allows public ACLs
                },
            });

            await upload.done();
            const s3Url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${fileName}`;
            console.log(`✅ Image uploaded successfully: ${s3Url}`);
            return s3Url;
        } catch (error: any) {
            console.error("❌ S3 Upload Error:", error.message);
            // Return original base64 if upload fails to avoid data loss, 
            // though it's not ideal for the database.
            return base64Data;
        }
    }
}

export const s3Service = new S3Service();

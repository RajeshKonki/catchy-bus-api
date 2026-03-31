import * as admin from 'firebase-admin';
import * as fs from 'fs';

// This will be initialized with a service account file
// You should place your serviceAccountKey.json in the src/config folder
// and point the GOOGLE_APPLICATION_CREDENTIALS env var to it,
// or initialize it directly here.

import * as path from 'path';

const initializeFirebase = () => {
    try {
        if (!admin.apps.length) {
            // Check multiple potential locations for the service account file
            const potentialPaths = [
                process.env.FIREBASE_SERVICE_ACCOUNT_PATH, // Environment variable override
                path.resolve(__dirname, 'serviceAccountKey.json'), // Local to firebase.ts
                path.resolve(process.cwd(), 'serviceAccountKey.json'), // Project root
                path.resolve(process.cwd(), 'src/config/serviceAccountKey.json'), // Standard source location
            ].filter((p): p is string => !!p);

            let serviceAccountPath = '';
            for (const p of potentialPaths) {
                if (fs.existsSync(p)) {
                    serviceAccountPath = p;
                    break;
                }
            }
            
            if (!serviceAccountPath) {
                console.error('💣 Firebase service account file NOT FOUND. Searched in:', potentialPaths);
                // Don't throw here to allow the server to start (though Firebase features will fail)
                return;
            }

            console.log('📄 Loading Firebase service account from:', serviceAccountPath);
            const app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccountPath)
            });
            console.log('🔥 Firebase Admin initialized successfully');
            console.log('📂 Project ID:', app.options.projectId);
        } else {
            console.log('ℹ️ Firebase Admin already initialized');
        }
    } catch (error) {
        console.error('❌ Firebase Admin initialization error:', error);
        throw error; // Propagate the error so the server knows it failed
    }
};

export default admin;
export { initializeFirebase };

import admin from 'firebase-admin';

import config from './config.js';

function getServiceAccountCredentials() {
  if (config.FIREBASE_PRIVATE_KEY && config.FIREBASE_CLIENT_EMAIL) {
    return {
      type: 'service_account',
      project_id: config.FIREBASE_PROJECT_ID,
      private_key_id: config.FIREBASE_PRIVATE_KEY_ID,
      private_key: config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: config.FIREBASE_CLIENT_EMAIL,
      client_id: config.FIREBASE_CLIENT_ID,
      auth_uri: config.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
      token_uri: config.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url:
        config.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: config.FIREBASE_CLIENT_X509_CERT_URL,
      universe_domain: config.FIREBASE_UNIVERSE_DOMAIN || 'googleapis.com',
    };
  }
}

if (!admin.apps.length) {
  try {
    const serviceAccount = getServiceAccountCredentials();

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: config.FIREBASE_STORAGE_BUCKET || 'homescrew-b7b08.firebasestorage.app',
      projectId: config.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });

    console.log('✅ Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization failed:', error.message);
    throw error;
  }
}

// Export Firebase Admin services
export const bucket = admin.storage().bucket();
export const firestore = admin.firestore();
export const auth = admin.auth();
export const firebaseAdmin = admin;

export default admin;

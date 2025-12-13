import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Αποφυγή διπλής αρχικοποίησης (σημαντικό σε Next.js)
if (!getApps().length) {
  try {
    // Έλεγχος αν υπάρχει service account key
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_KEY not found - Admin SDK will not work');
      console.warn('💡 Add your service account JSON to .env.local');
    } else {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

      initializeApp({
        credential: cert(serviceAccount),
      });

      console.log('✅ Firebase Admin SDK initialized successfully');
    }
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization failed:', error);
    console.error('💡 Check your FIREBASE_SERVICE_ACCOUNT_KEY in .env.local');
  }
}

export const adminDb = getFirestore();
export const adminApp = getApps()[0]; // προαιρετικά
// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

type EnvValue = string | boolean | undefined;
type EnvMap = Record<string, EnvValue>;

const env = import.meta.env as EnvMap;

function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

const firebaseConfig = {
  apiKey: readEnv('VITE_FIREBASE_API_KEY', 'FIREBASE_API_KEY', 'EDGEONE_FIREBASE_API_KEY'),
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN', 'EDGEONE_FIREBASE_AUTH_DOMAIN'),
  databaseURL: readEnv('VITE_FIREBASE_DATABASE_URL', 'FIREBASE_DATABASE_URL', 'EDGEONE_FIREBASE_DATABASE_URL'),
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID', 'EDGEONE_FIREBASE_PROJECT_ID'),
  storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET', 'EDGEONE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_MESSAGING_SENDER_ID', 'EDGEONE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: readEnv('VITE_FIREBASE_APP_ID', 'FIREBASE_APP_ID', 'EDGEONE_FIREBASE_APP_ID'),
};

const missingConfigKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingConfigKeys.length > 0) {
  console.error(
    `[Firebase] Missing environment variables for: ${missingConfigKeys.join(', ')}. ` +
      'Set VITE_FIREBASE_* (recommended) or FIREBASE_* / EDGEONE_FIREBASE_* in your deployment environment.'
  );
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export const firestore = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export default app;

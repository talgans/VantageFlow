import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * Firebase Configuration
 * Environment variables should be set in .env.local
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Validate that all required environment variables are present
 */
const validateConfig = () => {
  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ];

  const missingVars = requiredVars.filter(
    (varName) => !import.meta.env[varName]
  );

  if (missingVars.length > 0) {
    console.warn(
      `Missing Firebase configuration variables: ${missingVars.join(', ')}\n` +
      'Please ensure all variables are set in .env.local'
    );
  }
};

// Validate configuration in development
if (import.meta.env.DEV) {
  validateConfig();
}

/**
 * Initialize Firebase App
 */
export const app = initializeApp(firebaseConfig);

/**
 * Firebase Authentication instance
 */
export const auth = getAuth(app);

/**
 * Firestore Database instance
 * Initialized with auto-detect long-polling to prevent ERR_QUIC_PROTOCOL_ERROR / QUIC_TOO_MANY_RTOS
 * stream drops when UDP / HTTP/3 connections experience retransmission timeouts or proxy buffering.
 */
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

/**
 * Firebase Storage instance
 */
export const storage = getStorage(app);

// Log initialization in development
if (import.meta.env.DEV) {
  console.log('✅ Firebase initialized:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
  });
}

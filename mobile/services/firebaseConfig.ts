import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
// @ts-expect-error getReactNativePersistence is exported in the React Native bundle of firebase/auth
import { initializeAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const rawApiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '';
const rawProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    rawApiKey &&
    rawApiKey.length > 10 &&
    !rawApiKey.includes('your-api-key') &&
    rawProjectId &&
    !rawProjectId.includes('your-project-id')
  );
};

const firebaseConfig = {
  apiKey: rawApiKey,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: rawProjectId || 'vantageflow-prod',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || '',
};

let appInstance: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;
let functionsInstance: Functions | undefined;
let storageInstance: FirebaseStorage | undefined;

if (isFirebaseConfigured()) {
  try {
    appInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    authInstance = initializeAuth(appInstance, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    dbInstance = getFirestore(appInstance);
    functionsInstance = getFunctions(appInstance, 'us-central1');
    storageInstance = getStorage(appInstance);
    console.log('✅ [Firebase Mobile] Initialized successfully with project:', firebaseConfig.projectId);
  } catch (error) {
    console.warn('⚠️ [Firebase Mobile] Init warning, running in offline demo mode:', error);
  }
} else {
  console.log('ℹ️ [Firebase Mobile] No Firebase API key configured. Running with mock data and demo mode.');
}

export const app = appInstance as FirebaseApp;
export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;
export const functions = functionsInstance as Functions;
export const storage = storageInstance as FirebaseStorage;

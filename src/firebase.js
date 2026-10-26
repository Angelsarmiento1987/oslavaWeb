import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
const e = process.env;
export const configured = !!(
  e.REACT_APP_FIREBASE_API_KEY &&
  e.REACT_APP_FIREBASE_PROJECT_ID &&
  e.REACT_APP_FIREBASE_APP_ID
);
const app = configured
  ? initializeApp({
      apiKey: e.REACT_APP_FIREBASE_API_KEY,
      authDomain: e.REACT_APP_FIREBASE_AUTH_DOMAIN,
      projectId: e.REACT_APP_FIREBASE_PROJECT_ID,
      storageBucket: e.REACT_APP_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: e.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
      appId: e.REACT_APP_FIREBASE_APP_ID,
    })
  : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

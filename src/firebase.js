import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDvupY5EsX7h-HAQEVnFRfST9kEoU_sKu8",
  authDomain: "xpenses-305ee.firebaseapp.com",
  projectId: "xpenses-305ee",
  storageBucket: "xpenses-305ee.firebasestorage.app",
  messagingSenderId: "692039365727",
  appId: "1:692039365727:web:165e54b06393737b7a57ea",
  measurementId: "G-1N2ZCKRN59"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app);
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "ai-voice-assistant-4baf0.firebaseapp.com",
  projectId: "ai-voice-assistant-4baf0",
  storageBucket: "ai-voice-assistant-4baf0.firebasestorage.app",
  messagingSenderId: "72530849157",
  appId: "1:72530849157:web:62ff1efbc603557f1e28ec"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app)
const provider = new GoogleAuthProvider()

export {auth , provider}


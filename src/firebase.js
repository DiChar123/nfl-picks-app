// Import the functions you need from the Firebase SDKs
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyC45ZW2w_zzVKisi8rATX8CBD4dEjkViUM",
  authDomain: "nfl-picks-2025.firebaseapp.com",
  projectId: "nfl-picks-2025",
  storageBucket: "nfl-picks-2025.appspot.com",  // Corrected here
  messagingSenderId: "231942630167",
  appId: "1:231942630167:web:90a3dba4642e531e2e6552"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore (database)
const db = getFirestore(app);

// Export Firestore instance for use in your app
export default db;

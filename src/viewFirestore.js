import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read your service account JSON file synchronously
const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function viewWeekData(weekNumber) {
  try {
    const scheduleDoc = await db.collection('schedule').doc(`week${weekNumber}`).get();
    const resultsDoc = await db.collection('results').doc(`week${weekNumber}`).get();

    if (!scheduleDoc.exists) {
      console.log(`No schedule found for week ${weekNumber}`);
    } else {
      console.log(`Schedule for Week ${weekNumber}:`);
      console.dir(scheduleDoc.data(), { depth: null });
    }

    if (!resultsDoc.exists) {
      console.log(`No results found for week ${weekNumber}`);
    } else {
      console.log(`Results for Week ${weekNumber}:`);
      console.dir(resultsDoc.data(), { depth: null });
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

// Change this number to view a different week
const WEEK_TO_VIEW = 1;

viewWeekData(WEEK_TO_VIEW);

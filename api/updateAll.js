// /api/updateAll.js
import admin from 'firebase-admin';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { DateTime } from 'luxon';

// Initialize Firebase Admin
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
} else {
  const localPath = path.resolve('./src/serviceAccountKey.json');
  if (fs.existsSync(localPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(localPath, 'utf8'));
  } else {
    throw new Error(
      'No Firebase service account found. Set FIREBASE_SERVICE_ACCOUNT or add serviceAccountKey.json locally.'
    );
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Helper to log messages
function logMessage(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Convert ESPN UTC date string to ET ISO string
function convertToET(utcString) {
  if (!utcString) return null;
  return DateTime.fromISO(utcString, { zone: 'utc' })
    .setZone('America/New_York')
    .toISO();
}

export default async function handler(req, res) {
  try {
    // Determine current NFL season and week
    const currentSeason = new Date().getFullYear();
    const currentWeekResponse = await axios.get(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`
    );
    const currentWeekNumber = currentWeekResponse.data.week?.number || 1;

    const allWeeksResults = [];

    // Loop through all weeks from 1 to currentWeekNumber
    for (let week = 1; week <= currentWeekNumber; week++) {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&season=${currentSeason}`;
      const response = await axios.get(url);
      const games = response.data.events || [];

      const updatedResults = {
        week,
        results: games.map((game) => {
          const competitors = game.competitions[0].competitors;
          const homeTeam = competitors.find((t) => t.homeAway === 'home');
          const awayTeam = competitors.find((t) => t.homeAway === 'away');

          const homeScore = parseInt(homeTeam.score);
          const awayScore = parseInt(awayTeam.score);

          const winner =
            !isNaN(homeScore) && !isNaN(awayScore)
              ? homeScore > awayScore
                ? homeTeam.team.displayName
                : awayTeam.team.displayName
              : null;

          return {
            homeTeam: homeTeam.team.displayName,
            awayTeam: awayTeam.team.displayName,
            homeScore,
            awayScore,
            winner,
          };
        }),
      };

      // Write results to Firestore
      await db.collection('results').doc(`week${week}`).set(updatedResults);

      allWeeksResults.push(updatedResults);

      logMessage(`✅ Week ${week} results updated (${games.length} games)`);
    }

    // Update leaderboard for all users
    const usersSnapshot = await db.collection('users').get();
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const picks = userData.picks || {};
      let totalCorrect = 0;
      const weeklyRecords = {};

      for (const [weekStr, weekPicks] of Object.entries(picks)) {
        const weekNum = Number(weekStr);
        const weekResults = allWeeksResults.find((w) => w.week === weekNum);

        if (!weekResults) continue;

        let correctCount = 0;
        weekResults.results.forEach((game, idx) => {
          if (weekPicks[idx] && weekPicks[idx] === game.winner) correctCount++;
        });

        weeklyRecords[weekNum] = correctCount;
        totalCorrect += correctCount;
      }

      await db
        .collection('users')
        .doc(userDoc.id)
        .set(
          {
            ...userData,
            totalCorrect,
            weeklyRecords,
          },
          { merge: true }
        );
    }

    logMessage(`✅ Leaderboard updated for ${usersSnapshot.size} users`);

    res
      .status(200)
      .json({ message: `Schedule, results, and leaderboard updated for weeks 1-${currentWeekNumber}` });
  } catch (err) {
    console.error('UpdateAll error:', err);
    res.status(500).json({ error: err.message });
  }
}

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
    throw new Error('No Firebase service account found. Set FIREBASE_SERVICE_ACCOUNT or add serviceAccountKey.json locally.');
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
    const lastWeek = 18; // or set dynamically if you want
    for (let week = 1; week <= lastWeek; week++) {
      const response = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&season=2025`);
      const games = response.data.events || [];

      // Schedule
      const updatedSchedule = {
        week,
        bye: response.data.leagues?.[0]?.byeWeekTeams?.map(team => team.displayName) || [],
        games: games.map(game => {
          const competitors = game.competitions[0].competitors;
          const homeTeam = competitors.find(t => t.homeAway === 'home');
          const awayTeam = competitors.find(t => t.homeAway === 'away');
          return {
            homeTeam: homeTeam.team.displayName,
            awayTeam: awayTeam.team.displayName,
            date: convertToET(game.date || game.competitions[0]?.startDate)
          };
        }),
      };

      // Results
      const updatedResults = {
        week,
        results: games.map(game => {
          const competitors = game.competitions[0].competitors;
          const homeTeam = competitors.find(t => t.homeAway === 'home');
          const awayTeam = competitors.find(t => t.homeAway === 'away');
          const homeScore = parseInt(homeTeam.score);
          const awayScore = parseInt(awayTeam.score);
          const winner = !isNaN(homeScore) && !isNaN(awayScore)
            ? homeScore > awayScore
              ? homeTeam.team.displayName
              : awayTeam.team.displayName
            : '';
          return { homeTeam: homeTeam.team.displayName, awayTeam: awayTeam.team.displayName, homeScore, awayScore, winner };
        }),
      };

      // Update Firestore
      await db.collection('schedule').doc(`week${week}`).set(updatedSchedule);
      await db.collection('results').doc(`week${week}`).set(updatedResults);

      logMessage(`✅ Week ${week} schedule & results updated (${games.length} games)`);

      // Update leaderboard for each user
      const usersSnapshot = await db.collection('users').get();
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const picks = userData.picks || {};
        let totalCorrect = 0;
        const weeklyRecords = {};

        for (const [weekStr, weekPicks] of Object.entries(picks)) {
          const weekNum = Number(weekStr);
          const weekResults = weekNum === week ? updatedResults : (await db.collection('results').doc(`week${weekNum}`).get()).data();
          if (!weekResults) continue;

          let correctCount = 0;
          weekResults.results.forEach((game, idx) => {
            if (weekPicks[idx] && weekPicks[idx] === game.winner) correctCount++;
          });

          weeklyRecords[weekNum] = correctCount;
          totalCorrect += correctCount;
        }

        await db.collection('users').doc(userDoc.id).set(
          { ...userData, totalCorrect, weeklyRecords },
          { merge: true }
        );
      }

      logMessage(`✅ Leaderboard updated for ${usersSnapshot.size} users (Week ${week})`);
    }

    res.status(200).json({ message: `All weeks schedule, results, and leaderboard updated successfully.` });
  } catch (err) {
    console.error("UpdateAll error:", err);
    res.status(500).json({ error: err.message });
  }
}

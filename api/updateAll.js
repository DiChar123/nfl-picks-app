// /api/updateAll.js
import admin from 'firebase-admin';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { DateTime } from 'luxon';

// Initialize Firebase Admin
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
  } catch (e) {
    throw new Error(
      'Failed to parse FIREBASE_SERVICE_ACCOUNT env var. Double-check it is valid JSON with \\n for newlines.'
    );
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
    // Fetch ESPN scoreboard
    let axiosResponse;
    try {
      axiosResponse = await axios.get(
        'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
      );
    } catch (err) {
      console.error('Axios fetch failed:', err.message);
      return res.status(500).json({ error: 'Failed to fetch ESPN scoreboard' });
    }

    const games = axiosResponse.data.events || [];
    const weekNumber = axiosResponse.data.week?.number || 1;

    // Build updated schedule
    const updatedSchedule = {
      week: weekNumber,
      bye:
        axiosResponse.data.leagues?.[0]?.byeWeekTeams?.map(
          (team) => team.displayName
        ) || [],
      games: games.map((game) => {
        const competitors = game.competitions[0].competitors;
        const homeTeam = competitors.find((t) => t.homeAway === 'home');
        const awayTeam = competitors.find((t) => t.homeAway === 'away');

        const gameDateUTC = game.date || game.competitions[0]?.startDate || null;
        const gameDateET = convertToET(gameDateUTC);

        return {
          homeTeam: homeTeam.team.displayName,
          awayTeam: awayTeam.team.displayName,
          date: gameDateET,
        };
      }),
    };

    // Build updated results
    const updatedResults = {
      week: weekNumber,
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
            : '';

        return {
          homeTeam: homeTeam.team.displayName,
          awayTeam: awayTeam.team.displayName,
          homeScore,
          awayScore,
          winner,
        };
      }),
    };

    // Update Firestore
    await db.collection('schedule').doc(`week${weekNumber}`).set(updatedSchedule);
    await db.collection('results').doc(`week${weekNumber}`).set(updatedResults);

    logMessage(`✅ Updated schedule & results for Week ${weekNumber} (${games.length} games)`);

    // Update leaderboard
    const usersSnapshot = await db.collection('users').get();
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const picks = userData.picks || {};
      let totalCorrect = 0;
      const weeklyRecords = {};

      for (const [weekStr, weekPicks] of Object.entries(picks)) {
        const weekNum = Number(weekStr);

        let weekResults;
        try {
          weekResults =
            weekNum === weekNumber
              ? updatedResults
              : (await db.collection('results').doc(`week${weekNum}`).get()).data();
        } catch (err) {
          console.warn(`Failed to get results for week ${weekNum}:`, err.message);
          continue;
        }

        if (!weekResults?.results) continue;

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
          { ...userData, totalCorrect, weeklyRecords },
          { merge: true }
        );
    }

    logMessage(`✅ Updated leaderboard for ${usersSnapshot.size} users`);

    res
      .status(200)
      .json({ message: `Week ${weekNumber} schedule, results, and leaderboard updated` });
  } catch (err) {
    console.error('UpdateAll error:', err);
    res.status(500).json({ error: err.message });
  }
}

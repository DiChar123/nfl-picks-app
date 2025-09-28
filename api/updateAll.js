// /api/updateAll.js
import admin from 'firebase-admin';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

// Initialize Firebase Admin
let serviceAccount;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
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
} catch (err) {
  console.error('Firebase initialization failed:', err);
}

const db = admin.firestore();

// Helper to log messages
function logMessage(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

export default async function handler(req, res) {
  try {
    // Fetch ESPN API data
    const response = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
    );
    if (!response?.data) {
      throw new Error('ESPN API returned empty response');
    }

    const games = response.data.events || [];
    const weekNumber = response.data.week?.number || 1;

    if (!Array.isArray(games)) {
      throw new Error('ESPN API "events" is not an array');
    }

    // Build updated schedule
    const updatedSchedule = {
      week: weekNumber,
      bye:
        response.data.leagues?.[0]?.byeWeekTeams?.map(
          (team) => team.displayName
        ) || [],
      games: games.map((game, idx) => {
        const competitors = game.competitions?.[0]?.competitors;
        if (!competitors || competitors.length < 2) {
          console.warn(`Game at index ${idx} missing competitors`, game);
          return { homeTeam: '', awayTeam: '', date: game.date || '' };
        }
        const homeTeam = competitors.find((t) => t.homeAway === 'home');
        const awayTeam = competitors.find((t) => t.homeAway === 'away');
        return {
          homeTeam: homeTeam?.team?.displayName || '',
          awayTeam: awayTeam?.team?.displayName || '',
          date: game.date || '',
        };
      }),
    };

    // Build updated results
    const updatedResults = {
      week: weekNumber,
      results: games.map((game, idx) => {
        const competitors = game.competitions?.[0]?.competitors;
        if (!competitors || competitors.length < 2) {
          console.warn(`Game at index ${idx} missing competitors for results`, game);
          return {
            homeTeam: '',
            awayTeam: '',
            homeScore: 0,
            awayScore: 0,
            winner: '',
          };
        }

        const homeTeam = competitors.find((t) => t.homeAway === 'home');
        const awayTeam = competitors.find((t) => t.homeAway === 'away');

        const homeScore = parseInt(homeTeam?.score) || 0;
        const awayScore = parseInt(awayTeam?.score) || 0;
        const winner = homeScore === awayScore ? '' : homeScore > awayScore ? homeTeam?.team?.displayName : awayTeam?.team?.displayName;

        return {
          homeTeam: homeTeam?.team?.displayName || '',
          awayTeam: awayTeam?.team?.displayName || '',
          homeScore,
          awayScore,
          winner,
        };
      }),
    };

    // Update Firestore: schedule and results
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
          console.warn(`Failed to fetch results for week ${weekNum}:`, err);
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

      await db.collection('users').doc(userDoc.id).set(
        {
          ...userData,
          totalCorrect,
          weeklyRecords,
        },
        { merge: true }
      );
    }

    logMessage(`✅ Updated leaderboard for ${usersSnapshot.size} users`);

    res.status(200).json({
      message: `Week ${weekNumber} schedule, results, and leaderboard updated`,
    });
  } catch (err) {
    console.error('❌ Manual update failed:', err);
    res.status(500).json({ error: err.message });
  }
}

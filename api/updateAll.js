// /api/updateAll.js
import admin from 'firebase-admin';
import axios from 'axios';

// ✅ Initialize Firebase Admin once
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// ✅ Main API handler
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed. Use POST.' });
  }

  try {
    // Fetch live NFL data from ESPN
    const response = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
    );
    const games = response.data.events || [];
    const weekNumber = response.data.week?.number || 1;

    // Build updated schedule
    const updatedSchedule = {
      week: weekNumber,
      bye:
        response.data.leagues?.[0]?.byeWeekTeams?.map(
          (team) => team.displayName
        ) || [],
      games: games.map((game) => {
        const competitors = game.competitions[0].competitors;
        const homeTeam = competitors.find((t) => t.homeAway === 'home');
        const awayTeam = competitors.find((t) => t.homeAway === 'away');
        return {
          homeTeam: homeTeam.team.displayName,
          awayTeam: awayTeam.team.displayName,
          date: game.date,
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

    // ✅ Update Firestore (schedule + results)
    await db.collection('schedule').doc(`week${weekNumber}`).set(updatedSchedule);
    await db.collection('results').doc(`week${weekNumber}`).set(updatedResults);

    // ✅ Update leaderboard
    const usersSnapshot = await db.collection('users').get();
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const picks = userData.picks || {};
      let totalCorrect = 0;
      const weeklyRecords = {};

      for (const [weekStr, weekPicks] of Object.entries(picks)) {
        const weekNum = Number(weekStr);
        const weekResults =
          weekNum === weekNumber
            ? updatedResults
            : (
                await db.collection('results').doc(`week${weekNum}`).get()
              ).data();
        if (!weekResults) continue;

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

    return res
      .status(200)
      .json({ message: `✅ Week ${weekNumber} updated successfully` });
  } catch (err) {
    console.error('UpdateAll API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

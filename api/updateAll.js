import axios from 'axios';
import admin from 'firebase-admin';

// Initialize Firebase if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch scoreboard from ESPN
    let scoreboardData;
    try {
      const axiosResponse = await axios.get(
        'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
        {
          params: {
            week: 1,
            season: 2025,
          },
        }
      );
      scoreboardData = axiosResponse.data;
    } catch (err) {
      console.error('ESPN fetch failed:', err.message);
      return res.status(503).json({ error: 'Failed to fetch scoreboard from ESPN. Try again later.' });
    }

    // Ensure events exist
    const events = scoreboardData?.events;
    if (!events || !Array.isArray(events)) {
      console.error('No events found in ESPN data');
      return res.status(500).json({ error: 'No events found in ESPN data' });
    }

    // Process each game and update Firestore
    const batch = db.batch();
    events.forEach((game) => {
      const gameId = game.id;
      const gameRef = db.collection('schedule').doc(gameId);

      const homeTeam = game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')?.team?.abbreviation;
      const awayTeam = game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away')?.team?.abbreviation;
      const winner = game.competitions?.[0]?.competitors?.find(c => c.winner)?.team?.abbreviation || null;
      const gameDate = game.date;

      batch.set(
        gameRef,
        {
          homeTeam,
          awayTeam,
          winner,
          date: gameDate,
        },
        { merge: true }
      );
    });

    await batch.commit();

    res.status(200).json({ message: 'Schedule updated successfully', gamesUpdated: events.length });
  } catch (err) {
    console.error('UpdateAll error:', err);
    res.status(500).json({ error: 'Unexpected server error', details: err.message });
  }
}

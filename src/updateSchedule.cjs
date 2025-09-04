// src/updateSchedule.cjs

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const admin = require('firebase-admin');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./serviceAccountKey.json'); // 🔒 make sure this exists!

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = getFirestore();

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const CURRENT_YEAR = 2025;

async function updateSchedule() {
  console.log(`[${new Date().toISOString()}] 🔄 Starting schedule + results update...`);

  for (let week = 1; week <= 18; week++) {
    const url = `${BASE_URL}?seasontype=2&week=${week}&dates=${CURRENT_YEAR}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.events || !Array.isArray(data.events)) {
      console.warn(`⚠️ No events found for week ${week}`);
      continue;
    }

    const batch = db.batch();
    let validGames = 0;

    for (const event of data.events) {
      const gameId = event.id;
      const competition = event.competitions?.[0];
      const status = competition?.status?.type?.name;

      if (!competition || competition.season?.type !== 2) {
        continue; // Skip preseason or undefined
      }

      const homeTeamData = competition.competitors.find((t) => t.homeAway === 'home');
      const awayTeamData = competition.competitors.find((t) => t.homeAway === 'away');

      const homeTeam = homeTeamData?.team?.abbreviation;
      const awayTeam = awayTeamData?.team?.abbreviation;

      if (!homeTeam || !awayTeam) continue;

      const startDate = competition.date || null;
      const isFinal = status === 'STATUS_FINAL';

      const homeScore = isFinal ? parseInt(homeTeamData.score) : null;
      const awayScore = isFinal ? parseInt(awayTeamData.score) : null;

      let winner = null;
      if (isFinal) {
        winner =
          homeScore > awayScore ? homeTeam :
          awayScore > homeScore ? awayTeam :
          'TIE';
      }

      const docRef = db.collection('schedule').doc(gameId);
      batch.set(docRef, {
        gameId,
        week,
        homeTeam,
        awayTeam,
        gameTime: startDate ? new Date(startDate).toISOString() : null,
        status,
        homeScore,
        awayScore,
        winner,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      validGames++;
    }

    await batch.commit();
    console.log(`✅ Week ${week}: ${validGames} games updated.`);
  }

  console.log(`[${new Date().toISOString()}] ✅ Schedule and results update complete.`);
}

updateSchedule().catch((err) => {
  console.error('❌ Error updating schedule:', err);
});



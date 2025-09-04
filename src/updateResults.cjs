const fs = require('fs');
const path = require('path');
const axios = require('axios');
const admin = require('firebase-admin');

// Paths
const serviceAccount = require('./firebase-service-account.json');
const resultsFilePath = path.join(__dirname, 'results.json');
const scheduleFilePath = path.join(__dirname, 'schedule.json');
const logFilePath = path.join(__dirname, 'log.txt');

// Firebase Init
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// Logging Helper
function logMessage(message) {
  const timestamp = new Date().toISOString();
  const fullMessage = `[${timestamp}] ${message}`;
  console.log(fullMessage);
  fs.appendFileSync(logFilePath, `${fullMessage}\n`);
}

// Main Fetch Function
async function fetchResultsAndSchedule() {
  try {
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
    const games = response.data.events;
    const weekNumber = response.data.week.number;

    const updatedResults = {
      week: weekNumber,
      results: games.map((game) => {
        const competitors = game.competitions[0].competitors;
        const homeTeam = competitors.find((t) => t.homeAway === 'home');
        const awayTeam = competitors.find((t) => t.homeAway === 'away');
        const status = game.status?.type?.name || '';

        let winner = '';
        let homeScore = null;
        let awayScore = null;

        const hScore = parseInt(homeTeam.score);
        const aScore = parseInt(awayTeam.score);

        if (status === 'STATUS_FINAL' && !isNaN(hScore) && !isNaN(aScore)) {
          homeScore = hScore;
          awayScore = aScore;
          winner = hScore > aScore ? homeTeam.team.displayName : awayTeam.team.displayName;
        }

        return {
          homeTeam: homeTeam.team.displayName,
          awayTeam: awayTeam.team.displayName,
          homeScore,
          awayScore,
          winner,
        };
      }),
    };

    const updatedSchedule = {
      week: weekNumber,
      bye: response.data.leagues?.[0]?.byeWeekTeams?.map((t) => t.displayName) || [],
      games: games.map((game) => {
        const competitors = game.competitions[0].competitors;
        const homeTeam = competitors.find((t) => t.homeAway === 'home');
        const awayTeam = competitors.find((t) => t.homeAway === 'away');

        return {
          homeTeam: homeTeam.team.displayName,
          awayTeam: awayTeam.team.displayName,
          date: game.date, // Always ISO datetime string
        };
      }),
    };

    // Update results.json
    let resultsData = fs.existsSync(resultsFilePath)
      ? JSON.parse(fs.readFileSync(resultsFilePath, 'utf-8'))
      : [];
    const resIndex = resultsData.findIndex((w) => w.week === weekNumber);
    if (resIndex !== -1) resultsData[resIndex] = updatedResults;
    else resultsData.push(updatedResults);
    fs.writeFileSync(resultsFilePath, JSON.stringify(resultsData, null, 2));

    // Update schedule.json
    let scheduleData = fs.existsSync(scheduleFilePath)
      ? JSON.parse(fs.readFileSync(scheduleFilePath, 'utf-8'))
      : [];
    const schedIndex = scheduleData.findIndex((w) => w.week === weekNumber);
    if (schedIndex !== -1) scheduleData[schedIndex] = updatedSchedule;
    else scheduleData.push(updatedSchedule);
    fs.writeFileSync(scheduleFilePath, JSON.stringify(scheduleData, null, 2));

    // Firestore Sync
    await db.collection('schedule').doc(`week${weekNumber}`).set(updatedSchedule);
    await db.collection('results').doc(`week${weekNumber}`).set(updatedResults);

    logMessage(`✅ Updated results & schedule for Week ${weekNumber} (${games.length} games)`);

  } catch (err) {
    logMessage(`❌ ERROR: ${err.message}`);
  }
}

// Run it
fetchResultsAndSchedule();

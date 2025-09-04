import fs from 'fs';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname fix for ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const resultsFilePath = path.join(__dirname, 'results.json');
const scheduleFilePath = path.join(__dirname, 'schedule.json');
const manualSchedulePath = path.join(__dirname, 'manualSchedule.json'); // manual overrides
const logFilePath = path.join(__dirname, 'log.txt');

// Logging helper
function logMessage(message) {
  const timestamp = new Date().toISOString();
  const fullMessage = `[${timestamp}] ${message}`;
  console.log(fullMessage);
  fs.appendFileSync(logFilePath, `${fullMessage}\n`);
}

// Format ISO date string (leave as is from API or manual)
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  // If date includes 'T', assume it's ISO, else convert to ISO (optional)
  return dateStr.includes('T') ? dateStr : new Date(dateStr).toISOString();
}

async function fetchAndUpdateAll() {
  try {
    // Load manualSchedule.json if exists
    let manualScheduleData = [];
    if (fs.existsSync(manualSchedulePath)) {
      manualScheduleData = JSON.parse(fs.readFileSync(manualSchedulePath, 'utf8'));
      logMessage(`✅ Loaded manualSchedule.json with ${manualScheduleData.length} weeks`);
    } else {
      logMessage(`ℹ️ No manualSchedule.json found, proceeding with API only`);
    }

    // Fetch ESPN API data
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
    const data = response.data;
    const games = data.events || [];
    const weekNumber = data.week?.number || 1;

    // Check if we have manual data for this week
    const manualWeekData = manualScheduleData.find(w => w.week === weekNumber);

    let updatedSchedule;
    if (manualWeekData) {
      // Use manual schedule for this week, but keep bye info from API if available
      updatedSchedule = {
        week: manualWeekData.week,
        bye: data.leagues?.[0]?.byeWeekTeams?.map(team => team.displayName) || [],
        games: manualWeekData.games.map(game => ({
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          date: normalizeDate(game.date),
        })),
      };
      logMessage(`🔄 Using manual schedule for Week ${weekNumber}`);
    } else {
      // Use API schedule
      updatedSchedule = {
        week: weekNumber,
        bye: data.leagues?.[0]?.byeWeekTeams?.map(team => team.displayName) || [],
        games: games.map(game => {
          const competitors = game.competitions[0].competitors;
          const homeTeam = competitors.find(team => team.homeAway === 'home');
          const awayTeam = competitors.find(team => team.homeAway === 'away');
          return {
            homeTeam: homeTeam.team.displayName,
            awayTeam: awayTeam.team.displayName,
            date: normalizeDate(game.date),
          };
        }),
      };
      logMessage(`🔄 Using ESPN API schedule for Week ${weekNumber}`);
    }

    // Build results from API every time
    const updatedResults = {
      week: weekNumber,
      results: games.map(game => {
        const competitors = game.competitions[0].competitors;
        const homeTeam = competitors.find(team => team.homeAway === 'home');
        const awayTeam = competitors.find(team => team.homeAway === 'away');
        const gameStatus = game.status?.type?.name || '';

        let winner = '';
        let homeScore = null;
        let awayScore = null;

        const rawHomeScore = parseInt(homeTeam.score);
        const rawAwayScore = parseInt(awayTeam.score);
        const validScores = !isNaN(rawHomeScore) && !isNaN(rawAwayScore);

        if (gameStatus === 'STATUS_FINAL' && validScores) {
          homeScore = rawHomeScore;
          awayScore = rawAwayScore;
          winner = homeScore > awayScore ? homeTeam.team.displayName : awayTeam.team.displayName;
        }

        return {
          homeTeam: homeTeam.team.displayName,
          awayTeam: awayTeam.team.displayName,
          winner,
          homeScore,
          awayScore,
        };
      }),
    };

    // Update results.json
    let resultsData = fs.existsSync(resultsFilePath)
      ? JSON.parse(fs.readFileSync(resultsFilePath, 'utf8'))
      : [];
    const resIndex = resultsData.findIndex(w => w.week === weekNumber);
    if (resIndex !== -1) {
      resultsData[resIndex] = updatedResults;
    } else {
      resultsData.push(updatedResults);
    }
    fs.writeFileSync(resultsFilePath, JSON.stringify(resultsData, null, 2));

    // Update schedule.json
    let scheduleData = fs.existsSync(scheduleFilePath)
      ? JSON.parse(fs.readFileSync(scheduleFilePath, 'utf8'))
      : [];
    const schedIndex = scheduleData.findIndex(w => w.week === weekNumber);
    if (schedIndex !== -1) {
      scheduleData[schedIndex] = updatedSchedule;
    } else {
      scheduleData.push(updatedSchedule);
    }
    fs.writeFileSync(scheduleFilePath, JSON.stringify(scheduleData, null, 2));

    // Log using correct games count from final schedule (manual or API)
    const gamesCount = updatedSchedule.games.length;
    logMessage(`✅ Updated schedule and results for Week ${weekNumber} (${gamesCount} games)`);

  } catch (error) {
    logMessage(`❌ ERROR: ${error.message}`);
  }
}

// Run the updater
fetchAndUpdateAll();

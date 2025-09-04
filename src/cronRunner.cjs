const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');

// Paths to update scripts
const resultsScript = path.join(__dirname, 'updateResults.js');
const scheduleScript = path.join(__dirname, 'updateSchedule.js');

// Helper to run a script with logging
function runScript(label, scriptPath) {
  const timestamp = new Date().toLocaleString();
  console.log(`\n🕒 [${timestamp}] [${label}] Running ${path.basename(scriptPath)}...`);
  
  exec(`node ${scriptPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ [${label}] Error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`⚠️ [${label}] stderr: ${stderr}`);
    }
    console.log(`✅ [${label}] Complete:\n${stdout}`);
  });
}

// Wrapper to run both updates together
function runFullUpdate(label) {
  runScript(`${label} - Results`, resultsScript);
  runScript(`${label} - Schedule`, scheduleScript);
}

console.log('📅 Cron jobs initialized. Results & schedule will auto-update.\n');

// 🟡 Thursday Night (after TNF)
cron.schedule('30 21 * * 4', () => runFullUpdate('Thursday Night Check'));

// 🟡 Friday Late Night (finalize TNF or Friday games)
cron.schedule('0 23 * * 5', () => runFullUpdate('Friday Late Night Check'));

// 🟡 Saturday Night (after Saturday games or for Sunday prep)
cron.schedule('0 23 * * 6', () => runFullUpdate('Saturday Night Check'));

// 🔵 Sunday Early AM (intl games, TBD cleanup)
cron.schedule('0 6 * * 0', () => runFullUpdate('Sunday AM Intl Check'));

// 🔵 Sunday Midday (main wave of games)
cron.schedule('0 12 * * 0', () => runFullUpdate('Sunday Midday Check'));

// 🔵 Sunday Late Night (after SNF)
cron.schedule('30 20 * * 0', () => runFullUpdate('Sunday Night Final'));

// 🟣 Monday Late Night (after MNF)
cron.schedule('0 23 * * 1', () => runFullUpdate('Monday Night Final'));

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Correct path to schedule.json inside src folder
const scheduleFilePath = path.join(__dirname, 'src', 'schedule.json');

function loadSchedule() {
  if (fs.existsSync(scheduleFilePath)) {
    const data = fs.readFileSync(scheduleFilePath, 'utf-8');
    console.log('Loaded schedule.json content:', data.substring(0, 300));  // Debug: show first 300 chars
    try {
      return JSON.parse(data);
    } catch (err) {
      console.error('Error parsing schedule.json:', err.message);
      return [];
    }
  } else {
    console.warn('schedule.json not found, using empty schedule.');
    return [];
  }
}

// Route to get full schedule
app.get('/api/schedule', (req, res) => {
  console.log('🔵 /api/schedule route was hit'); // Added debug log
  const schedule = loadSchedule();
  res.json(schedule);
});

// Route to get schedule by week
app.get('/api/schedule/week/:weekNumber', (req, res) => {
  const schedule = loadSchedule();
  const weekNumber = parseInt(req.params.weekNumber);
  const weekData = schedule.find(week => week.week === weekNumber);

  if (!weekData) {
    return res.status(404).json({ message: 'Week not found' });
  }

  res.json(weekData);
});

// Route to get games by team
app.get('/api/schedule/team/:teamName', (req, res) => {
  const schedule = loadSchedule();
  const teamName = req.params.teamName.toLowerCase();

  const games = schedule.flatMap(week => 
    week.games.filter(game =>
      game.homeTeam.toLowerCase() === teamName ||
      game.awayTeam.toLowerCase() === teamName
    ).map(game => ({ week: week.week, ...game }))
  );

  if (games.length === 0) {
    return res.status(404).json({ message: 'No games found for this team' });
  }

  res.json(games);
});

// Manual update routes
app.post('/update-results', (req, res) => {
  console.log('Manual results update triggered');
  exec('node src/updateResults.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`updateResults.js error: ${error.message}`);
      return res.status(500).json({ message: 'Update results failed' });
    }
    console.log(stdout);
    res.json({ message: 'Results updated successfully' });
  });
});

app.post('/update-schedule', (req, res) => {
  console.log('Manual schedule update triggered');
  exec('node src/updateSchedule.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`updateSchedule.js error: ${error.message}`);
      return res.status(500).json({ message: 'Update schedule failed' });
    }
    console.log(stdout);
    res.json({ message: 'Schedule updated successfully' });
  });
});

app.post('/update-all', (req, res) => {
  console.log('Manual full update triggered');
  exec('node src/updateAll.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`updateAll.js error: ${error.message}`);
      return res.status(500).json({ message: 'Full update failed' });
    }
    console.log(stdout);
    res.json({ message: 'Schedule and results updated successfully' });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

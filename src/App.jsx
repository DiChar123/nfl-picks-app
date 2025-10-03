// src/App.jsx
import React, { useState, useEffect } from 'react';
import './App.css';
import teamLogos from './teamLogos';
import Leaderboard from './Leaderboard';
import db from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { DateTime } from 'luxon';

function App() {
  const teamAbbrToFullName = {
    PHI: "Philadelphia Eagles", DAL: "Dallas Cowboys", LAR: "Los Angeles Rams",
    KC: "Kansas City Chiefs", ATL: "Atlanta Falcons", TB: "Tampa Bay Buccaneers",
    CLE: "Cleveland Browns", CIN: "Cincinnati Bengals", IND: "Indianapolis Colts",
    MIA: "Miami Dolphins", NE: "New England Patriots", LV: "Las Vegas Raiders",
    NO: "New Orleans Saints", ARI: "Arizona Cardinals", NYJ: "New York Jets",
    PIT: "Pittsburgh Steelers", WAS: "Washington Commanders", NYG: "New York Giants",
    JAX: "Jacksonville Jaguars", CAR: "Carolina Panthers", DEN: "Denver Broncos",
    TEN: "Tennessee Titans", SEA: "Seattle Seahawks", SF: "San Francisco 49ers",
    GB: "Green Bay Packers", DET: "Detroit Lions", HOU: "Houston Texans",
    LAC: "Los Angeles Chargers", BUF: "Buffalo Bills", BAL: "Baltimore Ravens",
    CHI: "Chicago Bears", MIN: "Minnesota Vikings"
  };

  const [selectedWeek, setSelectedWeek] = useState(() => {
    const storedWeek = localStorage.getItem('selectedWeek');
    return storedWeek ? Number(storedWeek) : 1;
  });
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [results, setResults] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [userPicks, setUserPicks] = useState({});

  useEffect(() => {
    let storedUsername = localStorage.getItem('username');
    let storedPin = localStorage.getItem('pin');

    if (!storedUsername || !storedPin) {
      storedUsername = window.prompt('Enter your username:');
      storedPin = window.prompt('Enter your 4-digit PIN:');
      if (storedUsername && storedPin) {
        localStorage.setItem('username', storedUsername);
        localStorage.setItem('pin', storedPin);
      }
    }

    if (storedUsername && storedPin) {
      setUsername(storedUsername);
      setPin(storedPin);
      loadPicks(storedUsername, storedPin);
    }
  }, []);

  const loadPicks = async (uname, upin) => {
    try {
      const docRef = doc(db, 'users', uname);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.pin === upin) setUserPicks(data.picks || {});
        else alert('Incorrect PIN. Please refresh and try again.');
      }
    } catch (error) {
      console.error('Error loading picks:', error);
    }
  };

  useEffect(() => {
    fetchSchedule();
    fetchResults();
  }, []);

  const fetchSchedule = async () => {
    try {
      const response = await fetch('/schedule.json');
      const data = await response.json();
      const formattedData = data.map(week => ({
        ...week,
        games: (week.games || []).map(game => ({ ...game, date: game.date || null }))
      }));
      setSchedule(formattedData || []);
      const validWeek = formattedData.find(w => w.week === selectedWeek);
      if (!validWeek) {
        const firstWeek = formattedData[0]?.week || 1;
        setSelectedWeek(firstWeek);
        localStorage.setItem('selectedWeek', firstWeek);
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
      setSchedule([]);
    }
  };
  const fetchResults = async () => {
    try {
      const response = await fetch('/results.json');
      const data = await response.json();
      // normalize results and compute winner if missing
      const normalizedResults = (data || []).map(week => ({
        week: week.week,
        results: (week.results || []).map(game => {
          const winner =
            game.winner != null
              ? game.winner
              : game.homeScore != null && game.awayScore != null
              ? game.homeScore > game.awayScore
                ? game.homeTeam
                : game.awayScore > game.homeScore
                ? game.awayTeam
                : null
              : null;
          return { ...game, winner };
        }),
      }));
      setResults(normalizedResults);
    } catch (error) {
      console.error('Error loading results:', error);
      setResults([]);
    }
  };

  const handlePick = async (week, gameIndex, team) => {
    const updatedPicks = { ...userPicks };
    const weekPicks = updatedPicks[week] ? { ...updatedPicks[week] } : {};
    if (weekPicks[gameIndex] === team) delete weekPicks[gameIndex];
    else weekPicks[gameIndex] = team;
    updatedPicks[week] = weekPicks;
    setUserPicks(updatedPicks);
    localStorage.setItem(`picks-${username}`, JSON.stringify(updatedPicks));

    try {
      await setDoc(doc(db, 'users', username), { pin, picks: updatedPicks }, { merge: true });
    } catch (error) {
      console.error('Error saving pick:', error);
    }
  };

  const handleWeekChange = (e) => {
    const week = Number(e.target.value);
    setSelectedWeek(week);
    localStorage.setItem('selectedWeek', week);
  };

  const handleManualUpdate = async () => {
    try {
      const response = await fetch('/api/updateAll', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        console.log(`Manual update: ${data.message || 'Success'}`);
        await fetchSchedule();
        await fetchResults();
        alert('✅ Schedule, results, and leaderboard updated!');
      } else {
        console.error('Manual update failed:', data.error);
        alert('❌ Manual update failed. Check console for details.');
      }
    } catch (error) {
      console.error('Manual update error:', error);
      alert('❌ Manual update error. Check console for details.');
    }
  };

  const selectedSchedule = schedule.find((week) => week.week === selectedWeek);

  const formatReadableDate = (isoDate) => {
    if (!isoDate) return 'TBD';
    return DateTime.fromISO(isoDate, { zone: 'utc' })
      .setZone('America/New_York')
      .toFormat('EEEE, LLL dd');
  };

  const formatReadableTime = (isoDate) => {
    if (!isoDate) return 'TBD';
    return DateTime.fromISO(isoDate, { zone: 'utc' })
      .setZone('America/New_York')
      .toFormat('hh:mm a') + ' ET';
  };

  const isPickLocked = (isoDate) => {
    if (!isoDate) return false;
    const gameTime = DateTime.fromISO(isoDate, { zone: 'utc' }).toMillis();
    return Date.now() >= gameTime - 5 * 60000;
  };
  return (
    <div className="app">
      <h1>NFL 2025 Touchdown Throwdown</h1>

      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <img src="/app-logo.png" alt="App Logo" style={{ width: '140px', height: 'auto' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <button onClick={() => setShowLeaderboard(!showLeaderboard)}>
          {showLeaderboard ? 'Back to Schedule' : 'View Leaderboard'}
        </button>
        {!showLeaderboard && <button onClick={handleManualUpdate}>Manual Update</button>}
      </div>

      {!showLeaderboard && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h2 style={{ margin: 0 }}>Week {selectedWeek}</h2>
          <div>
            <label style={{ marginRight: '5px' }}>Select Week:</label>
            <select value={selectedWeek} onChange={handleWeekChange}>
              {schedule?.map((week) => (
                <option key={week.week} value={week.week}>
                  Week {week.week}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {showLeaderboard ? (
        <Leaderboard results={results} userPicks={userPicks} schedule={schedule} />
      ) : selectedSchedule?.games?.length ? (
        <div className="week">
          {selectedSchedule.games.map((game, index) => {
            const homeFullName = teamAbbrToFullName[game?.homeTeam] || game?.homeTeam;
            const awayFullName = teamAbbrToFullName[game?.awayTeam] || game?.awayTeam;
            const userPick = userPicks?.[selectedWeek]?.[index];
            const isLocked = isPickLocked(game?.date);

            const normalize = (str) =>
  str?.toLowerCase().replace(/\s+/g, '').trim();

const weekResult = results?.find(r => r?.week === selectedWeek);
const gameResult = weekResult?.results?.find(
  g =>
    normalize(g.homeTeam) === normalize(game.homeTeam) &&
    normalize(g.awayTeam) === normalize(game.awayTeam)
);


            // Compute winner if missing
            const gameWinner = gameResult?.winner ?? (
              gameResult?.homeScore != null && gameResult?.awayScore != null
                ? (gameResult.homeScore > gameResult.awayScore
                    ? gameResult.homeTeam
                    : gameResult.awayScore > gameResult.homeScore
                    ? gameResult.awayTeam
                    : null)
                : null
            );

            return (
              <div key={index} className="game">
                <p style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <img src={teamLogos[awayFullName]} alt={awayFullName} width="60" height="60" />
                  <span>{awayFullName}</span> <span>@</span> <span>{homeFullName}</span>
                  <img src={teamLogos[homeFullName]} alt={homeFullName} width="60" height="60" />
                </p>
                <p style={{ textAlign: 'center', margin: '5px 0' }}>
                  {formatReadableDate(game?.date)} | {formatReadableTime(game?.date)}
                </p>

                {gameResult?.homeScore != null && gameResult?.awayScore != null && (
                  <p style={{ textAlign: 'center', margin: '5px 0', fontWeight: 'bold' }}>
                    Score: {gameResult?.awayTeam} {gameResult?.awayScore} — {gameResult?.homeTeam} {gameResult?.homeScore}
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
                  <button
                    onClick={() => handlePick(selectedWeek, index, awayFullName)}
                    disabled={isLocked}
                    className={userPick === awayFullName ? 'selected' : ''}
                  >
                    Pick {awayFullName}
                  </button>
                  <button
                    onClick={() => handlePick(selectedWeek, index, homeFullName)}
                    disabled={isLocked}
                    className={userPick === homeFullName ? 'selected' : ''}
                  >
                    Pick {homeFullName}
                  </button>
                </div>

                <p
                  style={{
                    textAlign: 'center',
                    color: !gameWinner ? 'gray' : userPick === gameWinner ? 'green' : 'red',
                  }}
                >
                  {!gameWinner
                    ? 'Pick Locked'
                    : !userPick
                    ? `🏆 Winner: ${gameWinner}`
                    : userPick === gameWinner
                    ? '✅ Correct Pick!'
                    : `❌ Wrong Pick — Winner: ${gameWinner}`}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p>Loading schedule...</p>
      )}
    </div>
  );
}

export default App;

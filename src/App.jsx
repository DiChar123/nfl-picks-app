import React, { useState, useEffect } from 'react';
import './App.css';
import teamLogos from './teamLogos';
import Leaderboard from './Leaderboard';
import db from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const BACKEND_URL = 'https://nfl-picks-app-git-main-dillon-charlebois-projects.vercel.app'; // <-- Your deployed backend URL

function App() {
  const teamAbbrToFullName = {
    PHI: "Philadelphia Eagles",
    DAL: "Dallas Cowboys",
    LAR: "Los Angeles Rams",
    KC: "Kansas City Chiefs",
    ATL: "Atlanta Falcons",
    TB: "Tampa Bay Buccaneers",
    CLE: "Cleveland Browns",
    CIN: "Cincinnati Bengals",
    IND: "Indianapolis Colts",
    MIA: "Miami Dolphins",
    NE: "New England Patriots",
    LV: "Las Vegas Raiders",
    NO: "New Orleans Saints",
    ARI: "Arizona Cardinals",
    NYJ: "New York Jets",
    PIT: "Pittsburgh Steelers",
    WAS: "Washington Commanders",
    NYG: "New York Giants",
    JAX: "Jacksonville Jaguars",
    CAR: "Carolina Panthers",
    DEN: "Denver Broncos",
    TEN: "Tennessee Titans",
    SEA: "Seattle Seahawks",
    SF: "San Francisco 49ers",
    GB: "Green Bay Packers",
    DET: "Detroit Lions",
    HOU: "Houston Texans",
    LAC: "Los Angeles Chargers",
    BUF: "Buffalo Bills",
    BAL: "Baltimore Ravens",
    CHI: "Chicago Bears",
    MIN: "Minnesota Vikings"
  };

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [results, setResults] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [userPicks, setUserPicks] = useState({});

  // Load username and PIN
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
        if (data.pin === upin) {
          setUserPicks(data.picks || {});
        } else {
          alert('Incorrect PIN. Please refresh and try again.');
        }
      }
    } catch (error) {
      console.error('Error loading picks:', error);
    }
  };

  // Fetch schedule and results
  useEffect(() => {
    fetchSchedule();
    fetchResults();
  }, []);

  const fetchSchedule = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/schedule`);
      const data = await response.json();
      console.log('Schedule loaded:', data); // <-- Debug log
      setSchedule(data);

      // Set selectedWeek to first available week if current selectedWeek invalid
      if (!data.find(w => w.week === selectedWeek)) {
        setSelectedWeek(data[0]?.week || 1);
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
  };

  const fetchResults = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/results.json`);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error loading results:', error);
    }
  };

  const handlePick = async (week, gameIndex, team) => {
    const updatedPicks = { ...userPicks };
    const weekPicks = updatedPicks[week] ? { ...updatedPicks[week] } : {};

    if (weekPicks[gameIndex] === team) {
      delete weekPicks[gameIndex];
    } else {
      weekPicks[gameIndex] = team;
    }

    updatedPicks[week] = weekPicks;

    setUserPicks(updatedPicks);
    localStorage.setItem(`picks-${username}`, JSON.stringify(updatedPicks));

    try {
      await setDoc(
        doc(db, 'users', username),
        {
          pin: pin,
          picks: updatedPicks,
        },
        { merge: true }
      );
      console.log('Pick saved to Firebase');
    } catch (error) {
      console.error('Error saving pick:', error);
    }
  };

  const handleWeekChange = (e) => setSelectedWeek(Number(e.target.value));

  const handleManualUpdate = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/update-all`, { method: 'POST' });
      alert('Schedule and results updated');
      fetchSchedule();
      fetchResults();
    } catch (error) {
      console.error('Manual update failed:', error);
    }
  };

  const selectedSchedule = schedule.find((week) => week.week === selectedWeek);
  console.log('Selected week schedule:', selectedSchedule); // <-- Debug log

  const formatReadableDate = (isoDate) => {
    if (!isoDate) return 'TBD';
    const dateObj = new Date(isoDate);
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatReadableTime = (isoDate) => {
    if (!isoDate) return 'TBD';
    const dateObj = new Date(isoDate);
    return (
      dateObj.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
      }) + ' ET'
    );
  };

  const isPickLocked = (isoDate) => {
    if (!isoDate) return false;
    const gameTime = new Date(isoDate).getTime();
    return Date.now() >= gameTime - 5 * 60000;
  };

  return (
    <div className="app">
      <h1>NFL 2025 Touchdown Throwdown</h1>

      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <img
          src="/app logo.png"
          alt="App Logo"
          style={{ width: '140px', height: 'auto' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <button onClick={() => setShowLeaderboard(!showLeaderboard)}>
          {showLeaderboard ? 'Back to Schedule' : 'View Leaderboard'}
        </button>
        {!showLeaderboard && (
          <button onClick={handleManualUpdate}>Manual Update</button>
        )}
      </div>

      {!showLeaderboard && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h2 style={{ margin: 0 }}>Week {selectedWeek}</h2>
          <div>
            <label style={{ marginRight: '5px' }}>Select Week:</label>
            <select value={selectedWeek} onChange={handleWeekChange}>
              {(schedule ?? []).map((week) => (
                <option key={week.week} value={week.week}>
                  Week {week.week}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {showLeaderboard ? (
        <Leaderboard />
      ) : selectedSchedule ? (
        <div className="week">
          {(selectedSchedule.games ?? []).map((game, index) => {
            const homeFullName = teamAbbrToFullName[game.homeTeam] || game.homeTeam;
            const awayFullName = teamAbbrToFullName[game.awayTeam] || game.awayTeam;
            const userPick = userPicks?.[selectedWeek]?.[index];
            const isLocked = isPickLocked(game.date);

            return (
              <div key={index} className="game">
                <p style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <img src={teamLogos[awayFullName]} alt={awayFullName} width="60" height="60" />
                  <span>{awayFullName}</span>
                  <span>@</span>
                  <span>{homeFullName}</span>
                  <img src={teamLogos[homeFullName]} alt={homeFullName} width="60" height="60" />
                </p>
                <p style={{ textAlign: 'center', margin: '5px 0' }}>
                  {formatReadableDate(game.date)} | {formatReadableTime(game.date)}
                </p>

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

                {(() => {
                  const weekResult = results.find((r) => r.week === selectedWeek);
                  const gameResult = weekResult?.results?.find((g) => g.index === index);
                  if (gameResult && gameResult.winner) {
                    const winner = gameResult.winner;
                    if (!userPick) {
                      return <p style={{ color: 'gray', textAlign: 'center' }}>🏆 Winner: {winner}</p>;
                    } else if (userPick === winner) {
                      return <p style={{ color: 'green', textAlign: 'center' }}>✅ Correct Pick!</p>;
                    } else {
                      return <p style={{ color: 'red', textAlign: 'center' }}>❌ Wrong Pick — Winner: {winner}</p>;
                    }
                  }
                  return null;
                })()}

                {isLocked && <p style={{ textAlign: 'center' }}>Pick Locked</p>}
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

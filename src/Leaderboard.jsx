import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import db from './firebase';

function Leaderboard() {
  const [userStats, setUserStats] = useState([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const picksSnapshot = await getDocs(collection(db, 'users'));
        const statsArray = [];

        picksSnapshot.forEach((doc) => {
          const userData = doc.data();
          statsArray.push({
            username: userData.username || doc.id,
            totalCorrect: userData.totalCorrect || 0,
            weeklyRecords: userData.weeklyRecords || {},
          });
        });

        // Sort by totalCorrect descending
        statsArray.sort((a, b) => b.totalCorrect - a.totalCorrect);

        setUserStats(statsArray);
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <div className="leaderboard">
      <h2>Season Leaderboard</h2>
      {userStats.length === 0 ? (
        <p>Loading leaderboard...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>User</th>
              <th>Total Correct</th>
            </tr>
          </thead>
          <tbody>
            {userStats.map((user, index) => (
              <tr key={user.username}>
                <td>{index + 1}</td>
                <td>{user.username}</td>
                <td>{user.totalCorrect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {userStats.map((user) => (
        <div key={user.username} className="weekly-breakdown">
          <h3>{user.username} Weekly Performance</h3>
          {Object.keys(user.weeklyRecords).length === 0 ? (
            <p>No picks yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Correct Picks</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(user.weeklyRecords).map(([week, correct]) => (
                  <tr key={week}>
                    <td>Week {week}</td>
                    <td>{correct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

export default Leaderboard;

// src/useSchedule.js
import { useState, useEffect } from 'react';

export default function useSchedule() {
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    async function loadSchedule() {
      try {
        const res = await fetch('/schedule.json'); // fetch from public folder
        const data = await res.json();
        setSchedule(data);
      } catch (err) {
        console.error('Failed to load schedule:', err);
      }
    }

    loadSchedule();
  }, []);

  return schedule;
}

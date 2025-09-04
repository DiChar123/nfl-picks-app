import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const scheduleFilePath = path.join(process.cwd(), 'src', 'schedule.json');

  try {
    const data = fs.readFileSync(scheduleFilePath, 'utf-8');
    const schedule = JSON.parse(data);
    res.status(200).json(schedule);
  } catch (error) {
    console.error('Error loading schedule.json:', error.message);
    res.status(500).json({ message: 'Failed to load schedule' });
  }
}

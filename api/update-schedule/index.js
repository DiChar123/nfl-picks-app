// api/update-schedule.js
import { exec } from 'child_process';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  exec('node src/updateSchedule.cjs', (error, stdout, stderr) => {
    if (error) {
      console.error('updateSchedule.cjs error:', error);
      return res.status(500).json({ error: 'Failed to run updateSchedule.cjs' });
    }

    console.log('updateSchedule.cjs output:', stdout);
    if (stderr) console.error('updateSchedule.cjs stderr:', stderr);

    res.status(200).json({ message: 'Schedule updated successfully' });
  });
}

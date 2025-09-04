// api/update-all.js
import { exec } from 'child_process';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  exec('node src/updateAll.cjs', (error, stdout, stderr) => {
    if (error) {
      console.error('updateAll.cjs error:', error);
      return res.status(500).json({ error: 'Failed to run updateAll.cjs' });
    }

    console.log('updateAll.cjs output:', stdout);
    if (stderr) console.error('updateAll.cjs stderr:', stderr);

    res.status(200).json({ message: 'Schedule and results updated successfully' });
  });
}

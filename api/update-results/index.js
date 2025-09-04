// api/update-results.js
import { exec } from 'child_process';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  exec('node src/updateResults.cjs', (error, stdout, stderr) => {
    if (error) {
      console.error('updateResults.cjs error:', error);
      return res.status(500).json({ error: 'Failed to run updateResults.cjs' });
    }

    console.log('updateResults.cjs output:', stdout);
    if (stderr) console.error('updateResults.cjs stderr:', stderr);

    res.status(200).json({ message: 'Results updated successfully' });
  });
}

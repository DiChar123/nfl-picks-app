import { exec } from 'child_process';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  exec('node src/updateAll.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`updateAll.js error: ${error.message}`);
      return res.status(500).json({ message: 'Full update failed' });
    }
    console.log(stdout);
    res.status(200).json({ message: 'Schedule and results updated successfully' });
  });
}

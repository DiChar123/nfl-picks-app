// src/mergeUsers.cjs
const admin = require('firebase-admin');

// Load Firebase credentials from Vercel environment variable
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
  } catch (e) {
    throw new Error(
      'Failed to parse FIREBASE_SERVICE_ACCOUNT env var. Make sure it is valid JSON with \\n for newlines.'
    );
  }
} else {
  throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set!');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function mergeUsers(mainUserId, duplicateUserId) {
  const mainDocRef = db.collection('users').doc(mainUserId);
  const dupDocRef = db.collection('users').doc(duplicateUserId);

  const [mainSnap, dupSnap] = await Promise.all([mainDocRef.get(), dupDocRef.get()]);

  if (!mainSnap.exists) {
    console.log(`Main user "${mainUserId}" does not exist!`);
    return;
  }
  if (!dupSnap.exists) {
    console.log(`Duplicate user "${duplicateUserId}" does not exist!`);
    return;
  }

  const mainData = mainSnap.data();
  const dupData = dupSnap.data();

  // Merge picks safely
  const mergedPicks = { ...mainData.picks };

  for (const [week, weekPicks] of Object.entries(dupData.picks || {})) {
    mergedPicks[week] = mergedPicks[week] || {};
    for (const [gameIndex, pick] of Object.entries(weekPicks)) {
      if (!(gameIndex in mergedPicks[week])) {
        mergedPicks[week][gameIndex] = pick;
      }
    }
  }

  const mergedData = {
    ...mainData,
    picks: mergedPicks,
  };

  await mainDocRef.set(mergedData, { merge: true });
  console.log(`✅ Merged picks from "${duplicateUserId}" into "${mainUserId}"`);

  await dupDocRef.delete();
  console.log(`✅ Deleted duplicate user "${duplicateUserId}"`);
}

// CLI support
const [,, mainUser, duplicateUser] = process.argv;
if (!mainUser || !duplicateUser) {
  console.error('Usage: node src/mergeUsers.cjs "CorrectUser" "WrongUser"');
  process.exit(1);
}

mergeUsers(mainUser, duplicateUser)
  .then(() => console.log('Merge complete.'))
  .catch(err => console.error('Error merging users:', err));

// src/mergeUsers.cjs
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

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
  const mergedPicks = { ...mainData.picks }; // start with main user picks

  for (const [week, weekPicks] of Object.entries(dupData.picks || {})) {
    mergedPicks[week] = mergedPicks[week] || {}; // ensure week object exists
    for (const [gameIndex, pick] of Object.entries(weekPicks)) {
      // Only add pick if main user doesn't already have one for this game
      if (!(gameIndex in mergedPicks[week])) {
        mergedPicks[week][gameIndex] = pick;
      }
    }
  }

  // Merge other fields carefully
  const mergedData = {
    ...mainData,
    picks: mergedPicks,
  };

  // Write merged data to main user
  await mainDocRef.set(mergedData, { merge: true });
  console.log(`✅ Merged picks from "${duplicateUserId}" into "${mainUserId}"`);

  // Delete duplicate user
  await dupDocRef.delete();
  console.log(`✅ Deleted duplicate user "${duplicateUserId}"`);
}

// Exact Firestore IDs
const mainUser = 'Papa D';       // keep this one
const duplicateUser = 'PapaD ';  // merge this one into main

mergeUsers(mainUser, duplicateUser)
  .then(() => console.log('Merge complete.'))
  .catch(err => console.error('Error merging users:', err));

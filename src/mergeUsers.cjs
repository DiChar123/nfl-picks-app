// src/mergeUsers.cjs
const admin = require('firebase-admin');

// --- Directly set your service account here ---
const serviceAccount = {
  "type": "service_account",
  "project_id": "nfl-picks-2025",
  "private_key_id": "7b2bccdd008c57f47a4e8da441cb03b5a7afc16d",
  "private_key": `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDyzGDb95Tkh9Mj
JaTiUm1AjTOBZlaTnWvebdtwWp+a1BCVfpfceFM+QbpHTr6BTl7Lu28qfz2KNe+i
YiPunGeAIQLFAmWXWHvxY947ieliMvw/Tgb6lAMNKmUzJBzCy/8MdDWbZKz/bn43
zN/2JbLHGmAGM3hKO/jAcam6riKRK4gWq3Xl81PY3g0FVTPoDfjCZHD1EM7J7FZj
An4Py3f4SRLkifPoecRe2byp+H32JoY+ZTod2jvXe8RmaL5gjvyW/yxW9jxSFT69
9sLQXhVNF+En1kgz+DuqBT6K1xtebWilAd9wfjHhQTaBUXlKcWaryjCjdWcub/ee
NtwLvn31AgMBAAECggEARAR0V/r+R50zTWPU0qBDwfMsjCIWu+i8WMYO1OVWVAH3
mWGq+lTtAQJZxHMvVDsXvFxIUq/tlgPxG10B8uz248Kbq4Q14JWltySCk8xZSKy+
1J8vvk/roOsRCagitIGAdEUz5VHpUu9pxYkL7sF12WguoV4W4zj0wTi2UzlILsFm
+5MaGSblwRD0UmmPpY/DrpkjIrzmjMvNquVT+aTbX5r/MysBVQoHN45hYR0VCnzm
q/c8VWKNGhf+SgR601JOyPA6JB2PMwkbelXi/vi4hjTmnkAt6DeP2pbKv4UVjJU
uMEli9ZQc7m3Is4XHTsECefMX7mbA/u41D5BgaWhuwKBgQD9yn6nea6FbFYKbxC1
m9/f0mt5Ba7ksd306R5TPT3GsDjzyN6fkWFRYNjzJSBFLb0cl4DUaTjdxjGgrGs8
kRb53Q4qbWaWTWDsC0ywwWm5ejZcWPD5pgfJJZ4+cd0haoJ3OBS6SYITSHc/di6+
GZu9ITFbPGJBOZvzSUUNjjCRxwKBgQD06WOzTkhntwQMVBstX5dK4sGi8Vrh/Wsw
1m3OxC4JyjVo5ysRaOAuweIgNQuPe+kHz4L2FZUuSY0erF58+Ua2TUAPkNiOW/V/
9yqHHIz0LFkVYS9YboeghUW6vliA2sZc4bbEcFLog/f12dzBdgH2+NhtVU+OX26E
IGrVsZjyYwKBgQDnanCo57SyZsHiC7pRz0uJfQaQuRTr5iA9BSCoyCv/c4rLCLuv
BtKVcNkChTTyv600WBWaGkRHPUTdfLrf5HDt75rOJymnHfGl6vvIJOTxwrW06Uj6
a2GoEcxEpnD72nISoamM4CBi0u4hiPNAVnuDLrQhvGLflNdWNNZpcOFq2wKBgCvc
dH+TQIJak34FvgxFN1ow/A7LfMRGV2EatfW2yqv0K9aKt/rZNnUJQg8UkOp0fYpp
joG14c61W3Gn2xA0sIZLlXJ0NWRhcbkmMdaatV+xZY7fpdQHj4Ce/ZrxJfaFt8rA
nbPWjfKYV9sO1mtLUBTEAjaqdaIA01EUYS2+La8TAoGBANPpG9thTc8Z3pu6Cmcb
JBki5YZhVcgD8sQh0NVSJ3VnreTmq7qzGAjhndsmNHLJ6kSL9Vpm+epUNOFCMla6
+mhr6Mp1wMlqhMtMYMpeO8FGk5686tQtC/JR8wnrRE+FMG+EBCIlydjWOVuKvt2s
U61uQo9mYYt62XVv5mG36nDN
-----END PRIVATE KEY-----`,
  "client_email": "firebase-adminsdk-fbsvc@nfl-picks-2025.iam.gserviceaccount.com",
  "client_id": "116334016445131929978",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc@nfl-picks-2025.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

// --- Initialize Firebase ---
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// --- Merge function ---
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

  // Merge picks for all weeks safely
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

// --- CLI support ---
const [,, mainUser, duplicateUser] = process.argv;
if (!mainUser || !duplicateUser) {
  console.error('Usage: node src/mergeUsers.cjs "CorrectUser" "WrongUser"');
  process.exit(1);
}

mergeUsers(mainUser, duplicateUser)
  .then(() => console.log('Merge complete.'))
  .catch(err => console.error('Error merging users:', err));

const admin = require('firebase-admin');
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

const oldUser = "Nanak";
const newUser = "Nanaj";

async function renameUser() {
  try {
    const oldDocRef = db.collection('users').doc(oldUser);
    const oldDocSnap = await oldDocRef.get();

    if (!oldDocSnap.exists) {
      console.log(`User "${oldUser}" does not exist!`);
      return;
    }

    const oldData = oldDocSnap.data();

    // Check if newUser already exists
    const newDocRef = db.collection('users').doc(newUser);
    const newDocSnap = await newDocRef.get();

    if (newDocSnap.exists) {
      console.log(`User "${newUser}" already exists! Aborting.`);
      return;
    }

    // Create new document with old data
    await newDocRef.set(oldData);
    console.log(`✅ Created new user "${newUser}" with all picks and data from "${oldUser}"`);

    // Delete old document
    await oldDocRef.delete();
    console.log(`🗑 Deleted old user "${oldUser}"`);

  } catch (error) {
    console.error("❌ ERROR:", error);
  }
}

renameUser();

// src/listUsers.cjs
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

async function listUsers() {
  const snapshot = await db.collection('users').get();
  console.log('User document IDs in Firestore:');
  snapshot.docs.forEach(doc => {
    console.log(`- "${doc.id}"`);
  });
}

listUsers();

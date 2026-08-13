import { initializeApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import config from './firebase-applet-config.json';
const app = initializeApp(config);
// @ts-ignore
const db = getFirestore(app, config.firestoreDatabaseId || '(default)');

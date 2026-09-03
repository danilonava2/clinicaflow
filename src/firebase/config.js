import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyD2Vtk1Bzmrw1TtOw_3yMf3Z4yVFtDf9KM',
  authDomain: 'clinicaflowapp-57a8a.firebaseapp.com',
  databaseURL: 'https://clinicaflowapp-57a8a-default-rtdb.firebaseio.com',
  projectId: 'clinicaflowapp-57a8a',
  storageBucket: 'clinicaflowapp-57a8a.firebasestorage.app',
  messagingSenderId: '451352633928',
  appId: '1:451352633928:web:d4f989e418fef93c236e7d',
  measurementId: 'G-3J2MSQX6QM'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const realtimeDb = getDatabase(app);

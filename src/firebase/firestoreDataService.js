import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestoreDb } from './config.js';

export async function guardarDatosUsuario(uid, { pacientes, centros }) {
  await setDoc(doc(firestoreDb, 'usuarios', uid), {
    pacientes,
    centros,
    migrado: true,
    ultimaActualizacion: Date.now()
  });
}

export async function cargarDatosUsuario(uid) {
  const snapshot = await getDoc(doc(firestoreDb, 'usuarios', uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    pacientes: data.pacientes || [],
    centros: data.centros || []
  };
}

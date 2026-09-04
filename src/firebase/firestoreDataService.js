import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
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

// Se queda escuchando cambios en el documento del usuario (propios o de
// otro dispositivo) y llama a onCambio cada vez que hay una actualizacion.
// Devuelve una funcion para dejar de escuchar (llamar al cerrar sesion).
export function escucharDatosUsuario(uid, onCambio) {
  return onSnapshot(
    doc(firestoreDb, 'usuarios', uid),
    (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      onCambio({
        pacientes: data.pacientes || [],
        centros: data.centros || []
      });
    },
    (error) => {
      console.error('Error escuchando cambios en Firestore:', error);
    }
  );
}

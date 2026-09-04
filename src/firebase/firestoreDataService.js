import { doc, getDoc, setDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { firestoreDb } from './config.js';

export async function guardarDatosUsuario(uid, { pacientes, centros }) {
  // merge:true es importante: sin esto, cada guardado reemplazaria el
  // documento entero y borraria campos como "plan" o "email".
  await setDoc(
    doc(firestoreDb, 'usuarios', uid),
    {
      pacientes,
      centros,
      migrado: true,
      ultimaActualizacion: Date.now()
    },
    { merge: true }
  );
}

// Guarda datos de perfil (correo, plan) sin tocar pacientes/centros.
export async function guardarInfoUsuario(uid, info) {
  await setDoc(doc(firestoreDb, 'usuarios', uid), info, { merge: true });
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
        centros: data.centros || [],
        plan: data.plan || 'gratis'
      });
    },
    (error) => {
      console.error('Error escuchando cambios en Firestore:', error);
    }
  );
}

// ==================== SOLO ADMINISTRADOR ====================
export async function listarTodosLosUsuarios() {
  const snapshot = await getDocs(collection(firestoreDb, 'usuarios'));
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      email: data.email || '(sin correo registrado)',
      plan: data.plan || 'gratis',
      totalRegistros: Array.isArray(data.pacientes) ? data.pacientes.length : 0,
      totalCentros: Array.isArray(data.centros) ? data.centros.length : 0
    };
  });
}

export async function cambiarPlanUsuario(uid, plan) {
  await setDoc(doc(firestoreDb, 'usuarios', uid), { plan }, { merge: true });
}

import { doc, getDoc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { firestoreDb } from './config.js';

export async function guardarDatosUsuario(uid, { pacientes, centros, turnos, cirugias }) {
  // merge:true es importante: sin esto, cada guardado reemplazaria el
  // documento entero y borraria campos como "plan" o "email".
  await setDoc(
    doc(firestoreDb, 'usuarios', uid),
    {
      pacientes,
      centros,
      turnos,
      cirugias,
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
        turnos: data.turnos || [],
        cirugias: data.cirugias || [],
        plan: data.plan || 'gratis',
        planVenceEl: data.planVenceEl || null
      });
    },
    (error) => {
      console.error('Error escuchando cambios en Firestore:', error);
    }
  );
}

// ==================== SOLO ADMINISTRADOR ====================
function mapearUsuario(docSnap) {
  const data = docSnap.data();
  return {
    uid: docSnap.id,
    email: data.email || '(sin correo registrado)',
    plan: data.plan || 'gratis',
    planVenceEl: data.planVenceEl || null,
    totalRegistros: Array.isArray(data.pacientes) ? data.pacientes.length : 0,
    totalCentros: Array.isArray(data.centros) ? data.centros.length : 0
  };
}

// Se queda escuchando la coleccion completa de usuarios en tiempo real:
// si se activa un plan desde otro dispositivo (u otra pestaña), la lista
// se actualiza sola aca tambien, igual que la app principal sincroniza
// los datos de un usuario. Devuelve una funcion para dejar de escuchar.
export function escucharTodosLosUsuarios(onCambio) {
  return onSnapshot(
    collection(firestoreDb, 'usuarios'),
    (snapshot) => onCambio(snapshot.docs.map(mapearUsuario)),
    (error) => {
      console.error('Error escuchando la lista de usuarios:', error);
    }
  );
}

// planVenceEl: fecha ISO (YYYY-MM-DD) o null para un plan Pro sin vencimiento.
export async function cambiarPlanUsuario(uid, plan, planVenceEl = null) {
  await setDoc(doc(firestoreDb, 'usuarios', uid), { plan, planVenceEl }, { merge: true });
}

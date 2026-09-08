import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from './config.js';

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Tema privado de ntfy.sh (https://ntfy.sh) usado solo para avisarle al
// administrador que se registro un usuario nuevo -- notificacion push real
// (llega aunque el celular tenga la app cerrada), sin backend propio ni
// plan Blaze. El nombre es dificil de adivinar, pero no es un secreto
// critico: en el peor caso alguien podria publicar avisos falsos en el
// mismo tema, nunca leer datos de la app.
const NTFY_TOPIC_NUEVO_USUARIO = 'clinicaflow-nuevo-usuario-5798c4mvlhx1';

function avisarNuevoUsuario(email) {
  fetch(`https://ntfy.sh/${NTFY_TOPIC_NUEVO_USUARIO}`, {
    method: 'POST',
    headers: { Title: 'Nuevo usuario en ClinicaFlow', Tags: 'tada' },
    body: `${email} se acaba de registrar en ClinicaFlow.`
  }).catch(() => {
    // Aviso "best effort": si falla (sin internet, ntfy caido, etc.) no debe
    // afectar el registro, que ya quedo confirmado en Firebase Auth.
  });
}

export async function register(email, password) {
  const credencial = await createUserWithEmailAndPassword(auth, email, password);
  avisarNuevoUsuario(email);
  return credencial;
}

export function logout() {
  return signOut(auth);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export function watchAuthState(onUser, onGuest) {
  return onAuthStateChanged(auth, (user) => {
    if (user) onUser(user);
    else onGuest();
  });
}

export function getCurrentUser() {
  return auth.currentUser;
}

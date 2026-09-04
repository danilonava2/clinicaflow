import * as firestoreService from './firestoreDataService.js';
import * as realtimeService from './realtimeDataService.js';

/**
 * Garantiza que el usuario tenga datos en Firestore. Si todavia no los tiene
 * (primer inicio de sesion tras la migracion), los copia una sola vez desde
 * Realtime Database, que nunca se borra ni se modifica. No devuelve los
 * datos: quien los necesite los recibe via el listener en tiempo real.
 */
export async function asegurarMigracion(uid) {
  const datosFirestore = await firestoreService.cargarDatosUsuario(uid);
  if (datosFirestore) return;

  const datosRTDB = await realtimeService.cargarDatosUsuario(uid);
  await firestoreService.guardarDatosUsuario(uid, datosRTDB);
  console.log('✅ Datos migrados de Realtime Database a Firestore');
}

import * as firestoreService from './firestoreDataService.js';
import * as realtimeService from './realtimeDataService.js';

/**
 * Devuelve los datos del usuario desde Firestore. Si el usuario todavia no
 * tiene datos ahi (primer inicio de sesion tras la migracion), los copia
 * una sola vez desde Realtime Database, que nunca se borra ni se modifica.
 */
export async function obtenerDatosConMigracion(uid) {
  const datosFirestore = await firestoreService.cargarDatosUsuario(uid);
  if (datosFirestore) return datosFirestore;

  const datosRTDB = await realtimeService.cargarDatosUsuario(uid);
  await firestoreService.guardarDatosUsuario(uid, datosRTDB);
  console.log('✅ Datos migrados de Realtime Database a Firestore');
  return datosRTDB;
}

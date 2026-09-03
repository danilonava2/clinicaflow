import { ref, get } from 'firebase/database';
import { realtimeDb } from './config.js';

const CENTROS_POR_DEFECTO = ['Clínica A', 'Consultorio B', 'Hospital C'];

// Solo lectura: Realtime Database queda como respaldo historico congelado
// al momento de la migracion a Firestore. Ya no se le vuelve a escribir.
export async function cargarDatosUsuario(uid) {
  const snapshot = await get(ref(realtimeDb, 'usuarios/' + uid));
  const data = snapshot.val();
  if (data) {
    return {
      pacientes: data.pacientes || [],
      centros: data.centros || [...CENTROS_POR_DEFECTO]
    };
  }
  return { pacientes: [], centros: [...CENTROS_POR_DEFECTO] };
}

export function centrosPorDefecto() {
  return [...CENTROS_POR_DEFECTO];
}

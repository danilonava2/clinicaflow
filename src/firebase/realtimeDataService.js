import { ref, set, get } from 'firebase/database';
import { realtimeDb } from './config.js';

const CENTROS_POR_DEFECTO = ['Clínica A', 'Consultorio B', 'Hospital C'];

export async function guardarDatosUsuario(uid, { pacientes, centros }) {
  const userData = {
    pacientes,
    centros,
    ultimaActualizacion: Date.now()
  };
  await set(ref(realtimeDb, 'usuarios/' + uid), userData);
}

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

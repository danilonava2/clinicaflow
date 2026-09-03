import { guardarDatosUsuario as guardarFirestore } from './firebase/firestoreDataService.js';
import { obtenerDatosConMigracion } from './firebase/migration.js';
import { centrosPorDefecto } from './firebase/realtimeDataService.js';

export const state = {
  currentUser: null,
  pacientes: [],
  centros: []
};

export async function cargarDatosDelUsuario(uid) {
  const { pacientes, centros } = await obtenerDatosConMigracion(uid);
  state.pacientes = pacientes;
  state.centros = centros.length ? centros : centrosPorDefecto();
}

export async function guardarDatos() {
  if (!state.currentUser) return;
  try {
    await guardarFirestore(state.currentUser.uid, {
      pacientes: state.pacientes,
      centros: state.centros
    });
  } catch (error) {
    console.error('Error al guardar en Firestore:', error);
  }
}

export function resetState() {
  state.pacientes = [];
  state.centros = centrosPorDefecto();
}

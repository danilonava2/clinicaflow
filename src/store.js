import {
  guardarDatosUsuario as guardarRTDB,
  cargarDatosUsuario as cargarRTDB,
  centrosPorDefecto
} from './firebase/realtimeDataService.js';

export const state = {
  currentUser: null,
  pacientes: [],
  centros: []
};

export async function cargarDatosDelUsuario(uid) {
  const { pacientes, centros } = await cargarRTDB(uid);
  state.pacientes = pacientes;
  state.centros = centros;
}

export async function guardarDatos() {
  if (!state.currentUser) return;
  try {
    await guardarRTDB(state.currentUser.uid, {
      pacientes: state.pacientes,
      centros: state.centros
    });
  } catch (error) {
    console.error('Error al guardar en Firebase:', error);
  }
}

export function resetState() {
  state.pacientes = [];
  state.centros = centrosPorDefecto();
}

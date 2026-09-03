import { guardarDatosUsuario as guardarFirestore } from './firebase/firestoreDataService.js';
import { obtenerDatosConMigracion } from './firebase/migration.js';
import { centrosPorDefecto } from './firebase/realtimeDataService.js';

export const state = {
  currentUser: null,
  pacientes: [],
  centros: []
};

// Centros venian antes como simples strings (["Clínica A", ...]). Ahora cada
// centro es un objeto con sus previsiones ({ nombre, previsiones: [...] }).
// Esto convierte datos viejos al formato nuevo sin perder informacion.
function normalizarCentros(centros) {
  return (centros || []).map((c) => {
    if (typeof c === 'string') return { nombre: c, previsiones: [] };
    return { nombre: c.nombre, previsiones: c.previsiones || [] };
  });
}

export async function cargarDatosDelUsuario(uid) {
  const { pacientes, centros } = await obtenerDatosConMigracion(uid);
  state.pacientes = pacientes;
  state.centros = normalizarCentros(centros.length ? centros : centrosPorDefecto());
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
  state.centros = normalizarCentros(centrosPorDefecto());
}

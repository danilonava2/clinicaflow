import { guardarDatosUsuario as guardarFirestore, escucharDatosUsuario } from './firebase/firestoreDataService.js';
import { asegurarMigracion } from './firebase/migration.js';
import { centrosPorDefecto } from './firebase/realtimeDataService.js';

export const state = {
  currentUser: null,
  pacientes: [],
  centros: []
};

let detenerEscucha = null;

// Centros venian antes como simples strings (["Clínica A", ...]). Ahora cada
// centro es un objeto con sus previsiones ({ nombre, previsiones: [...] }).
// Esto convierte datos viejos al formato nuevo sin perder informacion.
function normalizarCentros(centros) {
  return (centros || []).map((c) => {
    if (typeof c === 'string') return { nombre: c, previsiones: [] };
    return { nombre: c.nombre, previsiones: c.previsiones || [] };
  });
}

/**
 * Se conecta a Firestore y mantiene el estado local sincronizado en tiempo
 * real: cualquier cambio (propio o de otro dispositivo) actualiza `state` y
 * dispara onDatosActualizados(esPrimeraVez). La promesa devuelta se resuelve
 * cuando llega la primera carga de datos.
 */
export function iniciarSincronizacion(uid, onDatosActualizados) {
  return asegurarMigracion(uid).then(
    () =>
      new Promise((resolve) => {
        let esPrimeraVez = true;
        detenerEscucha = escucharDatosUsuario(uid, ({ pacientes, centros }) => {
          state.pacientes = pacientes;
          state.centros = normalizarCentros(centros.length ? centros : centrosPorDefecto());
          onDatosActualizados(esPrimeraVez);
          if (esPrimeraVez) {
            esPrimeraVez = false;
            resolve();
          }
        });
      })
  );
}

export function detenerSincronizacion() {
  if (detenerEscucha) {
    detenerEscucha();
    detenerEscucha = null;
  }
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

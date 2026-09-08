import { guardarDatosUsuario as guardarFirestore, escucharDatosUsuario, guardarInfoUsuario } from './firebase/firestoreDataService.js';
import { asegurarMigracion } from './firebase/migration.js';
import { centrosPorDefecto } from './firebase/realtimeDataService.js';

export const state = {
  currentUser: null,
  pacientes: [],
  centros: [],
  turnos: [],
  cirugias: [],
  plan: 'gratis',
  planVenceEl: null
};

export const LIMITES_PLAN_GRATIS = {
  centros: 1,
  registros: 25
};

// Pro solo cuenta si ademas no vencio. Sin fecha de vencimiento (cuentas
// activadas antes de esta funcion, o casos especiales) el plan no vence.
export function esPlanPro() {
  if (state.plan !== 'pro') return false;
  if (!state.planVenceEl) return true;
  return new Date(state.planVenceEl) >= new Date();
}

let detenerEscucha = null;

// Centros venian antes como simples strings (["Clínica A", ...]). Ahora cada
// centro es un objeto con sus previsiones y tipos de turno
// ({ nombre, previsiones: [...], tiposTurno: [...] }). Esto convierte datos
// viejos al formato nuevo sin perder informacion.
function normalizarCentros(centros) {
  return (centros || []).map((c) => {
    if (typeof c === 'string') return { nombre: c, previsiones: [], tiposTurno: [], tiposCirugia: [] };
    return {
      nombre: c.nombre,
      previsiones: c.previsiones || [],
      tiposTurno: c.tiposTurno || [],
      tiposCirugia: c.tiposCirugia || []
    };
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
        detenerEscucha = escucharDatosUsuario(uid, ({ pacientes, centros, turnos, cirugias, plan, planVenceEl }) => {
          state.pacientes = pacientes;
          state.centros = normalizarCentros(centros.length ? centros : centrosPorDefecto());
          state.turnos = turnos || [];
          state.cirugias = cirugias || [];
          state.plan = plan || 'gratis';
          state.planVenceEl = planVenceEl || null;

          // Si el plan Pro vencio, la app misma lo corrige en Firestore para
          // que quede al dia (sin necesidad de que un admin lo haga a mano).
          if (state.plan === 'pro' && state.planVenceEl && new Date(state.planVenceEl) < new Date()) {
            state.plan = 'gratis';
            guardarInfoUsuario(uid, { plan: 'gratis' }).catch((error) =>
              console.error('Error al bajar el plan vencido:', error)
            );
          }

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
      centros: state.centros,
      turnos: state.turnos,
      cirugias: state.cirugias
    });
  } catch (error) {
    console.error('Error al guardar en Firestore:', error);
  }
}

export function resetState() {
  state.pacientes = [];
  state.centros = normalizarCentros(centrosPorDefecto());
  state.turnos = [];
  state.cirugias = [];
  state.plan = 'gratis';
  state.planVenceEl = null;
}

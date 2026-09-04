import { state, guardarDatos, resetState } from '../store.js';
import { descargarArchivo } from '../utils/download.js';
import { mostrarAviso, mostrarToast, pedirConfirmacion } from '../ui/notificaciones.js';

export function exportarBackup() {
  if (state.pacientes.length === 0) {
    mostrarAviso('No hay datos para exportar.', 'advertencia');
    return;
  }

  const backup = {
    fechaExportacion: new Date().toISOString(),
    totalRegistros: state.pacientes.length,
    centros: state.centros,
    pacientes: state.pacientes
  };

  const jsonString = JSON.stringify(backup, null, 2);
  const filename = `ClinicaFlow_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  descargarArchivo(jsonString, filename, 'application/json');
}

export function importarBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const backup = JSON.parse(e.target.result);
      if (!backup.pacientes || !Array.isArray(backup.pacientes)) throw new Error('Formato inválido');
      if (await pedirConfirmacion(`¿Importar ${backup.totalRegistros} registros?`)) {
        state.pacientes = backup.pacientes;
        if (backup.centros) state.centros = backup.centros;
        guardarDatos();
        mostrarToast('Backup importado.', 'exito');
        setTimeout(() => location.reload(), 1200);
      }
    } catch (error) {
      mostrarAviso('Archivo inválido.', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

export async function limpiarTodo() {
  if (await pedirConfirmacion('¿Eliminar TODOS los registros?')) {
    resetState();
    guardarDatos();
    mostrarToast('Datos eliminados', 'exito');
    setTimeout(() => location.reload(), 1200);
  }
}

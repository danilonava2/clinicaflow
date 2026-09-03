import { state, guardarDatos, resetState } from '../store.js';
import { descargarArchivo } from '../utils/download.js';

export function exportarBackup() {
  if (state.pacientes.length === 0) {
    alert('No hay datos para exportar.');
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
  reader.onload = function (e) {
    try {
      const backup = JSON.parse(e.target.result);
      if (!backup.pacientes || !Array.isArray(backup.pacientes)) throw new Error('Formato inválido');
      if (confirm(`¿Importar ${backup.totalRegistros} registros?`)) {
        state.pacientes = backup.pacientes;
        if (backup.centros) state.centros = backup.centros;
        guardarDatos();
        alert('Backup importado.');
        location.reload();
      }
    } catch (error) {
      alert('Archivo inválido.');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

export function limpiarTodo() {
  if (confirm('¿Eliminar TODOS los registros?')) {
    resetState();
    guardarDatos();
    alert('Datos eliminados');
    location.reload();
  }
}

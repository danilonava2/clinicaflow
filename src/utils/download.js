import { mostrarToast, mostrarAviso } from '../ui/notificaciones.js';

export function descargarArchivo(data, filename, mimeType = 'application/octet-stream') {
  try {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);

    mostrarToast(`<strong>Descarga completada</strong><br><span style="font-size:12px;opacity:0.9;">${filename}</span>`, 'exito');
  } catch (e) {
    console.error('Error en descarga:', e);
    mostrarAviso('Error al preparar la descarga:\n' + e.message, 'error');
  }
}

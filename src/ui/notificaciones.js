const ICONOS = { exito: '✅', error: '❌', advertencia: '⚠️', info: 'ℹ️' };

let resolverConfirmacion = null;

export function mostrarAviso(mensaje, tipo = 'info') {
  const modal = document.getElementById('avisoModal');
  const contenido = modal.querySelector('.modal-content');
  contenido.className = `modal-content aviso-modal-content aviso-${tipo}`;
  document.getElementById('avisoIcono').innerText = ICONOS[tipo] || ICONOS.info;
  document.getElementById('avisoMensaje').innerText = mensaje;
  modal.style.display = 'flex';
}

export function cerrarAviso() {
  document.getElementById('avisoModal').style.display = 'none';
}

export function pedirConfirmacion(mensaje) {
  document.getElementById('confirmMessage').innerText = mensaje;
  document.getElementById('confirmModal').style.display = 'flex';
  return new Promise((resolve) => {
    resolverConfirmacion = resolve;
  });
}

export function confirmarAccion(confirmado) {
  document.getElementById('confirmModal').style.display = 'none';
  if (resolverConfirmacion) {
    resolverConfirmacion(confirmado);
    resolverConfirmacion = null;
  }
}

function construirIcono(tipo) {
  if (tipo === 'exito') {
    return `<svg class="toast-icono-svg" viewBox="0 0 52 52">
      <circle class="toast-circulo toast-circulo-exito" cx="26" cy="26" r="24" fill="none"/>
      <path class="toast-marca toast-check" fill="none" d="M14 27l7 7 16-16"/>
    </svg>`;
  }
  if (tipo === 'error') {
    return `<svg class="toast-icono-svg" viewBox="0 0 52 52">
      <circle class="toast-circulo toast-circulo-error" cx="26" cy="26" r="24" fill="none"/>
      <path class="toast-marca toast-x1" fill="none" d="M16 16 L36 36"/>
      <path class="toast-marca toast-x2" fill="none" d="M36 16 L16 36"/>
    </svg>`;
  }
  return `<div class="toast-emoji">${ICONOS[tipo] || ICONOS.info}</div>`;
}

// Aviso centrado, no bloqueante, que se cierra solo (reemplaza los antiguos
// alerts de exito). Con animacion de check/X dibujandose para sentirse mas
// moderno y dar feedback claro de que la accion se realizo.
export function mostrarToast(mensaje, tipo = 'exito') {
  const overlay = document.createElement('div');
  overlay.className = 'toast-overlay';
  overlay.innerHTML = `
    <div class="toast-card toast-${tipo}">
      ${construirIcono(tipo)}
      <p class="toast-mensaje">${mensaje}</p>
    </div>
  `;
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add('toast-saliendo');
    setTimeout(() => overlay.remove(), 300);
  }, 2200);
}

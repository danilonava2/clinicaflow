const TIEMPO_INACTIVIDAD_MS = 30 * 60 * 1000; // 30 minutos
const EVENTOS_ACTIVIDAD = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

let timeoutId = null;
let onTimeoutCallback = null;

function reiniciarTimer() {
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    if (onTimeoutCallback) onTimeoutCallback();
  }, TIEMPO_INACTIVIDAD_MS);
}

export function iniciarControlInactividad(onTimeout) {
  onTimeoutCallback = onTimeout;
  EVENTOS_ACTIVIDAD.forEach((evento) => document.addEventListener(evento, reiniciarTimer));
  reiniciarTimer();
}

export function detenerControlInactividad() {
  EVENTOS_ACTIVIDAD.forEach((evento) => document.removeEventListener(evento, reiniciarTimer));
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = null;
  onTimeoutCallback = null;
}

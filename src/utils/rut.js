export function validarRUT(rut) {
  if (!rut) return false;
  const limpio = rut.replace(/[^0-9kK]/g, '');
  if (limpio.length < 2) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1).toUpperCase();
  let suma = 0;
  let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo.charAt(i)) * mult;
    mult = mult < 7 ? mult + 1 : 2;
  }
  const esperado = 11 - (suma % 11);
  const calculado = esperado === 11 ? '0' : esperado === 10 ? 'K' : esperado.toString();
  return dv === calculado;
}

export function formatearRutInput(input) {
  if (!input) return;
  let rut = input.value.replace(/[^0-9kK]/g, '').toUpperCase();
  if (rut.length > 9) rut = rut.substring(0, 9);
  if (rut.length > 1) {
    let cuerpo = rut.slice(0, -1);
    const dv = rut.slice(-1);
    cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    input.value = cuerpo + '-' + dv;
  } else {
    input.value = rut;
  }
}

// Muestra un ✅/❌ junto al campo mientras se escribe. No bloquea nada por
// si solo (los formularios de datos siguen validando al enviar); es solo
// feedback visual, util tambien en los campos de busqueda por RUT parcial.
export function actualizarIndicadorRUT(inputId, statusId) {
  const input = document.getElementById(inputId);
  const status = document.getElementById(statusId);
  if (!input || !status) return;

  const limpio = input.value.replace(/[^0-9kK]/g, '');
  if (limpio.length < 7) {
    status.innerHTML = '';
    return;
  }
  status.innerHTML = validarRUT(input.value) ? '✅' : '❌';
}

export function formatearRutParaMostrar(rut) {
  if (!rut || rut.includes('-')) return rut || '';
  const rutLimpio = rut.replace(/[^0-9kK]/g, '');
  if (rutLimpio.length <= 1) return rut;
  const cuerpo = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1).toUpperCase();
  let cuerpoFormateado = '';
  for (let i = cuerpo.length; i > 0; i -= 3) {
    const inicio = Math.max(0, i - 3);
    cuerpoFormateado = (cuerpoFormateado ? '.' : '') + cuerpo.substring(inicio, i);
  }
  return cuerpoFormateado + '-' + dv;
}

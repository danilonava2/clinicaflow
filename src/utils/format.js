export function formatearFecha(fechaISO) {
  if (!fechaISO) return '';
  const partes = fechaISO.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return fechaISO;
}

export function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, (m) => (m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;'));
}

export function formatearMonto(monto) {
  return `$${Number(monto || 0).toLocaleString('es-CL')}`;
}

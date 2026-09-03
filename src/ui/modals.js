let pendingConfirmAction = null;
let pendingDuplicateData = null;

export function abrirModalExito() {
  document.getElementById('successModal').style.display = 'flex';
}

export function cerrarModal() {
  document.getElementById('successModal').style.display = 'none';
}

export function cerrarEditModal() {
  document.getElementById('editModal').style.display = 'none';
}

export function pedirConfirmacion(mensaje, accion) {
  pendingConfirmAction = accion;
  document.getElementById('confirmMessage').innerText = mensaje;
  document.getElementById('confirmModal').style.display = 'flex';
}

export function confirmAction(confirmado) {
  if (confirmado && pendingConfirmAction) pendingConfirmAction();
  document.getElementById('confirmModal').style.display = 'none';
  pendingConfirmAction = null;
}

export function abrirModalDuplicado(html, datosNuevoRegistro) {
  pendingDuplicateData = datosNuevoRegistro;
  document.getElementById('duplicateContent').innerHTML = html;
  document.getElementById('duplicateWarningModal').style.display = 'flex';
}

export function cerrarModalDuplicado() {
  document.getElementById('duplicateWarningModal').style.display = 'none';
  pendingDuplicateData = null;
}

export function getPendingDuplicateData() {
  return pendingDuplicateData;
}

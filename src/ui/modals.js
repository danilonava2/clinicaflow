let pendingDuplicateData = null;

export function cerrarEditModal() {
  document.getElementById('editModal').style.display = 'none';
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

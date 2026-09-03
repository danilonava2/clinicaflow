import { state, guardarDatos } from '../store.js';
import { validarRUT } from '../utils/rut.js';
import { formatearFecha, formatearMonto, escapeHtml } from '../utils/format.js';
import { formatearRutParaMostrar } from '../utils/rut.js';
import {
  abrirModalExito,
  abrirModalDuplicado,
  cerrarModalDuplicado,
  getPendingDuplicateData
} from '../ui/modals.js';

const ITEMS_PER_PAGE = 10;
let currentPage = 1;

export function actualizarContador() {
  const count = state.pacientes.length;
  const contador = document.getElementById('contador-registros');
  if (contador) contador.innerHTML = `${count} registros`;

  const mobileContador = document.getElementById('mobileContadorRegistros');
  if (mobileContador) mobileContador.innerHTML = `${count} registros`;
}

export function actualizarPrevisionesDisponibles(selectCentroId, selectPrevisionId) {
  const centroNombre = document.getElementById(selectCentroId).value;
  const previsionSelect = document.getElementById(selectPrevisionId);
  const centro = state.centros.find((c) => c.nombre === centroNombre);
  const previsiones = centro?.previsiones || [];

  if (!centroNombre) {
    previsionSelect.innerHTML = '<option value="">-- Selecciona un centro primero --</option>';
    previsionSelect.disabled = true;
    return;
  }
  if (previsiones.length === 0) {
    previsionSelect.innerHTML = '<option value="">-- Sin previsiones, agrega en "Centros" --</option>';
    previsionSelect.disabled = true;
    return;
  }
  previsionSelect.disabled = false;
  previsionSelect.innerHTML = '<option value="">-- Seleccionar previsión --</option>';
  previsiones.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.nombre;
    opt.textContent = p.nombre;
    previsionSelect.appendChild(opt);
  });
}

export function autocompletarMontoPorPrevision(selectCentroId, selectPrevisionId, montoInputId) {
  const centroNombre = document.getElementById(selectCentroId).value;
  const previsionNombre = document.getElementById(selectPrevisionId).value;
  const centro = state.centros.find((c) => c.nombre === centroNombre);
  const prevision = centro?.previsiones.find((p) => p.nombre === previsionNombre);
  if (prevision) {
    document.getElementById(montoInputId).value = prevision.monto;
  }
}

function buscarRegistrosAnteriores(rut) {
  if (!rut) return [];
  const limpio = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  return state.pacientes
    .filter((p) => p.rut.replace(/[^0-9kK]/g, '').toUpperCase() === limpio)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

function mostrarAdvertenciaDuplicado(rut, nuevoRegistro) {
  const previos = buscarRegistrosAnteriores(rut);
  if (previos.length === 0) return false;
  let html = `<p>⚠️ Este RUT ya tiene ${previos.length} atención(es):</p>
    <table style="width:100%; border-collapse:collapse;">
      <thead><tr><th>Fecha</th><th>Monto</th><th>Centro</th></tr></thead>
      <tbody>`;
  previos.forEach((r) => {
    html += `<tr><td style="padding:8px;">${r.fecha}</td><td style="padding:8px;">${formatearMonto(r.monto)}</td><td style="padding:8px;">${r.institucion || '-'}</td></tr>`;
  });
  const total = previos.reduce((s, r) => s + (Number(r.monto) || 0), 0);
  html += `</tbody>
    </table>
    <div>💰 Total acumulado: ${formatearMonto(total)}</div>
    <p>¿Registrar nueva atención?</p>`;
  abrirModalDuplicado(html, nuevoRegistro);
  return true;
}

export function registrarDuplicadoConfirmado() {
  const nuevo = getPendingDuplicateData();
  if (nuevo) {
    state.pacientes.unshift(nuevo);
    guardarDatos();
    actualizarContador();
    abrirModalExito();
    document.getElementById('formPaciente').reset();
    document.getElementById('fecha').valueAsDate = new Date();
    actualizarPrevisionesDisponibles('selectInstitucion', 'selectPrevision');
    cerrarModalDuplicado();
  }
}

export function registrarAtencion(event) {
  event.preventDefault();
  const rut = document.getElementById('rut').value;
  if (!validarRUT(rut)) {
    alert('❌ RUT inválido.');
    return;
  }
  const nuevo = {
    id: Date.now().toString(),
    fecha: document.getElementById('fecha').value,
    nombre: document.getElementById('nombre').value.trim(),
    rut,
    institucion: document.getElementById('selectInstitucion').value,
    prevision: document.getElementById('selectPrevision').value,
    monto: parseInt(document.getElementById('monto').value) || 0,
    timestamp: Date.now()
  };
  if (!nuevo.institucion) {
    alert('Selecciona un centro');
    return;
  }
  if (!nuevo.prevision) {
    alert('Selecciona una previsión');
    return;
  }
  const previos = buscarRegistrosAnteriores(rut);
  if (previos.length > 0) {
    mostrarAdvertenciaDuplicado(rut, nuevo);
  } else {
    state.pacientes.unshift(nuevo);
    guardarDatos();
    actualizarContador();
    abrirModalExito();
    event.target.reset();
    document.getElementById('fecha').valueAsDate = new Date();
    actualizarPrevisionesDisponibles('selectInstitucion', 'selectPrevision');
  }
}

export function buscarPacientes(page = 1) {
  const fi = document.getElementById('busquedaFechaInicio').value;
  const ff = document.getElementById('busquedaFechaFin').value;
  const nom = document.getElementById('busquedaNombre').value.trim().toLowerCase();
  const rut = document.getElementById('busquedaRut').value.trim().toLowerCase();
  const inst = document.getElementById('busquedaInstitucionSelect').value;
  const start = fi ? new Date(fi) : null;
  const end = ff ? new Date(ff) : null;
  if (end) end.setHours(23, 59, 59);

  const filtered = state.pacientes.filter((p) => {
    const fecha = new Date(p.fecha);
    return (
      (!start || !end || (fecha >= start && fecha <= end)) &&
      (!nom || p.nombre.toLowerCase().includes(nom)) &&
      (!rut || p.rut.toLowerCase().includes(rut)) &&
      (!inst || p.institucion === inst)
    );
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  renderResultados(paginated, filtered.length, page, totalPages);
  currentPage = page;
}

function renderResultados(paginated, total, pageNum, totalPages) {
  const div = document.getElementById('resultados');
  if (!div) return;
  if (paginated.length === 0) {
    div.innerHTML = '<p>No se encontraron atenciones.</p>';
    document.getElementById('paginacion').innerHTML = '';
    return;
  }
  let html = `<div style="overflow-x:auto;"><table class="tabla-resultados"><thead>
    <tr><th>Fecha</th><th>Paciente</th><th>RUT</th><th>Centro</th><th>Previsión</th><th>Monto</th><th>Acciones</th></tr>
    </thead><tbody>`;
  paginated.forEach((p) => {
    html += `<tr>
      <td>${formatearFecha(p.fecha)}</td>
      <td>${escapeHtml(p.nombre)}</td>
      <td>${formatearRutParaMostrar(p.rut)}</td>
      <td>${escapeHtml(p.institucion || '-')}</td>
      <td>${escapeHtml(p.prevision || '-')}</td>
      <td>${formatearMonto(p.monto)}</td>
      <td><button onclick="editarRegistro('${p.id}')" class="btn-edit">✏️</button>
      <button onclick="eliminarRegistro('${p.rut}','${p.id}')" class="btn-delete">🗑️</button></td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  div.innerHTML = html;

  let pagHtml = '<div class="pagination-container">';
  if (pageNum > 1) pagHtml += `<button onclick="buscarPacientes(${pageNum - 1})" class="btn-secondary">⬅ Anterior</button>`;
  pagHtml += `<span>Página ${pageNum} de ${totalPages}</span>`;
  if (pageNum < totalPages) pagHtml += `<button onclick="buscarPacientes(${pageNum + 1})" class="btn-secondary">Siguiente ➡</button>`;
  pagHtml += '</div>';
  document.getElementById('paginacion').innerHTML = pagHtml;
}

export function limpiarFiltrosBusqueda() {
  ['busquedaFechaInicio', 'busquedaFechaFin', 'busquedaNombre', 'busquedaRut'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sel = document.getElementById('busquedaInstitucionSelect');
  if (sel) sel.value = '';
  buscarPacientes(1);
}

export function editarRegistro(id) {
  const p = state.pacientes.find((i) => i.id === id);
  if (!p) return;
  document.getElementById('editId').value = id;
  document.getElementById('editFecha').value = p.fecha;
  document.getElementById('editNombre').value = p.nombre;
  document.getElementById('editRut').value = p.rut;
  const sel = document.getElementById('editSelectInstitucion');
  if (sel) sel.value = p.institucion;
  actualizarPrevisionesDisponibles('editSelectInstitucion', 'editSelectPrevision');
  const previsionSel = document.getElementById('editSelectPrevision');
  if (previsionSel) previsionSel.value = p.prevision || '';
  document.getElementById('editMonto').value = p.monto;
  document.getElementById('editModal').style.display = 'flex';
}

export function guardarEdicion() {
  const id = document.getElementById('editId').value;
  const idx = state.pacientes.findIndex((p) => p.id === id);
  if (idx === -1) return;
  const rut = document.getElementById('editRut').value;
  if (!validarRUT(rut)) {
    alert('❌ RUT inválido.');
    return;
  }
  state.pacientes[idx].fecha = document.getElementById('editFecha').value;
  state.pacientes[idx].nombre = document.getElementById('editNombre').value.trim();
  state.pacientes[idx].rut = rut;
  state.pacientes[idx].institucion = document.getElementById('editSelectInstitucion').value;
  state.pacientes[idx].prevision = document.getElementById('editSelectPrevision').value;
  state.pacientes[idx].monto = parseInt(document.getElementById('editMonto').value) || 0;
  guardarDatos();
  alert('✅ Actualizado');
  document.getElementById('editModal').style.display = 'none';
  buscarPacientes(currentPage);
}

export function eliminarRegistro(rut, id) {
  if (!confirm(`¿Eliminar atención de ${rut}?`)) return;
  state.pacientes = state.pacientes.filter((p) => p.id !== id);
  guardarDatos();
  actualizarContador();
  alert('Eliminado');
  buscarPacientes(currentPage);
}

import { state, guardarDatos } from '../store.js';
import { escapeHtml, formatearMonto } from '../utils/format.js';
import { cargarDashboard } from './dashboard.js';
import { buscarPacientes } from './pacientes.js';
import { mostrarAviso, mostrarToast, pedirConfirmacion } from '../ui/notificaciones.js';

export function renderListaCentros() {
  const container = document.getElementById('listaCentros');
  if (!container) return;
  if (state.centros.length === 0) {
    container.innerHTML = '<p>No hay centros agregados. Agrega los lugares donde atiendes.</p>';
    return;
  }
  const mesActual = new Date().toISOString().substring(0, 7);

  let html = '<div class="centros-grid">';
  state.centros.forEach((centro, index) => {
    const registrosDelMes = state.pacientes.filter(
      (p) => p.institucion === centro.nombre && p.fecha?.substring(0, 7) === mesActual
    );
    const totalIngresosDelMes = registrosDelMes.reduce((s, p) => s + (Number(p.monto) || 0), 0);

    html += `<div class="centro-card">
      <div class="centro-header">
        <span>🏥 ${escapeHtml(centro.nombre)}</span>
        <div>
          <button onclick="editarCentro(${index})" class="btn-edit" style="margin-right:5px;">✏️</button>
          <button onclick="eliminarCentro(${index})" class="btn-delete">🗑️</button>
        </div>
      </div>
      <div class="centro-stats">
        <span>📅 Este mes: ${registrosDelMes.length} atención${registrosDelMes.length === 1 ? '' : 'es'}</span>
        <span>💰 ${formatearMonto(totalIngresosDelMes)}</span>
      </div>
      <div class="previsiones-list">`;

    if (centro.previsiones.length === 0) {
      html += '<p style="color:#94a3b8; font-size:13px; margin:0;">Sin previsiones configuradas todavía.</p>';
    } else {
      centro.previsiones.forEach((prevision, previsionIndex) => {
        html += `<div class="prevision-item">
          <span>🩺 ${escapeHtml(prevision.nombre)} — ${formatearMonto(prevision.monto)}</span>
          <div>
            <button onclick="editarPrevision(${index},${previsionIndex})" class="btn-edit" style="margin-right:5px;">✏️</button>
            <button onclick="eliminarPrevision(${index},${previsionIndex})" class="btn-delete">🗑️</button>
          </div>
        </div>`;
      });
    }

    html += `<div class="prevision-add-form">
        <input type="text" id="nuevaPrevisionNombre-${index}" placeholder="Nombre previsión (ej: Fonasa)">
        <input type="number" id="nuevaPrevisionMonto-${index}" placeholder="Monto">
        <button onclick="agregarPrevision(${index})" class="btn-secondary">+ Agregar previsión</button>
      </div>
    </div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

function refrescarVistasDependientes() {
  if (document.getElementById('section-dashboard').classList.contains('active')) cargarDashboard();
  if (document.getElementById('section-buscar').classList.contains('active')) buscarPacientes();
}

// ==================== RENOMBRAR CENTRO ====================
export function editarCentro(index) {
  const centro = state.centros[index];
  document.getElementById('renombrarCentroIndex').value = index;
  document.getElementById('renombrarCentroInput').value = centro.nombre;
  document.getElementById('renombrarCentroModal').style.display = 'flex';
}

export function cerrarRenombrarCentroModal() {
  document.getElementById('renombrarCentroModal').style.display = 'none';
}

export function confirmarRenombrarCentro() {
  const index = parseInt(document.getElementById('renombrarCentroIndex').value);
  const nuevoNombre = document.getElementById('renombrarCentroInput').value.trim();
  const centroActual = state.centros[index];

  if (!nuevoNombre || nuevoNombre === centroActual.nombre) {
    cerrarRenombrarCentroModal();
    return;
  }
  if (state.centros.some((c) => c.nombre === nuevoNombre)) {
    mostrarAviso('Ya existe un centro con ese nombre', 'advertencia');
    return;
  }

  const nombreAnterior = centroActual.nombre;
  centroActual.nombre = nuevoNombre;
  let registrosActualizados = 0;
  state.pacientes = state.pacientes.map((p) => {
    if (p.institucion === nombreAnterior) {
      registrosActualizados++;
      return { ...p, institucion: nuevoNombre };
    }
    return p;
  });

  guardarDatos();
  renderListaCentros();
  actualizarSelectCentros();
  actualizarSelectPrevisionDashboard();
  cerrarRenombrarCentroModal();
  mostrarToast(`"${nombreAnterior}" → "${nuevoNombre}" (${registrosActualizados} registro(s) actualizados)`, 'exito');
  refrescarVistasDependientes();
}

// ==================== ELIMINAR CENTRO ====================
export function eliminarCentro(index) {
  const centro = state.centros[index];
  const cantidad = state.pacientes.filter((p) => p.institucion === centro.nombre).length;

  document.getElementById('eliminarCentroIndex').value = index;
  document.getElementById('eliminarCentroInfo').innerText = `"${centro.nombre}" tiene ${cantidad} registro(s) asociado(s). ¿Qué quieres hacer?`;
  document.querySelector('input[name="opcionEliminarCentro"][value="mantener"]').checked = true;

  const otros = state.centros.filter((c, i) => i !== index);
  const select = document.getElementById('reasignarCentroSelect');
  select.innerHTML = otros.map((c) => `<option value="${escapeHtml(c.nombre)}">${escapeHtml(c.nombre)}</option>`).join('');
  document.getElementById('reasignarCentroSelectWrap').style.display = 'none';

  document.getElementById('eliminarCentroModal').style.display = 'flex';
}

export function cerrarEliminarCentroModal() {
  document.getElementById('eliminarCentroModal').style.display = 'none';
}

export function alCambiarOpcionEliminarCentro() {
  const opcion = document.querySelector('input[name="opcionEliminarCentro"]:checked').value;
  document.getElementById('reasignarCentroSelectWrap').style.display = opcion === 'reasignar' ? 'block' : 'none';
}

export async function confirmarEliminarCentro() {
  const index = parseInt(document.getElementById('eliminarCentroIndex').value);
  const opcion = document.querySelector('input[name="opcionEliminarCentro"]:checked').value;
  const centro = state.centros[index];
  const cantidad = state.pacientes.filter((p) => p.institucion === centro.nombre).length;

  if (opcion === 'mantener') {
    state.centros.splice(index, 1);
    guardarDatos();
    renderListaCentros();
    actualizarSelectCentros();
    actualizarSelectPrevisionDashboard();
    cerrarEliminarCentroModal();
    mostrarToast(`Centro "${centro.nombre}" eliminado. Los registros conservan el nombre.`, 'exito');
  } else if (opcion === 'eliminar') {
    cerrarEliminarCentroModal();
    if (!(await pedirConfirmacion(`¿Eliminar ${cantidad} registro(s) junto con el centro? Esta acción no se puede deshacer.`))) return;
    state.pacientes = state.pacientes.filter((p) => p.institucion !== centro.nombre);
    state.centros.splice(index, 1);
    guardarDatos();
    renderListaCentros();
    actualizarSelectCentros();
    actualizarSelectPrevisionDashboard();
    mostrarToast(`Se eliminaron ${cantidad} registro(s) y el centro.`, 'exito');
    refrescarVistasDependientes();
  } else if (opcion === 'reasignar') {
    const nuevoNombre = document.getElementById('reasignarCentroSelect').value;
    if (!nuevoNombre) {
      mostrarAviso('No hay otro centro disponible para reasignar.', 'advertencia');
      return;
    }
    state.pacientes = state.pacientes.map((p) => (p.institucion === centro.nombre ? { ...p, institucion: nuevoNombre } : p));
    state.centros.splice(index, 1);
    guardarDatos();
    renderListaCentros();
    actualizarSelectCentros();
    actualizarSelectPrevisionDashboard();
    cerrarEliminarCentroModal();
    mostrarToast(`${cantidad} registro(s) reasignados a "${nuevoNombre}"`, 'exito');
    refrescarVistasDependientes();
  }
}

// ==================== AGREGAR CENTRO ====================
export function agregarCentro() {
  const input = document.getElementById('nuevoCentro');
  const nombre = input.value.trim();
  if (!nombre) {
    mostrarAviso('Ingresa un nombre', 'advertencia');
    return;
  }
  if (state.centros.some((c) => c.nombre === nombre)) {
    mostrarAviso('Ya existe un centro con ese nombre', 'advertencia');
    return;
  }
  state.centros.push({ nombre, previsiones: [] });
  guardarDatos();
  renderListaCentros();
  actualizarSelectCentros();
  input.value = '';
  mostrarToast(`Centro "${nombre}" agregado`, 'exito');
}

// ==================== PREVISIONES ====================
export function agregarPrevision(centroIndex) {
  const nombreInput = document.getElementById(`nuevaPrevisionNombre-${centroIndex}`);
  const montoInput = document.getElementById(`nuevaPrevisionMonto-${centroIndex}`);
  const nombre = nombreInput.value.trim();
  const monto = parseInt(montoInput.value) || 0;
  if (!nombre) {
    mostrarAviso('Ingresa un nombre para la previsión', 'advertencia');
    return;
  }
  const centro = state.centros[centroIndex];
  if (centro.previsiones.some((p) => p.nombre === nombre)) {
    mostrarAviso('Ya existe una previsión con ese nombre en este centro', 'advertencia');
    return;
  }
  centro.previsiones.push({ nombre, monto });
  guardarDatos();
  renderListaCentros();
  actualizarSelectPrevisionDashboard();
  mostrarToast(`Previsión "${nombre}" agregada`, 'exito');
}

export function editarPrevision(centroIndex, previsionIndex) {
  const prevision = state.centros[centroIndex].previsiones[previsionIndex];
  document.getElementById('editarPrevisionCentroIndex').value = centroIndex;
  document.getElementById('editarPrevisionIndex').value = previsionIndex;
  document.getElementById('editarPrevisionNombreInput').value = prevision.nombre;
  document.getElementById('editarPrevisionMontoInput').value = prevision.monto;
  document.getElementById('editarPrevisionModal').style.display = 'flex';
}

export function cerrarEditarPrevisionModal() {
  document.getElementById('editarPrevisionModal').style.display = 'none';
}

export function confirmarEditarPrevision() {
  const centroIndex = parseInt(document.getElementById('editarPrevisionCentroIndex').value);
  const previsionIndex = parseInt(document.getElementById('editarPrevisionIndex').value);
  const prevision = state.centros[centroIndex].previsiones[previsionIndex];

  const nuevoNombre = document.getElementById('editarPrevisionNombreInput').value.trim();
  const nuevoMonto = parseInt(document.getElementById('editarPrevisionMontoInput').value) || 0;

  prevision.nombre = nuevoNombre || prevision.nombre;
  prevision.monto = nuevoMonto;
  guardarDatos();
  renderListaCentros();
  actualizarSelectPrevisionDashboard();
  cerrarEditarPrevisionModal();
  mostrarToast('Previsión actualizada.', 'exito');
}

export async function eliminarPrevision(centroIndex, previsionIndex) {
  const centro = state.centros[centroIndex];
  const prevision = centro.previsiones[previsionIndex];
  if (!(await pedirConfirmacion(`¿Eliminar la previsión "${prevision.nombre}"?`))) return;
  centro.previsiones.splice(previsionIndex, 1);
  guardarDatos();
  renderListaCentros();
  actualizarSelectPrevisionDashboard();
  mostrarToast('Previsión eliminada.', 'exito');
}

// ==================== SELECTS COMPARTIDOS ====================
export function actualizarSelectCentros() {
  const selects = [
    document.getElementById('selectInstitucion'),
    document.getElementById('busquedaInstitucionSelect'),
    document.getElementById('filtroInstitucionSelect'),
    document.getElementById('editSelectInstitucion'),
    document.getElementById('dashInstitucionSelect')
  ];
  selects.forEach((select) => {
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">-- Seleccionar centro --</option>';
    state.centros.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.nombre;
      opt.textContent = c.nombre;
      select.appendChild(opt);
    });
    if (current && state.centros.some((c) => c.nombre === current)) select.value = current;
  });

  const busq = document.getElementById('busquedaInstitucionSelect');
  if (busq) {
    let all = busq.querySelector('option[value=""]');
    if (!all) {
      all = document.createElement('option');
      all.value = '';
      all.textContent = 'Todos los centros';
      busq.insertBefore(all, busq.firstChild);
    }
    busq.value = '';
  }

  const rep = document.getElementById('filtroInstitucionSelect');
  if (rep) {
    let all = rep.querySelector('option[value=""]');
    if (!all) {
      all = document.createElement('option');
      all.value = '';
      all.textContent = 'Todos los centros';
      rep.insertBefore(all, rep.firstChild);
    }
    rep.value = '';
  }

  const dash = document.getElementById('dashInstitucionSelect');
  if (dash) {
    let all = dash.querySelector('option[value=""]');
    if (!all) {
      all = document.createElement('option');
      all.value = '';
      all.textContent = 'Todos los centros';
      dash.insertBefore(all, dash.firstChild);
    }
    dash.value = '';
  }
}

export function actualizarSelectPrevisionDashboard() {
  const nombres = new Set();
  state.centros.forEach((c) => c.previsiones.forEach((p) => nombres.add(p.nombre)));
  const nombresOrdenados = Array.from(nombres).sort();

  ['dashPrevisionSelect', 'busquedaPrevisionSelect'].forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '<option value="">Todas las previsiones</option>';
    nombresOrdenados.forEach((nombre) => {
      const opt = document.createElement('option');
      opt.value = nombre;
      opt.textContent = nombre;
      select.appendChild(opt);
    });
    select.value = '';
  });
}

export function migrarCentrosDesdePacientes() {
  const existentes = new Set(state.centros.map((c) => c.nombre));
  state.pacientes.forEach((p) => {
    if (p.institucion && p.institucion.trim()) existentes.add(p.institucion.trim());
  });
  const nombresActuales = new Set(state.centros.map((c) => c.nombre));
  const nuevos = Array.from(existentes).filter((nombre) => !nombresActuales.has(nombre));
  if (nuevos.length) {
    nuevos.forEach((nombre) => state.centros.push({ nombre, previsiones: [] }));
    guardarDatos();
  }
}

import { state, guardarDatos, esPlanPro, LIMITES_PLAN_GRATIS } from '../store.js';
import { escapeHtml, formatearMonto } from '../utils/format.js';
import { cargarDashboard } from './dashboard.js';
import { buscarPacientes } from './pacientes.js';
import { mostrarAviso, mostrarToast, mostrarToastConDeshacer, pedirConfirmacion } from '../ui/notificaciones.js';

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
    <div class="previsiones-list">
      <p style="font-size:12px; font-weight:600; color:#94a3b8; margin:0 0 4px 0;">🕐 TIPOS DE TURNO (Pro)</p>`;

    if (centro.tiposTurno.length === 0) {
      html += '<p style="color:#94a3b8; font-size:13px; margin:0;">Sin tipos de turno configurados todavía.</p>';
    } else {
      centro.tiposTurno.forEach((tipo, tipoIndex) => {
        html += `<div class="prevision-item">
          <span>🕐 ${escapeHtml(tipo.nombre)} — ${formatearMonto(tipo.valorHora)}/hora</span>
          <div>
            <button onclick="editarTipoTurno(${index},${tipoIndex})" class="btn-edit" style="margin-right:5px;">✏️</button>
            <button onclick="eliminarTipoTurno(${index},${tipoIndex})" class="btn-delete">🗑️</button>
          </div>
        </div>`;
      });
    }

    html += `<div class="prevision-add-form">
        <input type="text" id="nuevoTipoTurnoNombre-${index}" placeholder="Nombre (ej: Turno Extra)">
        <input type="number" id="nuevoTipoTurnoValorHora-${index}" placeholder="Valor por hora">
        <button onclick="agregarTipoTurno(${index})" class="btn-secondary">+ Agregar tipo de turno</button>
      </div>
    </div>
    <div class="previsiones-list">
      <p style="font-size:12px; font-weight:600; color:#94a3b8; margin:0 0 4px 0;">🔪 TIPOS DE CIRUGÍA (Pro)</p>`;

    if (centro.tiposCirugia.length === 0) {
      html += '<p style="color:#94a3b8; font-size:13px; margin:0;">Sin tipos de cirugía configurados todavía.</p>';
    } else {
      centro.tiposCirugia.forEach((tipo, tipoIndex) => {
        html += `<div class="prevision-item">
          <span>🔪 ${escapeHtml(tipo.nombre)} — ${formatearMonto(tipo.monto)}</span>
          <div>
            <button onclick="editarTipoCirugia(${index},${tipoIndex})" class="btn-edit" style="margin-right:5px;">✏️</button>
            <button onclick="eliminarTipoCirugia(${index},${tipoIndex})" class="btn-delete">🗑️</button>
          </div>
        </div>`;
      });
    }

    html += `<div class="prevision-add-form">
        <input type="text" id="nuevoTipoCirugiaNombre-${index}" placeholder="Nombre (ej: Apendicectomía)">
        <input type="number" id="nuevoTipoCirugiaMonto-${index}" placeholder="Monto">
        <button onclick="agregarTipoCirugia(${index})" class="btn-secondary">+ Agregar tipo de cirugía</button>
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
  state.turnos = state.turnos.map((t) => (t.centro === nombreAnterior ? { ...t, centro: nuevoNombre } : t));
  state.cirugias = state.cirugias.map((c) => (c.centro === nombreAnterior ? { ...c, centro: nuevoNombre } : c));

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

  const refrescarTodoCentros = () => {
    renderListaCentros();
    actualizarSelectCentros();
    actualizarSelectPrevisionDashboard();
  };

  if (opcion === 'mantener') {
    state.centros.splice(index, 1);
    guardarDatos();
    refrescarTodoCentros();
    cerrarEliminarCentroModal();
    mostrarToastConDeshacer(`Centro "${centro.nombre}" eliminado.`, () => {
      state.centros.splice(index, 0, centro);
      guardarDatos();
      refrescarTodoCentros();
    });
  } else if (opcion === 'eliminar') {
    cerrarEliminarCentroModal();
    if (!(await pedirConfirmacion(`¿Eliminar ${cantidad} registro(s) junto con el centro "${centro.nombre}"?`))) return;
    const eliminados = state.pacientes.filter((p) => p.institucion === centro.nombre);
    const turnosEliminados = state.turnos.filter((t) => t.centro === centro.nombre);
    const cirugiasEliminadas = state.cirugias.filter((c) => c.centro === centro.nombre);
    state.pacientes = state.pacientes.filter((p) => p.institucion !== centro.nombre);
    state.turnos = state.turnos.filter((t) => t.centro !== centro.nombre);
    state.cirugias = state.cirugias.filter((c) => c.centro !== centro.nombre);
    state.centros.splice(index, 1);
    guardarDatos();
    refrescarTodoCentros();
    refrescarVistasDependientes();
    mostrarToastConDeshacer(`Se eliminaron ${cantidad} registro(s) y el centro.`, () => {
      state.centros.splice(index, 0, centro);
      state.pacientes.unshift(...eliminados);
      state.turnos.unshift(...turnosEliminados);
      state.cirugias.unshift(...cirugiasEliminadas);
      guardarDatos();
      refrescarTodoCentros();
      refrescarVistasDependientes();
    });
  } else if (opcion === 'reasignar') {
    const nuevoNombre = document.getElementById('reasignarCentroSelect').value;
    if (!nuevoNombre) {
      mostrarAviso('No hay otro centro disponible para reasignar.', 'advertencia');
      return;
    }
    const idsReasignados = state.pacientes.filter((p) => p.institucion === centro.nombre).map((p) => p.id);
    const idsTurnosReasignados = state.turnos.filter((t) => t.centro === centro.nombre).map((t) => t.id);
    const idsCirugiasReasignadas = state.cirugias.filter((c) => c.centro === centro.nombre).map((c) => c.id);
    state.pacientes = state.pacientes.map((p) => (p.institucion === centro.nombre ? { ...p, institucion: nuevoNombre } : p));
    state.turnos = state.turnos.map((t) => (t.centro === centro.nombre ? { ...t, centro: nuevoNombre } : t));
    state.cirugias = state.cirugias.map((c) => (c.centro === centro.nombre ? { ...c, centro: nuevoNombre } : c));
    state.centros.splice(index, 1);
    guardarDatos();
    refrescarTodoCentros();
    cerrarEliminarCentroModal();
    refrescarVistasDependientes();
    mostrarToastConDeshacer(`${cantidad} registro(s) reasignados a "${nuevoNombre}"`, () => {
      state.centros.splice(index, 0, centro);
      state.pacientes = state.pacientes.map((p) =>
        idsReasignados.includes(p.id) ? { ...p, institucion: centro.nombre } : p
      );
      state.turnos = state.turnos.map((t) => (idsTurnosReasignados.includes(t.id) ? { ...t, centro: centro.nombre } : t));
      state.cirugias = state.cirugias.map((c) =>
        idsCirugiasReasignadas.includes(c.id) ? { ...c, centro: centro.nombre } : c
      );
      guardarDatos();
      refrescarTodoCentros();
      refrescarVistasDependientes();
    });
  }
}

// ==================== AGREGAR CENTRO ====================
export function agregarCentro() {
  if (!esPlanPro() && state.centros.length >= LIMITES_PLAN_GRATIS.centros) {
    mostrarAviso(
      `El plan gratis permite solo ${LIMITES_PLAN_GRATIS.centros} centro de atención. Actualiza a Pro para agregar más.`,
      'advertencia'
    );
    return;
  }
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
  state.centros.push({ nombre, previsiones: [], tiposTurno: [], tiposCirugia: [] });
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
  const [eliminada] = centro.previsiones.splice(previsionIndex, 1);
  guardarDatos();
  renderListaCentros();
  actualizarSelectPrevisionDashboard();
  mostrarToastConDeshacer('Previsión eliminada.', () => {
    centro.previsiones.splice(previsionIndex, 0, eliminada);
    guardarDatos();
    renderListaCentros();
    actualizarSelectPrevisionDashboard();
  });
}

// ==================== TIPOS DE TURNO ====================
export function agregarTipoTurno(centroIndex) {
  const nombreInput = document.getElementById(`nuevoTipoTurnoNombre-${centroIndex}`);
  const valorInput = document.getElementById(`nuevoTipoTurnoValorHora-${centroIndex}`);
  const nombre = nombreInput.value.trim();
  const valorHora = parseInt(valorInput.value) || 0;
  if (!nombre) {
    mostrarAviso('Ingresa un nombre para el tipo de turno', 'advertencia');
    return;
  }
  const centro = state.centros[centroIndex];
  if (centro.tiposTurno.some((t) => t.nombre === nombre)) {
    mostrarAviso('Ya existe un tipo de turno con ese nombre en este centro', 'advertencia');
    return;
  }
  centro.tiposTurno.push({ nombre, valorHora });
  guardarDatos();
  renderListaCentros();
  mostrarToast(`Tipo de turno "${nombre}" agregado`, 'exito');
}

export function editarTipoTurno(centroIndex, tipoIndex) {
  const tipo = state.centros[centroIndex].tiposTurno[tipoIndex];
  document.getElementById('editarTipoTurnoCentroIndex').value = centroIndex;
  document.getElementById('editarTipoTurnoIndex').value = tipoIndex;
  document.getElementById('editarTipoTurnoNombreInput').value = tipo.nombre;
  document.getElementById('editarTipoTurnoValorHoraInput').value = tipo.valorHora;
  document.getElementById('editarTipoTurnoModal').style.display = 'flex';
}

export function cerrarEditarTipoTurnoModal() {
  document.getElementById('editarTipoTurnoModal').style.display = 'none';
}

export function confirmarEditarTipoTurno() {
  const centroIndex = parseInt(document.getElementById('editarTipoTurnoCentroIndex').value);
  const tipoIndex = parseInt(document.getElementById('editarTipoTurnoIndex').value);
  const centro = state.centros[centroIndex];
  const tipo = centro.tiposTurno[tipoIndex];

  const nuevoNombre = document.getElementById('editarTipoTurnoNombreInput').value.trim();
  const nuevoValorHora = parseInt(document.getElementById('editarTipoTurnoValorHoraInput').value) || 0;
  const nombreAnterior = tipo.nombre;

  tipo.nombre = nuevoNombre || tipo.nombre;
  tipo.valorHora = nuevoValorHora;

  // Los turnos ya registrados con este tipo tambien deben reflejar el
  // cambio de nombre (el valor por hora ya cobrado no se toca, solo el
  // nombre para que el selector siga encontrando coincidencia al editar).
  if (tipo.nombre !== nombreAnterior) {
    state.turnos = state.turnos.map((t) =>
      t.centro === centro.nombre && t.tipo === nombreAnterior ? { ...t, tipo: tipo.nombre } : t
    );
  }

  guardarDatos();
  renderListaCentros();
  cerrarEditarTipoTurnoModal();
  mostrarToast('Tipo de turno actualizado.', 'exito');
}

export async function eliminarTipoTurno(centroIndex, tipoIndex) {
  const centro = state.centros[centroIndex];
  const tipo = centro.tiposTurno[tipoIndex];
  if (!(await pedirConfirmacion(`¿Eliminar el tipo de turno "${tipo.nombre}"?`))) return;
  const [eliminado] = centro.tiposTurno.splice(tipoIndex, 1);
  guardarDatos();
  renderListaCentros();
  mostrarToastConDeshacer('Tipo de turno eliminado.', () => {
    centro.tiposTurno.splice(tipoIndex, 0, eliminado);
    guardarDatos();
    renderListaCentros();
  });
}

// ==================== TIPOS DE CIRUGÍA ====================
export function agregarTipoCirugia(centroIndex) {
  const nombreInput = document.getElementById(`nuevoTipoCirugiaNombre-${centroIndex}`);
  const montoInput = document.getElementById(`nuevoTipoCirugiaMonto-${centroIndex}`);
  const nombre = nombreInput.value.trim();
  const monto = parseInt(montoInput.value) || 0;
  if (!nombre) {
    mostrarAviso('Ingresa un nombre para el tipo de cirugía', 'advertencia');
    return;
  }
  const centro = state.centros[centroIndex];
  if (centro.tiposCirugia.some((t) => t.nombre === nombre)) {
    mostrarAviso('Ya existe un tipo de cirugía con ese nombre en este centro', 'advertencia');
    return;
  }
  centro.tiposCirugia.push({ nombre, monto });
  guardarDatos();
  renderListaCentros();
  mostrarToast(`Tipo de cirugía "${nombre}" agregado`, 'exito');
}

export function editarTipoCirugia(centroIndex, tipoIndex) {
  const tipo = state.centros[centroIndex].tiposCirugia[tipoIndex];
  document.getElementById('editarTipoCirugiaCentroIndex').value = centroIndex;
  document.getElementById('editarTipoCirugiaIndex').value = tipoIndex;
  document.getElementById('editarTipoCirugiaNombreInput').value = tipo.nombre;
  document.getElementById('editarTipoCirugiaMontoInput').value = tipo.monto;
  document.getElementById('editarTipoCirugiaModal').style.display = 'flex';
}

export function cerrarEditarTipoCirugiaModal() {
  document.getElementById('editarTipoCirugiaModal').style.display = 'none';
}

export function confirmarEditarTipoCirugia() {
  const centroIndex = parseInt(document.getElementById('editarTipoCirugiaCentroIndex').value);
  const tipoIndex = parseInt(document.getElementById('editarTipoCirugiaIndex').value);
  const centro = state.centros[centroIndex];
  const tipo = centro.tiposCirugia[tipoIndex];

  const nuevoNombre = document.getElementById('editarTipoCirugiaNombreInput').value.trim();
  const nuevoMonto = parseInt(document.getElementById('editarTipoCirugiaMontoInput').value) || 0;
  const nombreAnterior = tipo.nombre;

  tipo.nombre = nuevoNombre || tipo.nombre;
  tipo.monto = nuevoMonto;

  // Las cirugias ya registradas con este tipo tambien deben reflejar el
  // cambio de nombre, igual que se hace con los tipos de turno.
  if (tipo.nombre !== nombreAnterior) {
    state.cirugias = state.cirugias.map((c) =>
      c.centro === centro.nombre && c.tipo === nombreAnterior ? { ...c, tipo: tipo.nombre } : c
    );
  }

  guardarDatos();
  renderListaCentros();
  cerrarEditarTipoCirugiaModal();
  mostrarToast('Tipo de cirugía actualizado.', 'exito');
}

export async function eliminarTipoCirugia(centroIndex, tipoIndex) {
  const centro = state.centros[centroIndex];
  const tipo = centro.tiposCirugia[tipoIndex];
  if (!(await pedirConfirmacion(`¿Eliminar el tipo de cirugía "${tipo.nombre}"?`))) return;
  const [eliminado] = centro.tiposCirugia.splice(tipoIndex, 1);
  guardarDatos();
  renderListaCentros();
  mostrarToastConDeshacer('Tipo de cirugía eliminado.', () => {
    centro.tiposCirugia.splice(tipoIndex, 0, eliminado);
    guardarDatos();
    renderListaCentros();
  });
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
    nuevos.forEach((nombre) => state.centros.push({ nombre, previsiones: [], tiposTurno: [], tiposCirugia: [] }));
    guardarDatos();
  }
}

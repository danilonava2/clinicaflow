import { state, guardarDatos, esPlanPro } from '../store.js';
import { formatearFecha, formatearMonto, escapeHtml } from '../utils/format.js';
import { descargarArchivo } from '../utils/download.js';
import { mostrarAviso, mostrarToast, mostrarToastConDeshacer, pedirConfirmacion } from '../ui/notificaciones.js';

const { jsPDF } = window.jspdf;
const XLSX = window.XLSX;

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const ITEMS_PER_PAGE = 10;

let mesActual = new Date().getMonth();
let anioActual = new Date().getFullYear();
let diaSeleccionado = null;
let currentInformeRows = [];
let currentInformeTotal = 0;
let descuentoTurnoPct1Guardado = '';
let descuentoTurnoPct2Guardado = '';

function pad2(n) {
  return n.toString().padStart(2, '0');
}

// ==================== ENTRADA A LA SECCION ====================
export function iniciarSeccionTurnos() {
  const gate = document.getElementById('turnosProGate');
  const contenido = document.getElementById('turnosContenido');
  if (!esPlanPro()) {
    gate.style.display = 'block';
    contenido.style.display = 'none';
    return;
  }
  gate.style.display = 'none';
  contenido.style.display = 'block';
  actualizarSelectFiltrosTurnos();
  renderCalendarioTurnos();
}

export function actualizarSelectFiltrosTurnos() {
  const centroSelect = document.getElementById('turnosFiltroCentro');
  if (centroSelect) {
    const current = centroSelect.value;
    centroSelect.innerHTML = '<option value="">Todos los centros</option>';
    state.centros.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.nombre;
      opt.textContent = c.nombre;
      centroSelect.appendChild(opt);
    });
    if (current && state.centros.some((c) => c.nombre === current)) centroSelect.value = current;
  }

  const tipoSelect = document.getElementById('turnosFiltroTipo');
  if (tipoSelect) {
    const nombres = new Set();
    state.centros.forEach((c) => c.tiposTurno.forEach((t) => nombres.add(t.nombre)));
    const current = tipoSelect.value;
    tipoSelect.innerHTML = '<option value="">Todos los tipos</option>';
    Array.from(nombres)
      .sort()
      .forEach((n) => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = n;
        tipoSelect.appendChild(opt);
      });
    if (current && nombres.has(current)) tipoSelect.value = current;
  }
}

// ==================== CALENDARIO ====================
export function cambiarMesTurnos(delta) {
  mesActual += delta;
  if (mesActual < 0) {
    mesActual = 11;
    anioActual--;
  }
  if (mesActual > 11) {
    mesActual = 0;
    anioActual++;
  }
  renderCalendarioTurnos();
}

function renderCalendarioTurnos() {
  const label = document.getElementById('turnosMesLabel');
  if (label) label.innerText = `${MESES[mesActual]} ${anioActual}`;

  const primerDiaMes = new Date(anioActual, mesActual, 1);
  const diasEnMes = new Date(anioActual, mesActual + 1, 0).getDate();
  let diaSemanaInicio = primerDiaMes.getDay(); // 0=domingo
  diaSemanaInicio = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1; // semana empieza en lunes

  const turnosPorDia = {};
  state.turnos.forEach((t) => {
    if (!turnosPorDia[t.fecha]) turnosPorDia[t.fecha] = [];
    turnosPorDia[t.fecha].push(t);
  });

  let html = DIAS_SEMANA.map((d) => `<div class="calendario-dia-nombre">${d}</div>`).join('');

  for (let i = 0; i < diaSemanaInicio; i++) {
    html += '<div class="calendario-celda calendario-celda-vacia"></div>';
  }

  const hoyStr = new Date().toISOString().slice(0, 10);

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fechaStr = `${anioActual}-${pad2(mesActual + 1)}-${pad2(dia)}`;
    const registros = turnosPorDia[fechaStr] || [];
    const esHoy = fechaStr === hoyStr;
    html += `<div class="calendario-celda${esHoy ? ' calendario-celda-hoy' : ''}" onclick="abrirDiaTurnoModal('${fechaStr}')">
      <div class="calendario-dia-numero">${dia}</div>
      <div class="calendario-dia-registros">`;
    registros.forEach((r) => {
      html += `<div class="calendario-registro-mini">${escapeHtml(r.centro)} · ${r.horas}h</div>`;
    });
    html += '</div></div>';
  }

  const grid = document.getElementById('calendarioGrid');
  if (grid) grid.innerHTML = html;
}

// ==================== MODAL DEL DIA ====================
export function abrirDiaTurnoModal(fecha) {
  diaSeleccionado = fecha;
  const [y, m, d] = fecha.split('-');
  document.getElementById('diaTurnoFechaLabel').innerText = `${d}/${m}/${y}`;
  renderListaTurnosDelDia();
  actualizarSelectCentroTurno();
  document.getElementById('turnoHorasInput').value = '';
  document.getElementById('turnoValorHoraInput').value = '';
  document.getElementById('turnoTotalInput').value = '';
  document.getElementById('diaTurnoModal').style.display = 'flex';
}

export function cerrarDiaTurnoModal() {
  document.getElementById('diaTurnoModal').style.display = 'none';
  diaSeleccionado = null;
}

function renderListaTurnosDelDia() {
  const contenedor = document.getElementById('diaTurnoLista');
  const registros = state.turnos.filter((t) => t.fecha === diaSeleccionado);
  if (registros.length === 0) {
    contenedor.innerHTML = '<p style="color:#94a3b8; font-size:13px; margin-bottom:10px;">Sin registros este día.</p>';
    return;
  }
  let html = '<div class="previsiones-list" style="margin-bottom:14px;">';
  registros.forEach((t) => {
    html += `<div class="prevision-item">
      <span>🏥 ${escapeHtml(t.centro)} — ${escapeHtml(t.tipo)} — ${t.horas}h — ${formatearMonto(t.total)}</span>
      <div>
        <button onclick="editarTurno('${t.id}')" class="btn-edit" style="margin-right:5px;">✏️</button>
        <button onclick="eliminarTurno('${t.id}')" class="btn-delete">🗑️</button>
      </div>
    </div>`;
  });
  html += '</div>';
  contenedor.innerHTML = html;
}

export function actualizarSelectCentroTurno() {
  const select = document.getElementById('turnoCentroSelect');
  select.innerHTML = '<option value="">-- Seleccionar centro --</option>';
  state.centros.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.nombre;
    opt.textContent = c.nombre;
    select.appendChild(opt);
  });
  actualizarTiposTurnoDisponibles();
}

export function actualizarTiposTurnoDisponibles() {
  const centroNombre = document.getElementById('turnoCentroSelect').value;
  const tipoSelect = document.getElementById('turnoTipoSelect');
  const centro = state.centros.find((c) => c.nombre === centroNombre);
  const tipos = centro?.tiposTurno || [];

  if (!centroNombre) {
    tipoSelect.innerHTML = '<option value="">-- Selecciona un centro primero --</option>';
    tipoSelect.disabled = true;
    return;
  }
  if (tipos.length === 0) {
    tipoSelect.innerHTML = '<option value="">-- Sin tipos de turno, agrega en "Centros" --</option>';
    tipoSelect.disabled = true;
    return;
  }
  tipoSelect.disabled = false;
  tipoSelect.innerHTML = '<option value="">-- Seleccionar tipo --</option>';
  tipos.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.nombre;
    opt.textContent = t.nombre;
    tipoSelect.appendChild(opt);
  });
}

export function autocompletarValorHora() {
  const centroNombre = document.getElementById('turnoCentroSelect').value;
  const tipoNombre = document.getElementById('turnoTipoSelect').value;
  const centro = state.centros.find((c) => c.nombre === centroNombre);
  const tipo = centro?.tiposTurno.find((t) => t.nombre === tipoNombre);
  if (tipo) {
    document.getElementById('turnoValorHoraInput').value = tipo.valorHora;
    calcularTotalTurno();
  }
}

export function calcularTotalTurno() {
  const valorHora = parseFloat(document.getElementById('turnoValorHoraInput').value) || 0;
  const horas = parseFloat(document.getElementById('turnoHorasInput').value) || 0;
  document.getElementById('turnoTotalInput').value = Math.round(valorHora * horas);
}

export function agregarTurno() {
  const centro = document.getElementById('turnoCentroSelect').value;
  const tipo = document.getElementById('turnoTipoSelect').value;
  const valorHora = parseFloat(document.getElementById('turnoValorHoraInput').value) || 0;
  const horas = parseFloat(document.getElementById('turnoHorasInput').value) || 0;
  const total = parseFloat(document.getElementById('turnoTotalInput').value) || Math.round(valorHora * horas);

  if (!centro) {
    mostrarAviso('Selecciona un centro', 'advertencia');
    return;
  }
  if (!tipo) {
    mostrarAviso('Selecciona un tipo de turno', 'advertencia');
    return;
  }
  if (!horas) {
    mostrarAviso('Ingresa las horas', 'advertencia');
    return;
  }

  const nuevo = {
    id: Date.now().toString(),
    fecha: diaSeleccionado,
    centro,
    tipo,
    valorHora,
    horas,
    total,
    timestamp: Date.now()
  };
  state.turnos.unshift(nuevo);
  guardarDatos();
  renderListaTurnosDelDia();
  renderCalendarioTurnos();

  document.getElementById('turnoTipoSelect').value = '';
  document.getElementById('turnoValorHoraInput').value = '';
  document.getElementById('turnoHorasInput').value = '';
  document.getElementById('turnoTotalInput').value = '';
  mostrarToast('Turno registrado.', 'exito');
}

// ==================== EDITAR / ELIMINAR TURNO ====================
export function editarTurno(id) {
  const t = state.turnos.find((x) => x.id === id);
  if (!t) return;
  document.getElementById('editarTurnoId').value = id;

  const centroSelect = document.getElementById('editarTurnoCentroSelect');
  centroSelect.innerHTML = state.centros
    .map((c) => `<option value="${escapeHtml(c.nombre)}">${escapeHtml(c.nombre)}</option>`)
    .join('');
  centroSelect.value = t.centro;
  if (centroSelect.value !== t.centro) {
    // El centro de este turno ya no existe (fue eliminado, no solo
    // renombrado): se agrega igual como opcion para no perder el dato.
    centroSelect.insertAdjacentHTML('afterbegin', `<option value="${escapeHtml(t.centro)}">${escapeHtml(t.centro)} (eliminado)</option>`);
    centroSelect.value = t.centro;
  }

  actualizarTiposTurnoEdicion();
  const tipoSelect = document.getElementById('editarTurnoTipoSelect');
  tipoSelect.value = t.tipo;
  if (tipoSelect.value !== t.tipo) {
    tipoSelect.insertAdjacentHTML('afterbegin', `<option value="${escapeHtml(t.tipo)}">${escapeHtml(t.tipo)} (eliminado)</option>`);
    tipoSelect.value = t.tipo;
  }
  document.getElementById('editarTurnoValorHoraInput').value = t.valorHora;
  document.getElementById('editarTurnoHorasInput').value = t.horas;
  document.getElementById('editarTurnoTotalInput').value = t.total;
  document.getElementById('editarTurnoModal').style.display = 'flex';
}

export function actualizarTiposTurnoEdicion() {
  const centroNombre = document.getElementById('editarTurnoCentroSelect').value;
  const tipoSelect = document.getElementById('editarTurnoTipoSelect');
  const centro = state.centros.find((c) => c.nombre === centroNombre);
  const tipos = centro?.tiposTurno || [];
  tipoSelect.innerHTML = tipos.map((t) => `<option value="${escapeHtml(t.nombre)}">${escapeHtml(t.nombre)}</option>`).join('');
}

export function autocompletarValorHoraEdicion() {
  const centroNombre = document.getElementById('editarTurnoCentroSelect').value;
  const tipoNombre = document.getElementById('editarTurnoTipoSelect').value;
  const centro = state.centros.find((c) => c.nombre === centroNombre);
  const tipo = centro?.tiposTurno.find((t) => t.nombre === tipoNombre);
  if (tipo) {
    document.getElementById('editarTurnoValorHoraInput').value = tipo.valorHora;
    calcularTotalTurnoEdicion();
  }
}

export function calcularTotalTurnoEdicion() {
  const valorHora = parseFloat(document.getElementById('editarTurnoValorHoraInput').value) || 0;
  const horas = parseFloat(document.getElementById('editarTurnoHorasInput').value) || 0;
  document.getElementById('editarTurnoTotalInput').value = Math.round(valorHora * horas);
}

export function cerrarEditarTurnoModal() {
  document.getElementById('editarTurnoModal').style.display = 'none';
}

export function confirmarEditarTurno() {
  const id = document.getElementById('editarTurnoId').value;
  const t = state.turnos.find((x) => x.id === id);
  if (!t) return;
  t.centro = document.getElementById('editarTurnoCentroSelect').value;
  t.tipo = document.getElementById('editarTurnoTipoSelect').value;
  t.valorHora = parseFloat(document.getElementById('editarTurnoValorHoraInput').value) || 0;
  t.horas = parseFloat(document.getElementById('editarTurnoHorasInput').value) || 0;
  t.total = parseFloat(document.getElementById('editarTurnoTotalInput').value) || 0;
  guardarDatos();
  renderListaTurnosDelDia();
  renderCalendarioTurnos();
  cerrarEditarTurnoModal();
  mostrarToast('Turno actualizado.', 'exito');
}

export async function eliminarTurno(id) {
  const idx = state.turnos.findIndex((x) => x.id === id);
  if (idx === -1) return;
  if (!(await pedirConfirmacion('¿Eliminar este turno?'))) return;
  const [eliminado] = state.turnos.splice(idx, 1);
  guardarDatos();
  renderListaTurnosDelDia();
  renderCalendarioTurnos();
  mostrarToastConDeshacer('Turno eliminado.', () => {
    state.turnos.splice(idx, 0, eliminado);
    guardarDatos();
    renderListaTurnosDelDia();
    renderCalendarioTurnos();
  });
}

// ==================== INFORME ====================
function obtenerFiltrosInforme() {
  const inicio = document.getElementById('turnosFechaInicio').value;
  const fin = document.getElementById('turnosFechaFin').value;
  const centro = document.getElementById('turnosFiltroCentro').value;
  const tipo = document.getElementById('turnosFiltroTipo').value;
  const start = inicio ? new Date(inicio) : null;
  const end = fin ? new Date(fin) : null;
  if (end) end.setHours(23, 59, 59);
  return { centro, tipo, start, end };
}

function filtrarTurnos({ centro, tipo, start, end }) {
  return state.turnos.filter((t) => {
    const fecha = new Date(t.fecha);
    const pasaFecha = !start || !end || (fecha >= start && fecha <= end);
    const pasaCentro = !centro || t.centro === centro;
    const pasaTipo = !tipo || t.tipo === tipo;
    return pasaFecha && pasaCentro && pasaTipo;
  });
}

export function generarInformeTurnos(page = 1) {
  const filtros = obtenerFiltrosInforme();
  const rows = filtrarTurnos(filtros);
  currentInformeRows = rows;

  const container = document.getElementById('informeTurnosContainer');
  const paginacion = document.getElementById('informeTurnosPaginacion');
  if (!container) return;
  if (rows.length === 0) {
    container.innerHTML = '<div class="reporte-vacio">📭 No se encontraron turnos con estos filtros.</div>';
    if (paginacion) paginacion.innerHTML = '';
    return;
  }

  const totalHoras = rows.reduce((s, t) => s + (Number(t.horas) || 0), 0);
  const totalMonto = rows.reduce((s, t) => s + (Number(t.total) || 0), 0);
  currentInformeTotal = totalMonto;
  const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE);
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const paginated = rows.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  let html = `<div class="reporte-resultado">
    <div class="reporte-encabezado">
      <h3>🕐 Informe de Turnos</h3>
      <span class="reporte-badge">${rows.length} turno${rows.length === 1 ? '' : 's'}</span>
    </div>
    <div style="overflow-x:auto;">
      <table class="tabla-resultados">
        <thead>
          <tr><th>Fecha</th><th>Centro</th><th>Tipo</th><th>Valor/hora</th><th>Horas</th><th>Total</th></tr>
        </thead>
        <tbody>`;

  paginated.forEach((t) => {
    html += `<tr>
      <td>${formatearFecha(t.fecha)}</td>
      <td>${escapeHtml(t.centro)}</td>
      <td>${escapeHtml(t.tipo)}</td>
      <td>${formatearMonto(t.valorHora)}</td>
      <td>${t.horas}</td>
      <td>${formatearMonto(t.total)}</td>
    </tr>`;
  });

  html += `</tbody>
      </table>
    </div>
    <div class="reporte-total">
      <div class="reporte-total-linea">
        <span>🕐 Total horas: ${totalHoras} — 💰 Total</span>
        <span class="monto">${formatearMonto(totalMonto)}</span>
      </div>
      <div class="reporte-descuento-inputs">
        <div>
          <label>Descuento 1 (%)</label>
          <input type="number" id="turnoDescuentoPct1" min="0" max="100" step="0.01" placeholder="0" value="${descuentoTurnoPct1Guardado}" oninput="actualizarDescuentoInformeTurnos()">
        </div>
        <div>
          <label>Descuento 2 (%)</label>
          <input type="number" id="turnoDescuentoPct2" min="0" max="100" step="0.01" placeholder="0" value="${descuentoTurnoPct2Guardado}" oninput="actualizarDescuentoInformeTurnos()">
        </div>
      </div>
      <div id="turnoDescuentoResultado"></div>
    </div>
    <div style="display:flex; gap:10px; flex-wrap:wrap;">
      <button onclick="descargarInformeTurnosPDF()" class="btn-primary">📄 Descargar PDF</button>
      <button onclick="descargarInformeTurnosExcel()" class="btn-secondary">📥 Excel</button>
    </div>
  </div>`;

  container.innerHTML = html;
  actualizarDescuentoInformeTurnos();

  if (paginacion) {
    let pagHtml = '';
    if (page > 1) pagHtml += `<button onclick="generarInformeTurnos(${page - 1})" class="btn-secondary">⬅ Anterior</button>`;
    pagHtml += `<span>Página ${page} de ${totalPages}</span>`;
    if (page < totalPages) pagHtml += `<button onclick="generarInformeTurnos(${page + 1})" class="btn-secondary">Siguiente ➡</button>`;
    paginacion.innerHTML = pagHtml;
  }
}

export function descargarInformeTurnosPDF() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 20;

  try {
    const logoImg = document.querySelector('.sidebar .logo img')?.src;
    if (logoImg) {
      doc.addImage(logoImg, 'PNG', 14, 10, 40, 15);
    } else {
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text('ClinicaFlow', 14, 20);
    }
  } catch (e) {
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text('ClinicaFlow', 14, 20);
  }

  y = 35;
  doc.setFontSize(16);
  doc.setTextColor(59, 130, 246);
  doc.text('Informe de Turnos y Horas Extra', 14, y);
  y += 6;

  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.3);
  doc.line(14, y, 196, y);
  y += 10;

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL')}`, 14, y);
  if (state.currentUser?.email) {
    doc.text(`Usuario: ${state.currentUser.email}`, 14, y + 5);
    y += 14;
  } else {
    y += 10;
  }

  const COL = { fecha: 16, centro: 45, tipo: 95, valorHora: 135, horas: 165, total: 178 };

  const dibujarCabecera = () => {
    doc.setFillColor(59, 130, 246);
    doc.rect(14, y, 182, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('Fecha', COL.fecha, y + 5);
    doc.text('Centro', COL.centro, y + 5);
    doc.text('Tipo', COL.tipo, y + 5);
    doc.text('Valor/h', COL.valorHora, y + 5);
    doc.text('Horas', COL.horas, y + 5);
    doc.text('Total', COL.total, y + 5);
    y += 10;
    doc.setTextColor(0, 0, 0);
  };

  dibujarCabecera();

  let totalHoras = 0;
  let totalMonto = 0;
  for (const t of currentInformeRows) {
    totalHoras += Number(t.horas) || 0;
    totalMonto += Number(t.total) || 0;

    if (y > 270) {
      doc.addPage();
      y = 20;
      dibujarCabecera();
    }

    doc.setFontSize(8);
    doc.text(t.fecha || '', COL.fecha, y);
    doc.text((t.centro || '').substring(0, 20), COL.centro, y);
    doc.text((t.tipo || '').substring(0, 16), COL.tipo, y);
    doc.text(`$${Number(t.valorHora).toLocaleString('es-CL')}`, COL.valorHora, y);
    doc.text(`${t.horas}`, COL.horas, y);
    doc.text(`$${Number(t.total).toLocaleString('es-CL')}`, COL.total, y);
    y += 6;
  }

  y += 6;
  doc.setLineWidth(0.3);
  doc.line(14, y, 196, y);
  y += 7;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text(`TOTAL HORAS: ${totalHoras}   |   TOTAL: $${totalMonto.toLocaleString('es-CL')}`, 14, y);

  const pct1 = parseFloat(document.getElementById('turnoDescuentoPct1')?.value) || 0;
  const pct2 = parseFloat(document.getElementById('turnoDescuentoPct2')?.value) || 0;

  if (pct1 > 0 || pct2 > 0) {
    const { monto1, subtotal1, monto2, totalFinal } = calcularMontosDescuento(totalMonto, pct1, pct2);

    y += 14;
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Detalle de Descuentos', 14, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);

    const lineaDescuento = (label, valor) => {
      doc.text(label, 14, y);
      doc.text(valor, 150, y);
      y += 6;
    };

    lineaDescuento('Total Turnos', `$${totalMonto.toLocaleString('es-CL')}`);
    lineaDescuento(`Descuento 1 (${pct1}%)`, `-$${monto1.toLocaleString('es-CL')}`);
    lineaDescuento('Subtotal', `$${subtotal1.toLocaleString('es-CL')}`);
    lineaDescuento(`Descuento 2 (${pct2}%)`, `-$${monto2.toLocaleString('es-CL')}`);

    y += 2;
    doc.setLineWidth(0.3);
    doc.line(14, y, 196, y);
    y += 7;

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text('TOTAL FINAL (neto):', 14, y);
    doc.text(`$${totalFinal.toLocaleString('es-CL')}`, 150, y);
  }

  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('ClinicaFlow - Control de Ingresos para Profesionales de la Salud', 14, 285);

  const pdfData = doc.output('arraybuffer');
  const filename = `Turnos_ClinicaFlow_${new Date().toISOString().slice(0, 10)}.pdf`;
  descargarArchivo(pdfData, filename, 'application/pdf');
}

export function descargarInformeTurnosExcel() {
  const filtros = obtenerFiltrosInforme();
  const filtered = filtrarTurnos(filtros);

  if (filtered.length === 0) {
    mostrarAviso('No hay turnos que coincidan con los filtros.', 'advertencia');
    return;
  }

  const data = [['Fecha', 'Centro', 'Tipo', 'Valor por hora', 'Horas', 'Total']];
  filtered.forEach((t) => {
    data.push([t.fecha, t.centro, t.tipo, Number(t.valorHora) || 0, Number(t.horas) || 0, Number(t.total) || 0]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Turnos');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const filename = `Turnos_${new Date().toISOString().slice(0, 10)}.xlsx`;
  descargarArchivo(excelBuffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

// ==================== DESCUENTOS (inline en la franja del total) ====================
function calcularMontosDescuento(total, pct1, pct2) {
  const monto1 = total * (pct1 / 100);
  const subtotal1 = total - monto1;
  const monto2 = subtotal1 * (pct2 / 100);
  const totalFinal = subtotal1 - monto2;
  return { monto1, subtotal1, monto2, totalFinal };
}

export function actualizarDescuentoInformeTurnos() {
  const pct1Input = document.getElementById('turnoDescuentoPct1');
  const pct2Input = document.getElementById('turnoDescuentoPct2');
  const resultado = document.getElementById('turnoDescuentoResultado');
  if (!pct1Input || !pct2Input || !resultado) return;

  descuentoTurnoPct1Guardado = pct1Input.value;
  descuentoTurnoPct2Guardado = pct2Input.value;

  const pct1 = parseFloat(pct1Input.value) || 0;
  const pct2 = parseFloat(pct2Input.value) || 0;

  if (pct1 <= 0 && pct2 <= 0) {
    resultado.innerHTML = '';
    return;
  }

  const { monto1, subtotal1, monto2, totalFinal } = calcularMontosDescuento(currentInformeTotal, pct1, pct2);
  resultado.innerHTML = `
    <div class="descuento-linea">
      <span>Descuento 1 (${pct1}%)</span>
      <span>-${formatearMonto(monto1)}</span>
    </div>
    <div class="descuento-linea descuento-subtotal">
      <span>Subtotal</span>
      <span>${formatearMonto(subtotal1)}</span>
    </div>
    <div class="descuento-linea">
      <span>Descuento 2 (${pct2}%)</span>
      <span>-${formatearMonto(monto2)}</span>
    </div>
    <div class="descuento-final">
      <span>Total Final (neto)</span>
      <span>${formatearMonto(totalFinal)}</span>
    </div>
  `;
}

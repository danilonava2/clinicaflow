import { state, guardarDatos, esPlanPro } from '../store.js';
import { formatearFecha, formatearMonto, escapeHtml } from '../utils/format.js';
import { formatearRutParaMostrar, validarRUT } from '../utils/rut.js';
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
let descuentoCirugiaPct1Guardado = '';
let descuentoCirugiaPct2Guardado = '';

function pad2(n) {
  return n.toString().padStart(2, '0');
}

// ==================== ENTRADA A LA SECCION ====================
export function iniciarSeccionCirugias() {
  const gate = document.getElementById('cirugiasProGate');
  const contenido = document.getElementById('cirugiasContenido');
  if (!esPlanPro()) {
    gate.style.display = 'block';
    contenido.style.display = 'none';
    return;
  }
  gate.style.display = 'none';
  contenido.style.display = 'block';
  actualizarSelectFiltrosCirugias();
  renderCalendarioCirugias();
}

export function actualizarSelectFiltrosCirugias() {
  const centroSelect = document.getElementById('cirugiasFiltroCentro');
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

  const tipoSelect = document.getElementById('cirugiasFiltroTipo');
  if (tipoSelect) {
    const nombres = new Set();
    state.centros.forEach((c) => c.tiposCirugia.forEach((t) => nombres.add(t.nombre)));
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
export function cambiarMesCirugias(delta) {
  mesActual += delta;
  if (mesActual < 0) {
    mesActual = 11;
    anioActual--;
  }
  if (mesActual > 11) {
    mesActual = 0;
    anioActual++;
  }
  renderCalendarioCirugias();
}

function renderCalendarioCirugias() {
  const label = document.getElementById('cirugiasMesLabel');
  if (label) label.innerText = `${MESES[mesActual]} ${anioActual}`;

  const primerDiaMes = new Date(anioActual, mesActual, 1);
  const diasEnMes = new Date(anioActual, mesActual + 1, 0).getDate();
  let diaSemanaInicio = primerDiaMes.getDay(); // 0=domingo
  diaSemanaInicio = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1; // semana empieza en lunes

  const cirugiasPorDia = {};
  state.cirugias.forEach((c) => {
    if (!cirugiasPorDia[c.fecha]) cirugiasPorDia[c.fecha] = [];
    cirugiasPorDia[c.fecha].push(c);
  });

  let html = DIAS_SEMANA.map((d) => `<div class="calendario-dia-nombre">${d}</div>`).join('');

  for (let i = 0; i < diaSemanaInicio; i++) {
    html += '<div class="calendario-celda calendario-celda-vacia"></div>';
  }

  const hoyStr = new Date().toISOString().slice(0, 10);

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fechaStr = `${anioActual}-${pad2(mesActual + 1)}-${pad2(dia)}`;
    const registros = cirugiasPorDia[fechaStr] || [];
    const esHoy = fechaStr === hoyStr;
    html += `<div class="calendario-celda${esHoy ? ' calendario-celda-hoy' : ''}" onclick="abrirDiaCirugiaModal('${fechaStr}')">
      <div class="calendario-dia-numero">${dia}</div>
      <div class="calendario-dia-registros">`;
    registros.forEach((r) => {
      html += `<div class="calendario-registro-mini">${escapeHtml(r.centro)} · ${escapeHtml(r.tipo)}</div>`;
    });
    html += '</div></div>';
  }

  const grid = document.getElementById('calendarioCirugiasGrid');
  if (grid) grid.innerHTML = html;
}

// ==================== MODAL DEL DIA ====================
export function abrirDiaCirugiaModal(fecha) {
  diaSeleccionado = fecha;
  const [y, m, d] = fecha.split('-');
  document.getElementById('diaCirugiaFechaLabel').innerText = `${d}/${m}/${y}`;
  renderListaCirugiasDelDia();
  actualizarSelectCentroCirugia();
  document.getElementById('cirugiaPacienteInput').value = '';
  document.getElementById('cirugiaRutInput').value = '';
  document.getElementById('cirugiaRutStatus').innerHTML = '';
  document.getElementById('cirugiaMontoInput').value = '';
  document.getElementById('diaCirugiaModal').style.display = 'flex';
}

export function cerrarDiaCirugiaModal() {
  document.getElementById('diaCirugiaModal').style.display = 'none';
  diaSeleccionado = null;
}

function renderListaCirugiasDelDia() {
  const contenedor = document.getElementById('diaCirugiaLista');
  const registros = state.cirugias.filter((c) => c.fecha === diaSeleccionado);
  if (registros.length === 0) {
    contenedor.innerHTML = '<p style="color:#94a3b8; font-size:13px; margin-bottom:10px;">Sin registros este día.</p>';
    return;
  }
  let html = '<div class="previsiones-list" style="margin-bottom:14px;">';
  registros.forEach((c) => {
    html += `<div class="prevision-item">
      <span>🔪 ${escapeHtml(c.centro)} — ${escapeHtml(c.tipo)} — ${escapeHtml(c.paciente)} — ${formatearMonto(c.monto)}</span>
      <div>
        <button onclick="editarCirugia('${c.id}')" class="btn-edit" style="margin-right:5px;">✏️</button>
        <button onclick="eliminarCirugia('${c.id}')" class="btn-delete">🗑️</button>
      </div>
    </div>`;
  });
  html += '</div>';
  contenedor.innerHTML = html;
}

export function actualizarSelectCentroCirugia() {
  const select = document.getElementById('cirugiaCentroSelect');
  select.innerHTML = '<option value="">-- Seleccionar centro --</option>';
  state.centros.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.nombre;
    opt.textContent = c.nombre;
    select.appendChild(opt);
  });
  actualizarTiposCirugiaDisponibles();
}

export function actualizarTiposCirugiaDisponibles() {
  const centroNombre = document.getElementById('cirugiaCentroSelect').value;
  const tipoSelect = document.getElementById('cirugiaTipoSelect');
  const centro = state.centros.find((c) => c.nombre === centroNombre);
  const tipos = centro?.tiposCirugia || [];

  if (!centroNombre) {
    tipoSelect.innerHTML = '<option value="">-- Selecciona un centro primero --</option>';
    tipoSelect.disabled = true;
    return;
  }
  if (tipos.length === 0) {
    tipoSelect.innerHTML = '<option value="">-- Sin tipos de cirugía, agrega en "Centros" --</option>';
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

export function autocompletarMontoCirugia() {
  const centroNombre = document.getElementById('cirugiaCentroSelect').value;
  const tipoNombre = document.getElementById('cirugiaTipoSelect').value;
  const centro = state.centros.find((c) => c.nombre === centroNombre);
  const tipo = centro?.tiposCirugia.find((t) => t.nombre === tipoNombre);
  if (tipo) {
    document.getElementById('cirugiaMontoInput').value = tipo.monto;
  }
}

export function agregarCirugia() {
  const centro = document.getElementById('cirugiaCentroSelect').value;
  const tipo = document.getElementById('cirugiaTipoSelect').value;
  const paciente = document.getElementById('cirugiaPacienteInput').value.trim();
  const rut = document.getElementById('cirugiaRutInput').value.trim();
  const monto = parseFloat(document.getElementById('cirugiaMontoInput').value) || 0;

  if (!centro) {
    mostrarAviso('Selecciona un centro', 'advertencia');
    return;
  }
  if (!tipo) {
    mostrarAviso('Selecciona un tipo de cirugía', 'advertencia');
    return;
  }
  if (!paciente) {
    mostrarAviso('Ingresa el nombre del paciente', 'advertencia');
    return;
  }
  if (!validarRUT(rut)) {
    mostrarAviso('RUT inválido.', 'error');
    return;
  }
  if (!monto) {
    mostrarAviso('Ingresa el monto', 'advertencia');
    return;
  }

  const nuevo = {
    id: Date.now().toString(),
    fecha: diaSeleccionado,
    centro,
    tipo,
    paciente,
    rut,
    monto,
    timestamp: Date.now()
  };
  state.cirugias.unshift(nuevo);
  guardarDatos();
  renderListaCirugiasDelDia();
  renderCalendarioCirugias();

  document.getElementById('cirugiaTipoSelect').value = '';
  document.getElementById('cirugiaPacienteInput').value = '';
  document.getElementById('cirugiaRutInput').value = '';
  document.getElementById('cirugiaRutStatus').innerHTML = '';
  document.getElementById('cirugiaMontoInput').value = '';
  mostrarToast('Cirugía registrada.', 'exito');
}

// ==================== EDITAR / ELIMINAR CIRUGIA ====================
export function editarCirugia(id) {
  const c = state.cirugias.find((x) => x.id === id);
  if (!c) return;
  document.getElementById('editarCirugiaId').value = id;

  const centroSelect = document.getElementById('editarCirugiaCentroSelect');
  centroSelect.innerHTML = state.centros
    .map((ct) => `<option value="${escapeHtml(ct.nombre)}">${escapeHtml(ct.nombre)}</option>`)
    .join('');
  centroSelect.value = c.centro;
  if (centroSelect.value !== c.centro) {
    // El centro de esta cirugia ya no existe (fue eliminado, no solo
    // renombrado): se agrega igual como opcion para no perder el dato.
    centroSelect.insertAdjacentHTML('afterbegin', `<option value="${escapeHtml(c.centro)}">${escapeHtml(c.centro)} (eliminado)</option>`);
    centroSelect.value = c.centro;
  }

  actualizarTiposCirugiaEdicion();
  const tipoSelect = document.getElementById('editarCirugiaTipoSelect');
  tipoSelect.value = c.tipo;
  if (tipoSelect.value !== c.tipo) {
    tipoSelect.insertAdjacentHTML('afterbegin', `<option value="${escapeHtml(c.tipo)}">${escapeHtml(c.tipo)} (eliminado)</option>`);
    tipoSelect.value = c.tipo;
  }
  document.getElementById('editarCirugiaPacienteInput').value = c.paciente;
  document.getElementById('editarCirugiaRutInput').value = c.rut;
  document.getElementById('editarCirugiaMontoInput').value = c.monto;
  document.getElementById('editarCirugiaModal').style.display = 'flex';
}

export function actualizarTiposCirugiaEdicion() {
  const centroNombre = document.getElementById('editarCirugiaCentroSelect').value;
  const tipoSelect = document.getElementById('editarCirugiaTipoSelect');
  const centro = state.centros.find((c) => c.nombre === centroNombre);
  const tipos = centro?.tiposCirugia || [];
  tipoSelect.innerHTML = tipos.map((t) => `<option value="${escapeHtml(t.nombre)}">${escapeHtml(t.nombre)}</option>`).join('');
}

export function autocompletarMontoCirugiaEdicion() {
  const centroNombre = document.getElementById('editarCirugiaCentroSelect').value;
  const tipoNombre = document.getElementById('editarCirugiaTipoSelect').value;
  const centro = state.centros.find((c) => c.nombre === centroNombre);
  const tipo = centro?.tiposCirugia.find((t) => t.nombre === tipoNombre);
  if (tipo) {
    document.getElementById('editarCirugiaMontoInput').value = tipo.monto;
  }
}

export function cerrarEditarCirugiaModal() {
  document.getElementById('editarCirugiaModal').style.display = 'none';
}

export function confirmarEditarCirugia() {
  const id = document.getElementById('editarCirugiaId').value;
  const c = state.cirugias.find((x) => x.id === id);
  if (!c) return;

  const rut = document.getElementById('editarCirugiaRutInput').value.trim();
  if (!validarRUT(rut)) {
    mostrarAviso('RUT inválido.', 'error');
    return;
  }

  c.centro = document.getElementById('editarCirugiaCentroSelect').value;
  c.tipo = document.getElementById('editarCirugiaTipoSelect').value;
  c.paciente = document.getElementById('editarCirugiaPacienteInput').value.trim();
  c.rut = rut;
  c.monto = parseFloat(document.getElementById('editarCirugiaMontoInput').value) || 0;
  guardarDatos();
  renderListaCirugiasDelDia();
  renderCalendarioCirugias();
  cerrarEditarCirugiaModal();
  mostrarToast('Cirugía actualizada.', 'exito');
}

export async function eliminarCirugia(id) {
  const idx = state.cirugias.findIndex((x) => x.id === id);
  if (idx === -1) return;
  if (!(await pedirConfirmacion('¿Eliminar esta cirugía?'))) return;
  const [eliminado] = state.cirugias.splice(idx, 1);
  guardarDatos();
  renderListaCirugiasDelDia();
  renderCalendarioCirugias();
  mostrarToastConDeshacer('Cirugía eliminada.', () => {
    state.cirugias.splice(idx, 0, eliminado);
    guardarDatos();
    renderListaCirugiasDelDia();
    renderCalendarioCirugias();
  });
}

// ==================== INFORME ====================
function obtenerFiltrosInforme() {
  const inicio = document.getElementById('cirugiasFechaInicio').value;
  const fin = document.getElementById('cirugiasFechaFin').value;
  const nombre = document.getElementById('cirugiasReporteNombre').value.trim().toLowerCase();
  const rut = document.getElementById('cirugiasReporteRut').value.trim().toLowerCase();
  const centro = document.getElementById('cirugiasFiltroCentro').value;
  const tipo = document.getElementById('cirugiasFiltroTipo').value;
  const start = inicio ? new Date(inicio) : null;
  const end = fin ? new Date(fin) : null;
  if (end) end.setHours(23, 59, 59);
  return { nombre, rut, centro, tipo, start, end };
}

function filtrarCirugias({ nombre, rut, centro, tipo, start, end }) {
  return state.cirugias.filter((c) => {
    const fecha = new Date(c.fecha);
    const pasaFecha = !start || !end || (fecha >= start && fecha <= end);
    const pasaNombre = !nombre || (c.paciente || '').toLowerCase().includes(nombre);
    const pasaRut = !rut || (c.rut || '').toLowerCase().includes(rut);
    const pasaCentro = !centro || c.centro === centro;
    const pasaTipo = !tipo || c.tipo === tipo;
    return pasaFecha && pasaNombre && pasaRut && pasaCentro && pasaTipo;
  });
}

export function generarInformeCirugias(page = 1) {
  const filtros = obtenerFiltrosInforme();
  const rows = filtrarCirugias(filtros);
  currentInformeRows = rows;

  const container = document.getElementById('informeCirugiasContainer');
  const paginacion = document.getElementById('informeCirugiasPaginacion');
  if (!container) return;
  if (rows.length === 0) {
    container.innerHTML = '<div class="reporte-vacio">📭 No se encontraron cirugías con estos filtros.</div>';
    if (paginacion) paginacion.innerHTML = '';
    return;
  }

  const totalMonto = rows.reduce((s, c) => s + (Number(c.monto) || 0), 0);
  currentInformeTotal = totalMonto;
  const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE);
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const paginated = rows.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  let html = `<div class="reporte-resultado">
    <div class="reporte-encabezado">
      <h3>🔪 Informe de Cirugías</h3>
      <span class="reporte-badge">${rows.length} cirugía${rows.length === 1 ? '' : 's'}</span>
    </div>
    <div style="overflow-x:auto;">
      <table class="tabla-resultados">
        <thead>
          <tr><th>Fecha</th><th>Paciente</th><th>RUT</th><th>Centro</th><th>Tipo</th><th>Monto</th></tr>
        </thead>
        <tbody>`;

  paginated.forEach((c) => {
    html += `<tr>
      <td>${formatearFecha(c.fecha)}</td>
      <td>${escapeHtml(c.paciente)}</td>
      <td>${formatearRutParaMostrar(c.rut)}</td>
      <td>${escapeHtml(c.centro)}</td>
      <td>${escapeHtml(c.tipo)}</td>
      <td>${formatearMonto(c.monto)}</td>
    </tr>`;
  });

  html += `</tbody>
      </table>
    </div>
    <div class="reporte-total">
      <div class="reporte-total-linea">
        <span>💰 Total Ingresos</span>
        <span class="monto">${formatearMonto(totalMonto)}</span>
      </div>
      <div class="reporte-descuento-inputs">
        <div>
          <label>Descuento 1 (%)</label>
          <input type="number" id="cirugiaDescuentoPct1" min="0" max="100" step="0.01" placeholder="0" value="${descuentoCirugiaPct1Guardado}" oninput="actualizarDescuentoInformeCirugias()">
        </div>
        <div>
          <label>Descuento 2 (%)</label>
          <input type="number" id="cirugiaDescuentoPct2" min="0" max="100" step="0.01" placeholder="0" value="${descuentoCirugiaPct2Guardado}" oninput="actualizarDescuentoInformeCirugias()">
        </div>
      </div>
      <div id="cirugiaDescuentoResultado"></div>
    </div>
    <div style="display:flex; gap:10px; flex-wrap:wrap;">
      <button onclick="descargarInformeCirugiasPDF()" class="btn-primary">📄 Descargar PDF</button>
      <button onclick="descargarInformeCirugiasExcel()" class="btn-secondary">📥 Excel</button>
    </div>
  </div>`;

  container.innerHTML = html;
  actualizarDescuentoInformeCirugias();

  if (paginacion) {
    let pagHtml = '';
    if (page > 1) pagHtml += `<button onclick="generarInformeCirugias(${page - 1})" class="btn-secondary">⬅ Anterior</button>`;
    pagHtml += `<span>Página ${page} de ${totalPages}</span>`;
    if (page < totalPages) pagHtml += `<button onclick="generarInformeCirugias(${page + 1})" class="btn-secondary">Siguiente ➡</button>`;
    paginacion.innerHTML = pagHtml;
  }
}

export function descargarInformeCirugiasPDF() {
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
  doc.text('Informe de Cirugías', 14, y);
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

  const COL = { fecha: 16, paciente: 40, rut: 76, centro: 104, tipo: 138, monto: 168 };

  const dibujarCabecera = () => {
    doc.setFillColor(59, 130, 246);
    doc.rect(14, y, 182, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('Fecha', COL.fecha, y + 5);
    doc.text('Paciente', COL.paciente, y + 5);
    doc.text('RUT', COL.rut, y + 5);
    doc.text('Centro', COL.centro, y + 5);
    doc.text('Tipo', COL.tipo, y + 5);
    doc.text('Monto', COL.monto, y + 5);
    y += 10;
    doc.setTextColor(0, 0, 0);
  };

  dibujarCabecera();

  let totalMonto = 0;
  for (const c of currentInformeRows) {
    totalMonto += Number(c.monto) || 0;

    if (y > 270) {
      doc.addPage();
      y = 20;
      dibujarCabecera();
    }

    doc.setFontSize(8);
    doc.text(c.fecha || '', COL.fecha, y);
    doc.text((c.paciente || '').substring(0, 16), COL.paciente, y);
    doc.text(formatearRutParaMostrar(c.rut || ''), COL.rut, y);
    doc.text((c.centro || '').substring(0, 16), COL.centro, y);
    doc.text((c.tipo || '').substring(0, 16), COL.tipo, y);
    doc.text(`$${Number(c.monto).toLocaleString('es-CL')}`, COL.monto, y);
    y += 6;
  }

  y += 6;
  doc.setLineWidth(0.3);
  doc.line(14, y, 196, y);
  y += 7;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text(`TOTAL: $${totalMonto.toLocaleString('es-CL')}`, 14, y);

  const pct1 = parseFloat(document.getElementById('cirugiaDescuentoPct1')?.value) || 0;
  const pct2 = parseFloat(document.getElementById('cirugiaDescuentoPct2')?.value) || 0;

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

    lineaDescuento('Total Cirugías', `$${totalMonto.toLocaleString('es-CL')}`);
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
  const filename = `Cirugias_ClinicaFlow_${new Date().toISOString().slice(0, 10)}.pdf`;
  descargarArchivo(pdfData, filename, 'application/pdf');
}

export function descargarInformeCirugiasExcel() {
  const filtros = obtenerFiltrosInforme();
  const filtered = filtrarCirugias(filtros);

  if (filtered.length === 0) {
    mostrarAviso('No hay cirugías que coincidan con los filtros.', 'advertencia');
    return;
  }

  const data = [['Fecha', 'Paciente', 'RUT', 'Centro', 'Tipo', 'Monto']];
  filtered.forEach((c) => {
    data.push([c.fecha, c.paciente, c.rut, c.centro, c.tipo, Number(c.monto) || 0]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Cirugias');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const filename = `Cirugias_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

export function actualizarDescuentoInformeCirugias() {
  const pct1Input = document.getElementById('cirugiaDescuentoPct1');
  const pct2Input = document.getElementById('cirugiaDescuentoPct2');
  const resultado = document.getElementById('cirugiaDescuentoResultado');
  if (!pct1Input || !pct2Input || !resultado) return;

  descuentoCirugiaPct1Guardado = pct1Input.value;
  descuentoCirugiaPct2Guardado = pct2Input.value;

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

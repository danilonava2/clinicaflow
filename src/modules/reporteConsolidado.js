import { state } from '../store.js';
import { formatearMonto } from '../utils/format.js';
import { descargarArchivo } from '../utils/download.js';
import { mostrarAviso } from '../ui/notificaciones.js';

const { jsPDF } = window.jspdf;
const XLSX = window.XLSX;

// Cada categoria guarda: id del bloque en el DOM, label para mostrar,
// y como leer sus filas/monto desde el state ya filtrado.
const CATEGORIAS = [
  { id: 'consolidadoPoli', icono: '📋', label: 'Policlínico' },
  { id: 'consolidadoTurnos', icono: '🕐', label: 'Turnos y Horas Extras' },
  { id: 'consolidadoCirugias', icono: '🔪', label: 'Cirugías' }
];

let filasPorCategoria = { consolidadoPoli: [], consolidadoTurnos: [], consolidadoCirugias: [] };
let totalBrutoPorCategoria = { consolidadoPoli: 0, consolidadoTurnos: 0, consolidadoCirugias: 0 };
let descuentosGuardados = {
  consolidadoPoli: { pct1: '', pct2: '' },
  consolidadoTurnos: { pct1: '', pct2: '' },
  consolidadoCirugias: { pct1: '', pct2: '' }
};

function calcularMontosDescuento(total, pct1, pct2) {
  const monto1 = total * (pct1 / 100);
  const subtotal1 = total - monto1;
  const monto2 = subtotal1 * (pct2 / 100);
  const totalFinal = subtotal1 - monto2;
  return { monto1, subtotal1, monto2, totalFinal };
}

// ==================== FILTRO DE CENTRO COMPARTIDO ====================
export function actualizarSelectFiltroConsolidado() {
  const select = document.getElementById('consolidadoFiltroCentro');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Todos los centros</option>';
  state.centros.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.nombre;
    opt.textContent = c.nombre;
    select.appendChild(opt);
  });
  if (current && state.centros.some((c) => c.nombre === current)) select.value = current;
}

function obtenerFiltros() {
  const inicio = document.getElementById('consolidadoFechaInicio').value;
  const fin = document.getElementById('consolidadoFechaFin').value;
  const centro = document.getElementById('consolidadoFiltroCentro').value;
  const start = inicio ? new Date(inicio) : null;
  const end = fin ? new Date(fin) : null;
  if (end) end.setHours(23, 59, 59);
  return { centro, start, end };
}

function pasaFecha(fechaStr, start, end) {
  if (!start || !end) return true;
  const f = new Date(fechaStr);
  return f >= start && f <= end;
}

// ==================== GENERAR RESUMEN ====================
export function generarInformeConsolidado() {
  const { centro, start, end } = obtenerFiltros();

  filasPorCategoria.consolidadoPoli = state.pacientes.filter(
    (p) => pasaFecha(p.fecha, start, end) && (!centro || p.institucion === centro)
  );
  filasPorCategoria.consolidadoTurnos = state.turnos.filter(
    (t) => pasaFecha(t.fecha, start, end) && (!centro || t.centro === centro)
  );
  filasPorCategoria.consolidadoCirugias = state.cirugias.filter(
    (c) => pasaFecha(c.fecha, start, end) && (!centro || c.centro === centro)
  );

  totalBrutoPorCategoria.consolidadoPoli = filasPorCategoria.consolidadoPoli.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  totalBrutoPorCategoria.consolidadoTurnos = filasPorCategoria.consolidadoTurnos.reduce((s, t) => s + (Number(t.total) || 0), 0);
  totalBrutoPorCategoria.consolidadoCirugias = filasPorCategoria.consolidadoCirugias.reduce((s, c) => s + (Number(c.monto) || 0), 0);

  renderResumen();
}

function boxHTML({ id, icono, label }) {
  const cantidad = filasPorCategoria[id].length;
  const bruto = totalBrutoPorCategoria[id];
  const { pct1, pct2 } = descuentosGuardados[id];
  return `<div class="reporte-desglose-card consolidado-box">
    <h4>${icono} ${label}</h4>
    <p class="consolidado-cantidad">${cantidad} registro${cantidad === 1 ? '' : 's'}</p>
    <p class="consolidado-bruto">${formatearMonto(bruto)}</p>
    <div class="consolidado-descuento-inputs">
      <div>
        <label>Desc. 1 (%)</label>
        <input type="number" id="${id}Pct1" min="0" max="100" step="0.01" placeholder="0" value="${pct1}" oninput="actualizarDescuentoConsolidado('${id}')">
      </div>
      <div>
        <label>Desc. 2 (%)</label>
        <input type="number" id="${id}Pct2" min="0" max="100" step="0.01" placeholder="0" value="${pct2}" oninput="actualizarDescuentoConsolidado('${id}')">
      </div>
    </div>
    <div id="${id}Resultado"></div>
  </div>`;
}

function renderResumen() {
  const container = document.getElementById('consolidadoResumenContainer');
  if (!container) return;

  const hayDatos = CATEGORIAS.some((cat) => filasPorCategoria[cat.id].length > 0);
  if (!hayDatos) {
    container.innerHTML = '<div class="reporte-vacio">📭 No se encontraron registros con estos filtros.</div>';
    return;
  }

  container.innerHTML = `
    <div class="reporte-desglose-grid">
      ${CATEGORIAS.map(boxHTML).join('')}
    </div>
    <div class="reporte-total">
      <div class="reporte-total-linea">
        <span>💰 Total General (neto)</span>
        <span class="monto" id="consolidadoTotalGeneralMonto"></span>
      </div>
    </div>
    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
      <button onclick="descargarInformeConsolidadoPDF()" class="btn-primary">📄 Descargar Informe Final (PDF)</button>
      <button onclick="descargarInformeConsolidadoExcel()" class="btn-secondary">📥 Excel</button>
    </div>
  `;

  CATEGORIAS.forEach((cat) => actualizarDescuentoConsolidado(cat.id));
}

// ==================== DESCUENTOS POR CATEGORIA ====================
export function actualizarDescuentoConsolidado(id) {
  const pct1Input = document.getElementById(`${id}Pct1`);
  const pct2Input = document.getElementById(`${id}Pct2`);
  const resultado = document.getElementById(`${id}Resultado`);
  if (!pct1Input || !pct2Input || !resultado) return;

  descuentosGuardados[id].pct1 = pct1Input.value;
  descuentosGuardados[id].pct2 = pct2Input.value;

  const pct1 = parseFloat(pct1Input.value) || 0;
  const pct2 = parseFloat(pct2Input.value) || 0;
  const { monto1, subtotal1, monto2, totalFinal } = calcularMontosDescuento(totalBrutoPorCategoria[id], pct1, pct2);

  if (pct1 <= 0 && pct2 <= 0) {
    resultado.innerHTML = `<div class="consolidado-final">${formatearMonto(totalFinal)}</div>`;
  } else {
    resultado.innerHTML = `
      <div class="descuento-linea"><span>Desc. 1 (${pct1}%)</span><span>-${formatearMonto(monto1)}</span></div>
      <div class="descuento-linea descuento-subtotal"><span>Subtotal</span><span>${formatearMonto(subtotal1)}</span></div>
      <div class="descuento-linea"><span>Desc. 2 (${pct2}%)</span><span>-${formatearMonto(monto2)}</span></div>
      <div class="consolidado-final">${formatearMonto(totalFinal)}</div>
    `;
  }

  actualizarTotalGeneral();
}

function totalFinalDe(id) {
  const pct1 = parseFloat(document.getElementById(`${id}Pct1`)?.value) || 0;
  const pct2 = parseFloat(document.getElementById(`${id}Pct2`)?.value) || 0;
  return calcularMontosDescuento(totalBrutoPorCategoria[id], pct1, pct2).totalFinal;
}

function actualizarTotalGeneral() {
  const el = document.getElementById('consolidadoTotalGeneralMonto');
  if (!el) return;
  const total = CATEGORIAS.reduce((s, cat) => s + totalFinalDe(cat.id), 0);
  el.innerText = formatearMonto(total);
}

// ==================== INFORME FINAL (PDF / EXCEL) ====================
function filasCombinadas() {
  const filas = [
    ...filasPorCategoria.consolidadoPoli.map((p) => ({
      fecha: p.fecha,
      categoria: 'Policlínico',
      tipo: p.prevision || '-',
      cantidad: 1,
      monto: Number(p.monto) || 0
    })),
    ...filasPorCategoria.consolidadoTurnos.map((t) => ({
      fecha: t.fecha,
      categoria: 'Turno',
      tipo: t.tipo || '-',
      cantidad: Number(t.horas) || 0,
      monto: Number(t.total) || 0
    })),
    ...filasPorCategoria.consolidadoCirugias.map((c) => ({
      fecha: c.fecha,
      categoria: 'Cirugía',
      tipo: c.tipo || '-',
      cantidad: 1,
      monto: Number(c.monto) || 0
    }))
  ];
  filas.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  return filas;
}

export function descargarInformeConsolidadoPDF() {
  const filas = filasCombinadas();
  if (filas.length === 0) {
    mostrarAviso('No hay registros que coincidan con los filtros.', 'advertencia');
    return;
  }

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
  doc.text('Informe Consolidado', 14, y);
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

  const COL = { fecha: 16, categoria: 42, tipo: 76, cantidad: 145, monto: 168 };

  const dibujarCabecera = () => {
    doc.setFillColor(59, 130, 246);
    doc.rect(14, y, 182, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('Fecha', COL.fecha, y + 5);
    doc.text('Categoría', COL.categoria, y + 5);
    doc.text('Tipo de prestación', COL.tipo, y + 5);
    doc.text('Cant.', COL.cantidad, y + 5);
    doc.text('Monto', COL.monto, y + 5);
    y += 10;
    doc.setTextColor(0, 0, 0);
  };

  dibujarCabecera();

  filas.forEach((f) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
      dibujarCabecera();
    }
    doc.setFontSize(8);
    doc.text(f.fecha || '', COL.fecha, y);
    doc.text(f.categoria, COL.categoria, y);
    doc.text((f.tipo || '').substring(0, 24), COL.tipo, y);
    doc.text(`${f.cantidad}`, COL.cantidad, y);
    doc.text(`$${f.monto.toLocaleString('es-CL')}`, COL.monto, y);
    y += 6;
  });

  y += 6;
  doc.setLineWidth(0.3);
  doc.line(14, y, 196, y);
  y += 10;

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Desglose por Categoría', 14, y);
  y += 8;

  let totalGeneral = 0;
  CATEGORIAS.forEach((cat) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    const pct1 = parseFloat(document.getElementById(`${cat.id}Pct1`)?.value) || 0;
    const pct2 = parseFloat(document.getElementById(`${cat.id}Pct2`)?.value) || 0;
    const totalBruto = totalBrutoPorCategoria[cat.id];
    const { monto1, subtotal1, monto2, totalFinal } = calcularMontosDescuento(totalBruto, pct1, pct2);
    totalGeneral += totalFinal;

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(cat.label, 14, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);
    const linea = (label, valor) => {
      doc.text(label, 20, y);
      doc.text(valor, 150, y);
      y += 5.5;
    };
    linea('Total bruto', `$${totalBruto.toLocaleString('es-CL')}`);
    if (pct1 > 0 || pct2 > 0) {
      linea(`Descuento 1 (${pct1}%)`, `-$${monto1.toLocaleString('es-CL')}`);
      linea('Subtotal', `$${subtotal1.toLocaleString('es-CL')}`);
      linea(`Descuento 2 (${pct2}%)`, `-$${monto2.toLocaleString('es-CL')}`);
    }
    doc.setFont(undefined, 'bold');
    doc.setTextColor(22, 163, 74);
    linea('Total final (neto)', `$${totalFinal.toLocaleString('es-CL')}`);
    y += 4;
  });

  y += 2;
  doc.setLineWidth(0.4);
  doc.setDrawColor(59, 130, 246);
  doc.line(14, y, 196, y);
  y += 9;

  if (y > 270) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(22, 163, 74);
  doc.text('TOTAL GENERAL (neto):', 14, y);
  doc.text(`$${totalGeneral.toLocaleString('es-CL')}`, 150, y);

  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('ClinicaFlow - Control de Ingresos para Profesionales de la Salud', 14, 285);

  const pdfData = doc.output('arraybuffer');
  const filename = `Informe_Consolidado_ClinicaFlow_${new Date().toISOString().slice(0, 10)}.pdf`;
  descargarArchivo(pdfData, filename, 'application/pdf');
}

export function descargarInformeConsolidadoExcel() {
  const filas = filasCombinadas();
  if (filas.length === 0) {
    mostrarAviso('No hay registros que coincidan con los filtros.', 'advertencia');
    return;
  }

  const data = [['Fecha', 'Categoría', 'Tipo de prestación', 'Cantidad', 'Monto']];
  filas.forEach((f) => {
    data.push([f.fecha, f.categoria, f.tipo, f.cantidad, f.monto]);
  });

  data.push([]);
  data.push(['Resumen por categoría']);
  data.push(['Categoría', 'Total bruto', 'Descuento 1 (%)', 'Descuento 2 (%)', 'Total final (neto)']);

  let totalGeneral = 0;
  CATEGORIAS.forEach((cat) => {
    const pct1 = parseFloat(document.getElementById(`${cat.id}Pct1`)?.value) || 0;
    const pct2 = parseFloat(document.getElementById(`${cat.id}Pct2`)?.value) || 0;
    const totalBruto = totalBrutoPorCategoria[cat.id];
    const { totalFinal } = calcularMontosDescuento(totalBruto, pct1, pct2);
    totalGeneral += totalFinal;
    data.push([cat.label, totalBruto, pct1, pct2, totalFinal]);
  });

  data.push([]);
  data.push(['TOTAL GENERAL (neto)', totalGeneral]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Consolidado');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const filename = `Informe_Consolidado_${new Date().toISOString().slice(0, 10)}.xlsx`;
  descargarArchivo(excelBuffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

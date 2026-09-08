import { state } from '../store.js';
import { formatearMonto, formatearFecha, escapeHtml } from '../utils/format.js';
import { descargarArchivo } from '../utils/download.js';
import { mostrarAviso } from '../ui/notificaciones.js';

const { jsPDF } = window.jspdf;
const XLSX = window.XLSX;

// Cada categoria: prefijo de id, label, nombre de la columna de
// agrupacion (previsión para Policlínico, tipo para Turnos/Cirugías),
// y como leer centro/clave/monto de cada registro.
const CATEGORIAS = [
  {
    id: 'consolidadoPoli',
    icono: '📋',
    label: 'Policlínico',
    columnaGrupo: 'Previsión',
    obtenerCentro: (p) => p.institucion || 'Sin centro',
    obtenerClave: (p) => p.prevision || 'Sin previsión',
    obtenerMonto: (p) => Number(p.monto) || 0
  },
  {
    id: 'consolidadoTurnos',
    icono: '🕐',
    label: 'Turnos y Horas Extras',
    columnaGrupo: 'Tipo',
    obtenerCentro: (t) => t.centro || 'Sin centro',
    obtenerClave: (t) => t.tipo || 'Sin tipo',
    obtenerMonto: (t) => Number(t.total) || 0
  },
  {
    id: 'consolidadoCirugias',
    icono: '🔪',
    label: 'Cirugías',
    columnaGrupo: 'Tipo',
    obtenerCentro: (c) => c.centro || 'Sin centro',
    obtenerClave: (c) => c.tipo || 'Sin tipo',
    obtenerMonto: (c) => Number(c.monto) || 0
  }
];

// Cada "caja" es una combinacion Categoria + Centro (porque cada centro
// puede tener un porcentaje de descuento distinto). Se recalculan
// completas cada vez que se presiona "Generar".
let boxesActuales = [];
// Los porcentajes escritos se recuerdan por boxId mientras dura la
// sesion, para no perderlos si se vuelve a generar con los mismos filtros.
let descuentosGuardados = {};

function calcularMontosDescuento(total, pct1, pct2) {
  const monto1 = total * (pct1 / 100);
  const subtotal1 = total - monto1;
  const monto2 = subtotal1 * (pct2 / 100);
  const totalFinal = subtotal1 - monto2;
  return { monto1, subtotal1, monto2, totalFinal };
}

// Agrupa las filas de una caja por Previsión/Tipo, sumando cantidad y
// monto (el centro ya esta fijo dentro de la caja, no hace falta repetirlo).
function agruparPorClave(box) {
  const grupos = {};
  box.filas.forEach((item) => {
    const clave = box.cat.obtenerClave(item);
    if (!grupos[clave]) grupos[clave] = { clave, cantidad: 0, monto: 0 };
    grupos[clave].cantidad += 1;
    grupos[clave].monto += box.cat.obtenerMonto(item);
  });
  return Object.values(grupos).sort((a, b) => a.clave.localeCompare(b.clave));
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

// Texto legible del rango de fechas (y centro, si esta filtrado) para
// dejarlo escrito en el encabezado del informe final.
function descripcionPeriodo() {
  const inicio = document.getElementById('consolidadoFechaInicio')?.value;
  const fin = document.getElementById('consolidadoFechaFin')?.value;
  const centro = document.getElementById('consolidadoFiltroCentro')?.value;

  let periodo;
  if (inicio && fin) periodo = `${formatearFecha(inicio)} al ${formatearFecha(fin)}`;
  else if (inicio) periodo = `Desde ${formatearFecha(inicio)}`;
  else if (fin) periodo = `Hasta ${formatearFecha(fin)}`;
  else periodo = 'Todo el historial';

  return centro ? `${periodo} · Centro: ${centro}` : periodo;
}

// ==================== GENERAR RESUMEN ====================
export function generarInformeConsolidado() {
  const { centro, start, end } = obtenerFiltros();

  const filasPorCategoriaId = {
    consolidadoPoli: state.pacientes.filter(
      (p) => pasaFecha(p.fecha, start, end) && (!centro || p.institucion === centro)
    ),
    consolidadoTurnos: state.turnos.filter(
      (t) => pasaFecha(t.fecha, start, end) && (!centro || t.centro === centro)
    ),
    consolidadoCirugias: state.cirugias.filter(
      (c) => pasaFecha(c.fecha, start, end) && (!centro || c.centro === centro)
    )
  };

  boxesActuales = [];
  CATEGORIAS.forEach((cat) => {
    const filas = filasPorCategoriaId[cat.id];
    const centros = Array.from(new Set(filas.map(cat.obtenerCentro))).sort((a, b) => a.localeCompare(b));
    centros.forEach((centroNombre, idx) => {
      const filasCentro = filas.filter((item) => cat.obtenerCentro(item) === centroNombre);
      const totalBruto = filasCentro.reduce((s, item) => s + cat.obtenerMonto(item), 0);
      const boxId = `${cat.id}_${idx}`;
      if (!descuentosGuardados[boxId]) descuentosGuardados[boxId] = { pct1: '', pct2: '' };
      boxesActuales.push({
        boxId,
        cat,
        centro: centroNombre,
        filas: filasCentro,
        cantidad: filasCentro.length,
        totalBruto
      });
    });
  });

  renderResumen();
}

function boxHTML(box) {
  const { boxId, cat, centro, cantidad, totalBruto } = box;
  const { pct1, pct2 } = descuentosGuardados[boxId];
  return `<div class="reporte-desglose-card consolidado-box">
    <h4>${cat.icono} ${cat.label}</h4>
    <p class="consolidado-centro">🏥 ${escapeHtml(centro)}</p>
    <p class="consolidado-cantidad">${cantidad} registro${cantidad === 1 ? '' : 's'}</p>
    <p class="consolidado-bruto">${formatearMonto(totalBruto)}</p>
    <div class="consolidado-descuento-inputs">
      <div>
        <label>Desc. 1 (%)</label>
        <input type="number" id="${boxId}Pct1" min="0" max="100" step="0.01" placeholder="0" value="${pct1}" oninput="actualizarDescuentoConsolidado('${boxId}')">
      </div>
      <div>
        <label>Desc. 2 (%)</label>
        <input type="number" id="${boxId}Pct2" min="0" max="100" step="0.01" placeholder="0" value="${pct2}" oninput="actualizarDescuentoConsolidado('${boxId}')">
      </div>
    </div>
    <div id="${boxId}Resultado"></div>
  </div>`;
}

function renderResumen() {
  const container = document.getElementById('consolidadoResumenContainer');
  if (!container) return;

  if (boxesActuales.length === 0) {
    container.innerHTML = '<div class="reporte-vacio">📭 No se encontraron registros con estos filtros.</div>';
    return;
  }

  container.innerHTML = `
    <div class="reporte-desglose-grid">
      ${boxesActuales.map(boxHTML).join('')}
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

  boxesActuales.forEach((box) => actualizarDescuentoConsolidado(box.boxId));
}

// ==================== DESCUENTOS POR CAJA (Categoria + Centro) ====================
export function actualizarDescuentoConsolidado(boxId) {
  const box = boxesActuales.find((b) => b.boxId === boxId);
  const pct1Input = document.getElementById(`${boxId}Pct1`);
  const pct2Input = document.getElementById(`${boxId}Pct2`);
  const resultado = document.getElementById(`${boxId}Resultado`);
  if (!box || !pct1Input || !pct2Input || !resultado) return;

  descuentosGuardados[boxId].pct1 = pct1Input.value;
  descuentosGuardados[boxId].pct2 = pct2Input.value;

  const pct1 = parseFloat(pct1Input.value) || 0;
  const pct2 = parseFloat(pct2Input.value) || 0;
  const { monto1, subtotal1, monto2, totalFinal } = calcularMontosDescuento(box.totalBruto, pct1, pct2);

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

function totalFinalDeBox(box) {
  const pct1 = parseFloat(document.getElementById(`${box.boxId}Pct1`)?.value) || 0;
  const pct2 = parseFloat(document.getElementById(`${box.boxId}Pct2`)?.value) || 0;
  return calcularMontosDescuento(box.totalBruto, pct1, pct2).totalFinal;
}

function actualizarTotalGeneral() {
  const el = document.getElementById('consolidadoTotalGeneralMonto');
  if (!el) return;
  const total = boxesActuales.reduce((s, box) => s + totalFinalDeBox(box), 0);
  el.innerText = formatearMonto(total);
}

// ==================== INFORME FINAL (PDF / EXCEL) ====================
export function descargarInformeConsolidadoPDF() {
  if (boxesActuales.length === 0) {
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
  y += 5;
  if (state.currentUser?.email) {
    doc.text(`Usuario: ${state.currentUser.email}`, 14, y);
    y += 5;
  }

  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Período: ${descripcionPeriodo()}`, 14, y);
  doc.setFont(undefined, 'normal');
  y += 10;

  let totalGeneral = 0;
  let categoriaAnterior = null;

  boxesActuales.forEach((box) => {
    const grupos = agruparPorClave(box);

    if (y > 245) {
      doc.addPage();
      y = 20;
    }

    if (box.cat.id !== categoriaAnterior) {
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text(box.cat.label, 14, y);
      y += 7;
      categoriaAnterior = box.cat.id;
    }

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(box.centro, 16, y);
    y += 6;

    const COL = { clave: 20, cantidad: 150, monto: 168 };
    const dibujarCabeceraTabla = () => {
      doc.setFillColor(226, 232, 240);
      doc.rect(14, y, 182, 6, 'F');
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8);
      doc.text(box.cat.columnaGrupo, COL.clave, y + 4.5);
      doc.text('Cant.', COL.cantidad, y + 4.5);
      doc.text('Monto', COL.monto, y + 4.5);
      y += 9;
      doc.setTextColor(0, 0, 0);
    };

    dibujarCabeceraTabla();

    grupos.forEach((g) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
        dibujarCabeceraTabla();
      }
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.text(g.clave.substring(0, 40), COL.clave, y);
      doc.text(`${g.cantidad}`, COL.cantidad, y);
      doc.text(`$${g.monto.toLocaleString('es-CL')}`, COL.monto, y);
      y += 5.5;
    });

    y += 3;
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    const pct1 = parseFloat(document.getElementById(`${box.boxId}Pct1`)?.value) || 0;
    const pct2 = parseFloat(document.getElementById(`${box.boxId}Pct2`)?.value) || 0;
    const { monto1, subtotal1, monto2, totalFinal } = calcularMontosDescuento(box.totalBruto, pct1, pct2);
    totalGeneral += totalFinal;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);
    const linea = (label, valor) => {
      doc.text(label, 20, y);
      doc.text(valor, 150, y);
      y += 5.5;
    };
    linea('Total bruto', `$${box.totalBruto.toLocaleString('es-CL')}`);
    if (pct1 > 0 || pct2 > 0) {
      linea(`Descuento 1 (${pct1}%)`, `-$${monto1.toLocaleString('es-CL')}`);
      linea('Subtotal', `$${subtotal1.toLocaleString('es-CL')}`);
      linea(`Descuento 2 (${pct2}%)`, `-$${monto2.toLocaleString('es-CL')}`);
    }
    doc.setFont(undefined, 'bold');
    doc.setTextColor(22, 163, 74);
    linea('Total final (neto)', `$${totalFinal.toLocaleString('es-CL')}`);
    y += 7;
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
  if (boxesActuales.length === 0) {
    mostrarAviso('No hay registros que coincidan con los filtros.', 'advertencia');
    return;
  }

  const data = [['Informe Consolidado'], [`Período: ${descripcionPeriodo()}`], []];
  let totalGeneral = 0;
  let categoriaAnterior = null;

  boxesActuales.forEach((box) => {
    const grupos = agruparPorClave(box);

    if (box.cat.id !== categoriaAnterior) {
      data.push([box.cat.label]);
      categoriaAnterior = box.cat.id;
    }

    data.push([box.centro]);
    data.push([box.cat.columnaGrupo, 'Cantidad', 'Monto']);
    grupos.forEach((g) => {
      data.push([g.clave, g.cantidad, g.monto]);
    });

    const pct1 = parseFloat(document.getElementById(`${box.boxId}Pct1`)?.value) || 0;
    const pct2 = parseFloat(document.getElementById(`${box.boxId}Pct2`)?.value) || 0;
    const { monto1, subtotal1, monto2, totalFinal } = calcularMontosDescuento(box.totalBruto, pct1, pct2);
    totalGeneral += totalFinal;

    data.push(['Total bruto', box.totalBruto]);
    if (pct1 > 0 || pct2 > 0) {
      data.push([`Descuento 1 (${pct1}%)`, -monto1]);
      data.push(['Subtotal', subtotal1]);
      data.push([`Descuento 2 (${pct2}%)`, -monto2]);
    }
    data.push(['Total final (neto)', totalFinal]);
    data.push([]);
  });

  data.push(['TOTAL GENERAL (neto)', totalGeneral]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Consolidado');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const filename = `Informe_Consolidado_${new Date().toISOString().slice(0, 10)}.xlsx`;
  descargarArchivo(excelBuffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

import { state } from '../store.js';

const { jsPDF } = window.jspdf;
const XLSX = window.XLSX;
import { formatearFecha, formatearMonto, escapeHtml } from '../utils/format.js';
import { formatearRutParaMostrar } from '../utils/rut.js';
import { descargarArchivo } from '../utils/download.js';

const ITEMS_PER_PAGE = 10;

let currentReportRows = [];
let currentReportPage = 1;

function obtenerFiltros() {
  const inicio = document.getElementById('fechaInicio').value;
  const fin = document.getElementById('fechaFin').value;
  const nombre = document.getElementById('reporteNombre').value.trim().toLowerCase();
  const rut = document.getElementById('reporteRut').value.trim().toLowerCase();
  const inst = document.getElementById('filtroInstitucionSelect').value;
  const start = inicio ? new Date(inicio) : null;
  const end = fin ? new Date(fin) : null;
  if (end) end.setHours(23, 59, 59);
  return { nombre, rut, inst, start, end };
}

function filtrarPacientes({ nombre, rut, inst, start, end }) {
  return state.pacientes.filter((p) => {
    const fecha = new Date(p.fecha);
    const pasaFecha = !start || !end || (fecha >= start && fecha <= end);
    const pasaNombre = !nombre || p.nombre.toLowerCase().includes(nombre);
    const pasaRut = !rut || p.rut.toLowerCase().includes(rut);
    const pasaInst = !inst || p.institucion === inst;
    return pasaFecha && pasaNombre && pasaRut && pasaInst;
  });
}

export function generarReporte(page = 1) {
  const filtros = obtenerFiltros();
  const rows = filtrarPacientes(filtros);
  currentReportRows = rows;
  currentReportPage = page;

  const container = document.getElementById('reporteContainer');
  const paginacion = document.getElementById('reportePaginacion');
  if (!container) return;
  if (rows.length === 0) {
    container.innerHTML = '<div class="reporte-vacio">📭 No se encontraron atenciones con estos filtros.</div>';
    if (paginacion) paginacion.innerHTML = '';
    return;
  }

  const totalBruto = rows.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE);
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const paginated = rows.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  let html = `<div class="reporte-resultado">
    <div class="reporte-encabezado">
      <h3>📄 Reporte de Atenciones</h3>
      <span class="reporte-badge">${rows.length} atención${rows.length === 1 ? '' : 'es'} encontrada${rows.length === 1 ? '' : 's'}</span>
    </div>
    <div style="overflow-x:auto;">
      <table class="tabla-resultados">
        <thead>
          <tr><th>Fecha</th><th>Paciente</th><th>RUT</th><th>Centro</th><th>Previsión</th><th>Monto</th></tr>
        </thead>
        <tbody>`;

  paginated.forEach((p) => {
    html += `<tr>
      <td>${formatearFecha(p.fecha)}</td>
      <td>${escapeHtml(p.nombre)}</td>
      <td>${formatearRutParaMostrar(p.rut)}</td>
      <td>${escapeHtml(p.institucion || '-')}</td>
      <td>${escapeHtml(p.prevision || '-')}</td>
      <td>${formatearMonto(p.monto)}</td>
    </tr>`;
  });

  html += `</tbody>
      </table>
    </div>
    <div class="reporte-total">
      <span>💰 Total Ingresos</span>
      <span class="monto">${formatearMonto(totalBruto)}</span>
    </div>
    <button onclick="descargarReportePDF()" class="btn-primary">📄 Descargar PDF</button>
  </div>`;

  container.innerHTML = html;

  if (paginacion) {
    let pagHtml = '';
    if (page > 1) pagHtml += `<button onclick="generarReporte(${page - 1})" class="btn-secondary">⬅ Anterior</button>`;
    pagHtml += `<span>Página ${page} de ${totalPages}</span>`;
    if (page < totalPages) pagHtml += `<button onclick="generarReporte(${page + 1})" class="btn-secondary">Siguiente ➡</button>`;
    paginacion.innerHTML = pagHtml;
  }
}

export function descargarReportePDF() {
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
  doc.text('Reporte de Ingresos', 14, y);
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

  const COL = { fecha: 16, paciente: 40, rut: 76, centro: 104, prevision: 138, monto: 168 };

  const dibujarCabecera = () => {
    doc.setFillColor(59, 130, 246);
    doc.rect(14, y, 182, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('Fecha', COL.fecha, y + 5);
    doc.text('Paciente', COL.paciente, y + 5);
    doc.text('RUT', COL.rut, y + 5);
    doc.text('Centro', COL.centro, y + 5);
    doc.text('Previsión', COL.prevision, y + 5);
    doc.text('Monto', COL.monto, y + 5);
    y += 10;
    doc.setTextColor(0, 0, 0);
  };

  dibujarCabecera();

  let total = 0;
  for (const p of currentReportRows) {
    total += Number(p.monto) || 0;

    if (y > 270) {
      doc.addPage();
      y = 20;
      dibujarCabecera();
    }

    doc.text(p.fecha || '', COL.fecha, y);
    doc.text((p.nombre || '').substring(0, 16), COL.paciente, y);
    doc.text(formatearRutParaMostrar(p.rut || ''), COL.rut, y);
    doc.text((p.institucion || '').substring(0, 16), COL.centro, y);
    doc.text((p.prevision || '-').substring(0, 14), COL.prevision, y);
    doc.text(`$${Number(p.monto).toLocaleString('es-CL')}`, COL.monto, y);
    y += 6;
  }

  y += 6;
  doc.setLineWidth(0.3);
  doc.line(14, y, 196, y);
  y += 5;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text(`TOTAL GENERAL: $${total.toLocaleString('es-CL')}`, 14, y);

  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('ClinicaFlow - Control de Ingresos para Profesionales de la Salud', 14, 285);

  const pdfData = doc.output('arraybuffer');
  const filename = `Reporte_ClinicaFlow_${new Date().toISOString().slice(0, 10)}.pdf`;
  descargarArchivo(pdfData, filename, 'application/pdf');
}

export function descargarExcel() {
  const filtros = obtenerFiltros();
  const filtered = filtrarPacientes(filtros);

  if (filtered.length === 0) {
    alert('No hay registros que coincidan con los filtros.');
    return;
  }

  const data = [['Fecha', 'Paciente', 'RUT', 'Centro', 'Previsión', 'Monto']];
  filtered.forEach((p) => {
    data.push([p.fecha, p.nombre, p.rut, p.institucion || '', p.prevision || '', Number(p.monto) || 0]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Atenciones');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const filename = `Atenciones_${new Date().toISOString().slice(0, 10)}.xlsx`;
  descargarArchivo(excelBuffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

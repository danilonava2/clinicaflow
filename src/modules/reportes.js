import { state } from '../store.js';

const { jsPDF } = window.jspdf;
const XLSX = window.XLSX;
import { formatearFecha, formatearMonto, escapeHtml } from '../utils/format.js';
import { formatearRutParaMostrar } from '../utils/rut.js';
import { descargarArchivo } from '../utils/download.js';

let currentReportRows = [];

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

export function generarReporte() {
  const filtros = obtenerFiltros();
  const rows = filtrarPacientes(filtros);
  currentReportRows = rows;

  const container = document.getElementById('reporteContainer');
  if (!container) return;
  if (rows.length === 0) {
    container.innerHTML = '<p>No se encontraron atenciones.</p>';
    return;
  }

  const totalBruto = rows.reduce((s, p) => s + (Number(p.monto) || 0), 0);

  let html = `<h3>Reporte de Atenciones</h3>
    <p><strong>Total atenciones:</strong> ${rows.length}</p>
    <div style="overflow-x:auto;">
      <table class="tabla-resultados">
        <thead>
          <tr><th>Fecha</th><th>Paciente</th><th>RUT</th><th>Centro</th><th>Monto</th></tr>
        </thead>
        <tbody>`;

  rows.forEach((p) => {
    html += `<tr>
      <td>${formatearFecha(p.fecha)}</td>
      <td>${escapeHtml(p.nombre)}</td>
      <td>${formatearRutParaMostrar(p.rut)}</td>
      <td>${escapeHtml(p.institucion || '-')}</td>
      <td>${formatearMonto(p.monto)}</td>
    </tr>`;
  });

  html += `</tbody>
      </table>
    </div>
    <div style="margin:25px 0; padding:25px; background:#f0fdf4; border-radius:12px; text-align:center;">
      <p><strong>Total Ingresos:</strong> ${formatearMonto(totalBruto)}</p>
    </div>
    <button onclick="descargarReportePDF()" class="btn-primary">📄 Descargar PDF</button>`;

  container.innerHTML = html;
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

  const dibujarCabecera = () => {
    doc.setFillColor(59, 130, 246);
    doc.rect(14, y, 180, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('Fecha', 16, y + 5);
    doc.text('Paciente', 45, y + 5);
    doc.text('RUT', 95, y + 5);
    doc.text('Centro', 120, y + 5);
    doc.text('Monto', 170, y + 5);
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

    doc.text(p.fecha || '', 16, y);
    doc.text((p.nombre || '').substring(0, 22), 45, y);
    doc.text(formatearRutParaMostrar(p.rut || ''), 95, y);
    doc.text((p.institucion || '').substring(0, 22), 120, y);
    doc.text(`$${Number(p.monto).toLocaleString('es-CL')}`, 170, y);
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

  const data = [['Fecha', 'Paciente', 'RUT', 'Centro', 'Monto']];
  filtered.forEach((p) => {
    data.push([p.fecha, p.nombre, p.rut, p.institucion || '', Number(p.monto) || 0]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Atenciones');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const filename = `Atenciones_${new Date().toISOString().slice(0, 10)}.xlsx`;
  descargarArchivo(excelBuffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

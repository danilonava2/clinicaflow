import { state } from '../store.js';
import { formatearMonto } from '../utils/format.js';

const Chart = window.Chart;

// Paleta categorica validada (orden fijo, no ciclar) - ver skill de dataviz.
const PALETA_CATEGORICA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
const COLOR_OTROS = '#94a3b8';
const MAX_SEGMENTOS = 6;

let ingresosChart, atencionesChart, ingresosCentroChart, ingresosPrevisionChart;

function agruparPorMes(data) {
  const byMonth = {};
  data.forEach((p) => {
    const mes = p.fecha.substring(0, 7);
    if (!byMonth[mes]) byMonth[mes] = { pacientes: 0, monto: 0 };
    byMonth[mes].pacientes++;
    byMonth[mes].monto += Number(p.monto) || 0;
  });
  const meses = Object.keys(byMonth).sort();
  return { meses, pacientesData: meses.map((m) => byMonth[m].pacientes), montoData: meses.map((m) => byMonth[m].monto) };
}

// Agrupa por una clave y, si hay mas de MAX_SEGMENTOS grupos, junta el resto
// en "Otros" (ver anti-patrones: pie/donut legible solo hasta ~6 segmentos).
function agruparConOtros(data, obtenerClave) {
  const totales = {};
  data.forEach((p) => {
    const clave = obtenerClave(p) || 'Sin datos';
    totales[clave] = (totales[clave] || 0) + (Number(p.monto) || 0);
  });
  const entradas = Object.entries(totales).sort((a, b) => b[1] - a[1]);
  if (entradas.length <= MAX_SEGMENTOS) return entradas;
  const principales = entradas.slice(0, MAX_SEGMENTOS - 1);
  const restoTotal = entradas.slice(MAX_SEGMENTOS - 1).reduce((s, [, v]) => s + v, 0);
  return [...principales, ['Otros', restoTotal]];
}

export function cargarDashboard() {
  const inicio = document.getElementById('dashFechaInicio').value;
  const fin = document.getElementById('dashFechaFin').value;
  const centro = document.getElementById('dashInstitucionSelect').value;
  const prevision = document.getElementById('dashPrevisionSelect').value;

  let data = state.pacientes;
  const start = inicio ? new Date(inicio) : null;
  const end = fin ? new Date(fin) : null;
  if (end) end.setHours(23, 59, 59);

  data = data.filter((p) => {
    const fecha = new Date(p.fecha);
    const pasaFecha = (!start || fecha >= start) && (!end || fecha <= end);
    const pasaCentro = !centro || p.institucion === centro;
    const pasaPrevision = !prevision || p.prevision === prevision;
    return pasaFecha && pasaCentro && pasaPrevision;
  });

  const total = data.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const atenciones = data.length;
  const promedio = atenciones ? total / atenciones : 0;
  const porCentro = {};
  data.forEach((p) => {
    const c = p.institucion || 'Sin centro';
    porCentro[c] = (porCentro[c] || 0) + (Number(p.monto) || 0);
  });
  let mejor = '-';
  let max = 0;
  for (const [c, v] of Object.entries(porCentro)) {
    if (v > max) {
      max = v;
      mejor = c;
    }
  }

  document.getElementById('totalIngresos').innerText = formatearMonto(total);
  document.getElementById('totalAtenciones').innerText = atenciones;
  document.getElementById('promedioAtencion').innerText = formatearMonto(promedio);
  document.getElementById('mejorCentro').innerText = mejor;
  renderGraficos(data);
}

const GRID_RECESIVO = { color: '#e1e0d9', drawTicks: false };
const EJE_RECESIVO = { color: '#c3c2b7' };

function renderGraficos(data) {
  const { meses, pacientesData, montoData } = agruparPorMes(data);

  const ctxIngresos = document.getElementById('ingresosChart')?.getContext('2d');
  if (ctxIngresos) {
    if (ingresosChart) ingresosChart.destroy();
    ingresosChart = new Chart(ctxIngresos, {
      type: 'bar',
      data: {
        labels: meses,
        datasets: [{ data: montoData, backgroundColor: PALETA_CATEGORICA[0], borderRadius: 4, maxBarThickness: 28 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => formatearMonto(ctx.raw) } }
        },
        scales: {
          y: { beginAtZero: true, grid: GRID_RECESIVO, border: { color: EJE_RECESIVO.color }, ticks: { callback: (v) => formatearMonto(v) } },
          x: { grid: { display: false }, border: { color: EJE_RECESIVO.color } }
        }
      }
    });
  }

  const ctxAtenciones = document.getElementById('atencionesChart')?.getContext('2d');
  if (ctxAtenciones) {
    if (atencionesChart) atencionesChart.destroy();
    atencionesChart = new Chart(ctxAtenciones, {
      type: 'bar',
      data: {
        labels: meses,
        datasets: [{ data: pacientesData, backgroundColor: PALETA_CATEGORICA[2], borderRadius: 4, maxBarThickness: 28 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: GRID_RECESIVO, border: { color: EJE_RECESIVO.color } },
          x: { grid: { display: false }, border: { color: EJE_RECESIVO.color } }
        }
      }
    });
  }

  const datosCentro = agruparConOtros(data, (p) => p.institucion);
  const ctxCentro = document.getElementById('ingresosCentroChart')?.getContext('2d');
  if (ctxCentro) {
    if (ingresosCentroChart) ingresosCentroChart.destroy();
    ingresosCentroChart = crearDonut(ctxCentro, datosCentro);
  }

  const datosPrevision = agruparConOtros(data, (p) => p.prevision);
  const ctxPrevision = document.getElementById('ingresosPrevisionChart')?.getContext('2d');
  if (ctxPrevision) {
    if (ingresosPrevisionChart) ingresosPrevisionChart.destroy();
    ingresosPrevisionChart = crearDonut(ctxPrevision, datosPrevision);
  }
}

function crearDonut(ctx, entradas) {
  const isMobile = window.innerWidth <= 768;
  const labels = entradas.map(([label]) => label);
  const valores = entradas.map(([, valor]) => valor);
  const colores = entradas.map(([label], i) => (label === 'Otros' ? COLOR_OTROS : PALETA_CATEGORICA[i % PALETA_CATEGORICA.length]));

  return new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: valores, backgroundColor: colores, borderColor: '#ffffff', borderWidth: 2 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: isMobile ? 'bottom' : 'right',
          labels: { boxWidth: 10, font: { size: isMobile ? 9 : 11 }, color: '#52514e' }
        },
        tooltip: { callbacks: { label: (ctx2) => `${ctx2.label}: ${formatearMonto(ctx2.raw)}` } }
      }
    }
  });
}

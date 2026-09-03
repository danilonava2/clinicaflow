import { state } from '../store.js';

const Chart = window.Chart;
import { formatearMonto } from '../utils/format.js';

let generalChart;
let ingresosCentroChart;

export function cargarDashboard() {
  const inicio = document.getElementById('dashFechaInicio').value;
  const fin = document.getElementById('dashFechaFin').value;
  let data = state.pacientes;
  if (inicio || fin) {
    const start = inicio ? new Date(inicio) : null;
    const end = fin ? new Date(fin) : null;
    if (end) end.setHours(23, 59, 59);
    data = data.filter((p) => {
      const fecha = new Date(p.fecha);
      return (!start || fecha >= start) && (!end || fecha <= end);
    });
  }

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

function renderGraficos(data) {
  const isMobile = window.innerWidth <= 768;
  const byMonth = {};
  data.forEach((p) => {
    const mes = p.fecha.substring(0, 7);
    if (!byMonth[mes]) byMonth[mes] = { pacientes: 0, monto: 0 };
    byMonth[mes].pacientes++;
    byMonth[mes].monto += Number(p.monto) || 0;
  });
  const meses = Object.keys(byMonth).sort();
  const pacientesData = meses.map((m) => byMonth[m].pacientes);
  const montoData = meses.map((m) => byMonth[m].monto);

  const ctx1 = document.getElementById('generalChart')?.getContext('2d');
  if (ctx1) {
    if (generalChart) generalChart.destroy();
    generalChart = new Chart(ctx1, {
      type: isMobile ? 'line' : 'bar',
      data: {
        labels: meses,
        datasets: [
          {
            label: 'Atenciones',
            data: pacientesData,
            backgroundColor: '#3b82f6',
            borderColor: '#3b82f6',
            tension: 0.3,
            fill: false,
            pointRadius: isMobile ? 3 : 5
          },
          {
            label: 'Ingresos ($)',
            data: montoData,
            backgroundColor: '#10b981',
            borderColor: '#10b981',
            tension: 0.3,
            fill: false,
            pointRadius: isMobile ? 3 : 5,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: isMobile ? 'bottom' : 'top', labels: { boxWidth: 12, font: { size: isMobile ? 10 : 12 } } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { font: { size: isMobile ? 9 : 11 } } },
          y1: {
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: {
              font: { size: isMobile ? 9 : 11 },
              callback: (v) => (isMobile ? `${v / 1000}k` : `$${v.toLocaleString()}`)
            }
          },
          x: { ticks: { maxRotation: isMobile ? 45 : 0, autoSkip: true, maxTicksLimit: isMobile ? 6 : 10, font: { size: isMobile ? 9 : 11 } } }
        }
      }
    });
  }

  const porCentro = {};
  data.forEach((p) => {
    const c = p.institucion || 'Sin centro';
    porCentro[c] = (porCentro[c] || 0) + (Number(p.monto) || 0);
  });
  const ctx2 = document.getElementById('ingresosCentroChart')?.getContext('2d');
  if (ctx2) {
    if (ingresosCentroChart) ingresosCentroChart.destroy();
    ingresosCentroChart = new Chart(ctx2, {
      type: 'pie',
      data: {
        labels: Object.keys(porCentro),
        datasets: [
          {
            data: Object.values(porCentro),
            backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1'],
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: isMobile ? 'bottom' : 'right',
            labels: {
              boxWidth: 10,
              font: { size: isMobile ? 9 : 11 },
              generateLabels: (chart) => {
                const chartData = chart.data;
                if (chartData.labels.length) {
                  return chartData.labels.map((label, i) => ({
                    text: isMobile ? `${label.substring(0, 15)}` : label,
                    fillStyle: chartData.datasets[0].backgroundColor[i],
                    index: i
                  }));
                }
                return [];
              }
            }
          },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatearMonto(ctx.raw)}` } }
        }
      }
    });
  }
}

import { auth, firestoreDb } from './firebase/config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { escucharTodosLosUsuarios, cambiarPlanUsuario, guardarDatosUsuario } from './firebase/firestoreDataService.js';

// Solo esta cuenta puede ver y usar este panel (ademas de estar reforzado
// en firestore.rules, que es lo que realmente protege los datos).
const ADMIN_UID = 'VJEehVVQdpVgQqd5g6X6r9xxnyr2';

// Envio real de correos (sin backend/plan Blaze) via un Google Apps Script
// propio, desplegado como Web App, que envia desde la cuenta Gmail del
// administrador con GmailApp.sendEmail(). EMAIL_SECRET no es un secreto
// fuerte (este archivo es publico, como cualquier JS de un sitio estatico)
// pero evita el envio accidental/trivial por parte de terceros que no
// hayan revisado el codigo fuente.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyZ-jtWDA3gBXq-wxyOaM8yHI7_2lgVA0WdKJWt4jC6XHKh03F99FXnXsjdhKbC-vGyLg/exec';
const EMAIL_SECRET = '49IbMngXRSWz0b2SQOWr_rsxsHC_qqoP';
const LOGO_URL = 'https://danilonava2.github.io/clinicaflow/img/logo-transparente.png';

function construirCorreoBienvenida(email) {
  // El asunto es texto plano (no HTML), asi que no puede usar entidades
  // como el cuerpo -- por eso va sin emoji, evitando el bug de Apps
  // Script que corrompe emoji/unicode fuera del rango basico (BMP).
  const subject = '¡Bienvenido/a a ClinicaFlow! Tu prueba Pro de 7 días está en camino';
  const htmlBody = `
  <div style="font-family: Segoe UI, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #334155;">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${LOGO_URL}" alt="ClinicaFlow" style="max-width: 200px;">
    </div>
    <p>Estimado/a usuario/a,</p>
    <p>¡Bienvenido/a a ClinicaFlow! Nos alegra que hayas decidido probar la aplicación pensada para ayudar a profesionales de la salud como tú a llevar el control de sus ingresos de forma simple y ordenada.</p>
    <p>Le informamos que, en los próximos minutos, la cuenta asociada a tu correo (<b>${email}</b>) será activada en la versión Pro por un periodo de prueba de 7 días. Durante este tiempo podrás acceder sin restricciones a todas las funcionalidades disponibles, con el fin de que puedas evaluar el sistema de manera integral.</p>
    <p>Con ClinicaFlow podrás:</p>
    <ul style="padding-left: 20px; line-height: 1.7;">
      <li>&#127973; Registrar tus atenciones por centro y previsión, todo en un solo lugar.</li>
      <li>&#128336; Llevar tus turnos, guardias y horas extra con calendario y cálculo automático.</li>
      <li>&#128298; Registrar cirugías con montos y descuentos propios.</li>
      <li>&#128202; Generar reportes financieros en PDF y Excel, con calculadora de descuentos incluida.</li>
      <li>&#128200; Ver un dashboard con tus ingresos, atenciones y tu mejor centro del mes.</li>
      <li>&#128260; Sincronizar todo en tiempo real entre tu celular y computador.</li>
    </ul>
    <p>Todo esto pensado para que dediques menos tiempo a ordenar planillas y más tiempo a lo que realmente importa: tu trabajo.</p>
    <p>Quedamos a tu disposición para resolver cualquier consulta o inquietud que pueda surgir.</p>
    <p>Atentamente,<br>El equipo de ClinicaFlow</p>
    <div style="text-align: center; margin-top: 20px;">
      <img src="${LOGO_URL}" alt="ClinicaFlow" style="max-width: 150px;">
    </div>
  </div>`;
  return { subject, htmlBody };
}

async function llamarAppsScript(payload) {
  const respuesta = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ secret: EMAIL_SECRET, ...payload })
  });
  const resultado = await respuesta.json();
  if (!resultado.ok) throw new Error(resultado.error || 'Error desconocido');
}

async function enviarCorreoBienvenida(email) {
  const { subject, htmlBody } = construirCorreoBienvenida(email);
  await llamarAppsScript({ to: email, subject, htmlBody });
}

// ==================== ARCHIVAR REGISTROS ANTIGUOS ====================
// Mueve registros de un rango de fechas fuera del documento activo del
// usuario (que tiene un tope duro de 1 MiB en Firestore, independiente
// del plan de pago), dejando un respaldo en 3 formatos: PDF adjunto en un
// correo al usuario (para que tenga su propio comprobante de ingresos,
// ej. ante el SII), y PDF+Excel+JSON guardados en el Drive de la cuenta
// que ejecuta el Apps Script (clinicaflowapp@gmail.com), en una carpeta
// por usuario.

function construirCuerpoCorreoArchivo(email, desde, hasta, { pacientesArchivar, turnosArchivar, cirugiasArchivar }) {
  return `
  <div style="font-family: Segoe UI, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #334155;">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${LOGO_URL}" alt="ClinicaFlow" style="max-width: 200px;">
    </div>
    <p>Estimado/a usuario/a,</p>
    <p>Como parte de la mantención periódica de ClinicaFlow, se archivaron los registros del período <b>${desde}</b> al <b>${hasta}</b> de tu cuenta (<b>${email}</b>). Estos registros ya no aparecen en la app activa, pero quedan respaldados en el PDF adjunto a este correo, con el detalle completo de cada atención, turno y cirugía de ese período.</p>
    <p>Resumen de lo archivado:</p>
    <ul style="padding-left: 20px; line-height: 1.7;">
      <li>&#127973; Policlínico: ${pacientesArchivar.length} atención(es)</li>
      <li>&#128336; Turnos: ${turnosArchivar.length} registro(s)</li>
      <li>&#128298; Cirugías: ${cirugiasArchivar.length} registro(s)</li>
    </ul>
    <p>Te recomendamos guardar este correo o el PDF adjunto como respaldo de tus ingresos de ese período.</p>
    <p>Quedamos a tu disposición para resolver cualquier consulta.</p>
    <p>Atentamente,<br>El equipo de ClinicaFlow</p>
    <div style="text-align: center; margin-top: 20px;">
      <img src="${LOGO_URL}" alt="ClinicaFlow" style="max-width: 150px;">
    </div>
  </div>`;
}

function construirPdfArchivo(email, desde, hasta, { pacientesArchivar, turnosArchivar, cirugiasArchivar }) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 20;

  pdf.setFontSize(15);
  pdf.setTextColor(59, 130, 246);
  pdf.text('ClinicaFlow - Respaldo de Registros Archivados', 14, y);
  y += 7;
  pdf.setDrawColor(59, 130, 246);
  pdf.setLineWidth(0.3);
  pdf.line(14, y, 196, y);
  y += 8;

  pdf.setFontSize(10);
  pdf.setTextColor(30, 41, 59);
  pdf.text(`Usuario: ${email}`, 14, y); y += 6;
  pdf.text(`Período archivado: ${desde} al ${hasta}`, 14, y); y += 6;
  pdf.text(`Generado: ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL')}`, 14, y);
  y += 10;

  const nuevaPagina = () => { pdf.addPage(); y = 20; };

  // Dibuja una tabla generica y devuelve el subtotal de esa seccion.
  const dibujarTabla = (titulo, columnas, filas, extractor, montoDeFila) => {
    if (filas.length === 0) return 0;
    if (y > 255) nuevaPagina();

    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text(titulo, 14, y);
    y += 7;

    const dibujarCabecera = () => {
      pdf.setFillColor(59, 130, 246);
      pdf.rect(14, y, 182, 7, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.setFont(undefined, 'normal');
      columnas.forEach((c) => pdf.text(c.label, c.x, y + 5));
      y += 10;
      pdf.setTextColor(0, 0, 0);
    };
    dibujarCabecera();

    let total = 0;
    filas.forEach((f) => {
      if (y > 275) { nuevaPagina(); dibujarCabecera(); }
      total += montoDeFila(f) || 0;
      const fila = extractor(f);
      pdf.setFontSize(8);
      columnas.forEach((c) => pdf.text(String(fila[c.key] ?? ''), c.x, y));
      y += 6;
    });

    y += 4;
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(22, 163, 74);
    pdf.text(`Subtotal ${titulo}: $${total.toLocaleString('es-CL')}`, 14, y);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(0, 0, 0);
    y += 12;
    return total;
  };

  let granTotal = 0;

  granTotal += dibujarTabla(
    'Policlínico',
    [
      { key: 'fecha', label: 'Fecha', x: 16 },
      { key: 'nombre', label: 'Paciente', x: 42 },
      { key: 'rut', label: 'RUT', x: 100 },
      { key: 'centro', label: 'Centro', x: 130 },
      { key: 'monto', label: 'Monto', x: 175 }
    ],
    pacientesArchivar,
    (p) => ({
      fecha: p.fecha,
      nombre: (p.nombre || '').substring(0, 26),
      rut: p.rut || '',
      centro: (p.institucion || '').substring(0, 16),
      monto: `$${Number(p.monto || 0).toLocaleString('es-CL')}`
    }),
    (p) => Number(p.monto) || 0
  );

  granTotal += dibujarTabla(
    'Turnos y Horas Extra',
    [
      { key: 'fecha', label: 'Fecha', x: 16 },
      { key: 'centro', label: 'Centro', x: 42 },
      { key: 'tipo', label: 'Tipo', x: 90 },
      { key: 'horas', label: 'Horas', x: 150 },
      { key: 'total', label: 'Total', x: 170 }
    ],
    turnosArchivar,
    (t) => ({
      fecha: t.fecha,
      centro: (t.centro || '').substring(0, 22),
      tipo: (t.tipo || 'Sin tipo registrado').substring(0, 26),
      horas: t.horas,
      total: `$${Number(t.total || 0).toLocaleString('es-CL')}`
    }),
    (t) => Number(t.total) || 0
  );

  granTotal += dibujarTabla(
    'Cirugías',
    [
      { key: 'fecha', label: 'Fecha', x: 16 },
      { key: 'centro', label: 'Centro', x: 42 },
      { key: 'tipo', label: 'Tipo', x: 90 },
      { key: 'paciente', label: 'Paciente', x: 140 },
      { key: 'monto', label: 'Monto', x: 175 }
    ],
    cirugiasArchivar,
    (c) => ({
      fecha: c.fecha,
      centro: (c.centro || '').substring(0, 22),
      tipo: (c.tipo || 'Sin tipo registrado').substring(0, 22),
      paciente: (c.paciente || '').substring(0, 16),
      monto: `$${Number(c.monto || 0).toLocaleString('es-CL')}`
    }),
    (c) => Number(c.monto) || 0
  );

  if (y > 265) nuevaPagina();
  y += 4;
  pdf.setDrawColor(148, 163, 184);
  pdf.line(14, y, 196, y);
  y += 8;
  pdf.setFontSize(12);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(22, 163, 74);
  pdf.text(`TOTAL GENERAL ARCHIVADO: $${granTotal.toLocaleString('es-CL')}`, 14, y);

  pdf.setFontSize(7);
  pdf.setFont(undefined, 'normal');
  pdf.setTextColor(148, 163, 184);
  pdf.text('ClinicaFlow - Control de Ingresos para Profesionales de la Salud', 14, 290);

  const pdfBase64 = pdf.output('datauristring').split(',')[1];
  const pdfName = `Respaldo_${email}_${desde}_a_${hasta}.pdf`;
  return { pdfBase64, pdfName };
}

function construirExcelArchivo(email, desde, hasta, { pacientesArchivar, turnosArchivar, cirugiasArchivar }) {
  const wb = XLSX.utils.book_new();

  const hojaPacientes = [['Fecha', 'Paciente', 'RUT', 'Centro', 'Previsión', 'Monto']];
  pacientesArchivar.forEach((p) =>
    hojaPacientes.push([p.fecha, p.nombre, p.rut, p.institucion, p.prevision || 'Sin previsión registrada', Number(p.monto) || 0])
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hojaPacientes), 'Policlinico');

  const hojaTurnos = [['Fecha', 'Centro', 'Tipo', 'Valor por hora', 'Horas', 'Total']];
  turnosArchivar.forEach((t) =>
    hojaTurnos.push([t.fecha, t.centro, t.tipo || 'Sin tipo registrado', Number(t.valorHora) || 0, Number(t.horas) || 0, Number(t.total) || 0])
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hojaTurnos), 'Turnos');

  const hojaCirugias = [['Fecha', 'Centro', 'Tipo', 'Paciente', 'RUT', 'Monto']];
  cirugiasArchivar.forEach((c) =>
    hojaCirugias.push([c.fecha, c.centro, c.tipo || 'Sin tipo registrado', c.paciente, c.rut, Number(c.monto) || 0])
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hojaCirugias), 'Cirugias');

  const excelBase64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const excelName = `Respaldo_${email}_${desde}_a_${hasta}.xlsx`;
  return { excelBase64, excelName };
}

function construirJsonArchivo(email, desde, hasta, { pacientesArchivar, turnosArchivar, cirugiasArchivar }) {
  const jsonString = JSON.stringify(
    {
      email,
      desde,
      hasta,
      generadoEl: new Date().toISOString(),
      pacientes: pacientesArchivar,
      turnos: turnosArchivar,
      cirugias: cirugiasArchivar
    },
    null,
    2
  );
  const jsonName = `Respaldo_${email}_${desde}_a_${hasta}.json`;
  return { jsonString, jsonName };
}

async function archivarUsuario(uid, email) {
  const desde = prompt('Archivar registros DESDE (formato AAAA-MM-DD):');
  if (!desde) return;
  const hasta = prompt('Archivar registros HASTA (formato AAAA-MM-DD):');
  if (!hasta) return;

  const fechaValida = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f);
  if (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta) {
    alert('Fechas inválidas. Usa el formato AAAA-MM-DD y verifica que "desde" sea anterior o igual a "hasta".');
    return;
  }

  const snap = await getDoc(doc(firestoreDb, 'usuarios', uid));
  if (!snap.exists()) {
    alert('No se encontró el usuario.');
    return;
  }
  const data = snap.data();
  const pacientes = data.pacientes || [];
  const turnos = data.turnos || [];
  const cirugias = data.cirugias || [];
  const centros = data.centros || [];

  const enRango = (f) => f && f >= desde && f <= hasta;
  const pacientesArchivar = pacientes.filter((p) => enRango(p.fecha));
  const pacientesMantener = pacientes.filter((p) => !enRango(p.fecha));
  const turnosArchivar = turnos.filter((t) => enRango(t.fecha));
  const turnosMantener = turnos.filter((t) => !enRango(t.fecha));
  const cirugiasArchivar = cirugias.filter((c) => enRango(c.fecha));
  const cirugiasMantener = cirugias.filter((c) => !enRango(c.fecha));

  const totalArchivar = pacientesArchivar.length + turnosArchivar.length + cirugiasArchivar.length;
  if (totalArchivar === 0) {
    alert('No hay registros de este usuario en ese rango de fechas.');
    return;
  }

  const confirmar = confirm(
    `Se archivarán ${totalArchivar} registro(s) de ${email} ` +
    `(${pacientesArchivar.length} Policlínico, ${turnosArchivar.length} Turnos, ${cirugiasArchivar.length} Cirugías) ` +
    `entre ${desde} y ${hasta}.\n\n` +
    'Se generará un respaldo (PDF/Excel/JSON), se enviará por correo al usuario, se guardará en el Drive de ClinicaFlow, ' +
    'y luego esos registros se eliminarán de la app activa del usuario.\n\n' +
    'Esta acción no se puede deshacer desde la app. ¿Continuar?'
  );
  if (!confirmar) return;

  const datosArchivo = { pacientesArchivar, turnosArchivar, cirugiasArchivar };

  try {
    const { pdfBase64, pdfName } = construirPdfArchivo(email, desde, hasta, datosArchivo);
    const { excelBase64, excelName } = construirExcelArchivo(email, desde, hasta, datosArchivo);
    const { jsonString, jsonName } = construirJsonArchivo(email, desde, hasta, datosArchivo);

    await llamarAppsScript({
      to: email,
      subject: `Respaldo de registros archivados (${desde} a ${hasta}) - ClinicaFlow`,
      htmlBody: construirCuerpoCorreoArchivo(email, desde, hasta, datosArchivo),
      attachmentBase64: pdfBase64,
      attachmentName: pdfName,
      attachmentMimeType: 'application/pdf',
      drive: { carpeta: email, pdfBase64, pdfName, excelBase64, excelName, jsonString, jsonName }
    });

    await guardarDatosUsuario(uid, {
      pacientes: pacientesMantener,
      centros,
      turnos: turnosMantener,
      cirugias: cirugiasMantener
    });

    alert(`Listo: se archivaron ${totalArchivar} registro(s) de ${email}. Respaldo enviado por correo y guardado en Drive.`);
  } catch (error) {
    alert('Error al archivar: ' + error.message);
  }
}

let usuariosCache = [];
let detenerEscuchaUsuarios = null;

function mostrarPantalla(id) {
  document.getElementById('loginScreen').style.display = id === 'loginScreen' ? 'flex' : 'none';
  document.getElementById('panelAdmin').style.display = id === 'panelAdmin' ? 'block' : 'none';
  document.getElementById('noAutorizado').style.display = id === 'noAutorizado' ? 'block' : 'none';
}

async function adminLogin() {
  const email = document.getElementById('adminEmail').value;
  const password = document.getElementById('adminPassword').value;
  if (!email || !password) {
    alert('Ingresa correo y contraseña');
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert('Error al iniciar sesión: ' + error.message);
  }
}

async function adminLogout() {
  if (detenerEscuchaUsuarios) {
    detenerEscuchaUsuarios();
    detenerEscuchaUsuarios = null;
  }
  await signOut(auth);
}

function calcularFechaVencimiento(tipo) {
  const fecha = new Date();
  if (tipo === 'mensual') fecha.setMonth(fecha.getMonth() + 1);
  else if (tipo === 'prueba') fecha.setDate(fecha.getDate() + 7);
  else fecha.setFullYear(fecha.getFullYear() + 1);
  return fecha.toISOString().slice(0, 10);
}

function formatearFechaVencimiento(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fechaVencida(iso) {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

function diasParaVencer(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24));
}

// Deriva el estado real del plan (el campo "plan" en la BD puede seguir
// diciendo "pro" aunque ya haya vencido, hasta que el propio usuario
// vuelva a iniciar sesion y la app lo corrija sola).
function estadoUsuario(u) {
  const vencido = u.plan === 'pro' && fechaVencida(u.planVenceEl);
  const esPro = u.plan === 'pro' && !vencido;
  const dias = esPro ? diasParaVencer(u.planVenceEl) : null;
  const porVencerPronto = esPro && dias !== null && dias <= 7;
  return { vencido, esPro, porVencerPronto };
}

// Filtro de segmento activo (se combina con el texto del buscador).
// Las tarjetas de resumen tambien funcionan como botones de filtro:
// un clic activa ese segmento, un segundo clic sobre la misma lo quita.
let filtroActivo = 'todos';

function pasaSegmento(u, filtro) {
  if (filtro === 'todos') return true;
  const { esPro, vencido, porVencerPronto } = estadoUsuario(u);
  if (filtro === 'pro') return esPro;
  if (filtro === 'gratis') return !esPro && !vencido;
  if (filtro === 'vencido') return vencido;
  if (filtro === 'porVencer') return porVencerPronto;
  return true;
}

function renderStats(usuarios) {
  const grid = document.getElementById('adminStatsGrid');
  if (!grid) return;
  const total = usuarios.length;
  const pro = usuarios.filter((u) => estadoUsuario(u).esPro).length;
  const vencido = usuarios.filter((u) => estadoUsuario(u).vencido).length;
  const porVencer = usuarios.filter((u) => estadoUsuario(u).porVencerPronto).length;
  const gratis = total - pro - vencido;

  const tarjetas = [
    { filtro: 'todos', clase: '', num: total, label: '👥 Usuarios totales' },
    { filtro: 'pro', clase: 'stat-pro', num: pro, label: '⭐ Plan Pro activo' },
    { filtro: 'gratis', clase: 'stat-gratis', num: gratis, label: '🆓 Plan Gratis' },
    { filtro: 'vencido', clase: 'stat-vencido', num: vencido, label: '⚠️ Vencidos' },
    { filtro: 'porVencer', clase: 'stat-vencer', num: porVencer, label: '⏳ Por vencer (≤7 días)' }
  ];

  grid.innerHTML = tarjetas
    .map(
      (t) => `<div class="admin-stat-card ${t.clase} ${filtroActivo === t.filtro ? 'stat-active' : ''}" data-filtro="${t.filtro}">
      <div class="stat-num">${t.num}</div>
      <div class="stat-label">${t.label}</div>
    </div>`
    )
    .join('');

  grid.querySelectorAll('.admin-stat-card').forEach((card) => {
    card.addEventListener('click', () => {
      const filtro = card.dataset.filtro;
      filtroActivo = filtroActivo === filtro ? 'todos' : filtro;
      renderStats(usuariosCache);
      aplicarFiltro();
    });
  });
}

function renderUsuarios(usuarios) {
  const contenedor = document.getElementById('listaUsuarios');
  const contador = document.getElementById('adminContadorResultados');
  if (contador) contador.innerText = `${usuarios.length} usuario${usuarios.length === 1 ? '' : 's'}`;

  if (usuarios.length === 0) {
    contenedor.innerHTML = '<div class="admin-empty">😕 No se encontraron usuarios.</div>';
    return;
  }

  let html = '<div class="admin-users-grid">';
  usuarios.forEach((u) => {
    const { vencido, esPro } = estadoUsuario(u);
    let badgeClass = 'plan-gratis';
    let etiquetaPlan = '🆓 Gratis';
    if (esPro) {
      badgeClass = 'plan-pro';
      etiquetaPlan = u.planVenceEl ? `⭐ Pro · vence ${formatearFechaVencimiento(u.planVenceEl)}` : '⭐ Pro · sin vencimiento';
    } else if (vencido) {
      badgeClass = 'plan-vencido';
      etiquetaPlan = `⛔ Vencido (${formatearFechaVencimiento(u.planVenceEl)})`;
    }

    html += `<div class="admin-user-card">
      <div class="admin-user-top">
        <span class="admin-user-email">${u.email}</span>
        <span class="admin-plan-badge ${badgeClass}">${etiquetaPlan}</span>
      </div>
      <div class="admin-user-meta">
        <span>📋 ${u.totalRegistros} registro${u.totalRegistros === 1 ? '' : 's'}</span>
        <span>🏥 ${u.totalCentros} centro${u.totalCentros === 1 ? '' : 's'}</span>
      </div>
      <div class="admin-user-actions">
        ${esPro ? `<button class="btn-secondary btn-quitar-plan" data-uid="${u.uid}">Quitar Pro</button>` : ''}
        <button class="btn-primary btn-activar-plan" data-uid="${u.uid}">${esPro ? 'Renovar' : 'Activar Pro'}</button>
        ${!esPro ? `<button class="admin-btn-prueba btn-prueba-plan" data-uid="${u.uid}">🎁 Prueba 7 días</button>` : ''}
        ${!esPro ? `<button class="btn-secondary btn-enviar-correo" data-uid="${u.uid}" data-email="${u.email}">✉️ Enviar bienvenida</button>` : ''}
        <button class="btn-secondary btn-archivar" data-uid="${u.uid}" data-email="${u.email}">📦 Archivar registros</button>
      </div>
    </div>`;
  });
  html += '</div>';
  contenedor.innerHTML = html;

  contenedor.querySelectorAll('.btn-activar-plan').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tipo = prompt(
        '¿Qué tipo de Pro le activo?\nEscribe "m" = Mensual, "a" = Anual, "v" = Vitalicia (regalo, sin vencimiento):'
      );
      if (tipo === null) return;
      const opcion = tipo.trim().toLowerCase().charAt(0);
      if (!['m', 'a', 'v'].includes(opcion)) {
        alert('No entendí la opción. Escribe "m", "a" o "v".');
        return;
      }
      const planVenceEl = opcion === 'v' ? null : calcularFechaVencimiento(opcion === 'a' ? 'anual' : 'mensual');
      btn.disabled = true;
      btn.innerText = 'Guardando...';
      try {
        // No hace falta recargar a mano: el listener en tiempo real
        // (escucharTodosLosUsuarios) va a refrescar la lista solo apenas
        // Firestore confirme el cambio, en este dispositivo y en cualquier
        // otro donde el admin tenga el panel abierto.
        await cambiarPlanUsuario(btn.dataset.uid, 'pro', planVenceEl);
      } catch (error) {
        alert('Error al activar el plan: ' + error.message);
        btn.disabled = false;
      }
    });
  });

  contenedor.querySelectorAll('.btn-quitar-plan').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.innerText = 'Guardando...';
      try {
        await cambiarPlanUsuario(btn.dataset.uid, 'gratis', null);
      } catch (error) {
        alert('Error al quitar el plan: ' + error.message);
        btn.disabled = false;
      }
    });
  });

  contenedor.querySelectorAll('.btn-prueba-plan').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.innerText = 'Guardando...';
      try {
        await cambiarPlanUsuario(btn.dataset.uid, 'pro', calcularFechaVencimiento('prueba'));
      } catch (error) {
        alert('Error al activar la prueba: ' + error.message);
        btn.disabled = false;
      }
    });
  });

  contenedor.querySelectorAll('.btn-enviar-correo').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const textoOriginal = btn.innerText;
      btn.disabled = true;
      btn.innerText = 'Enviando...';
      try {
        await enviarCorreoBienvenida(btn.dataset.email);
        btn.innerText = '✅ Enviado';
      } catch (error) {
        alert('Error al enviar el correo: ' + error.message);
        btn.disabled = false;
        btn.innerText = textoOriginal;
      }
    });
  });

  contenedor.querySelectorAll('.btn-archivar').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const textoOriginal = btn.innerText;
      btn.disabled = true;
      btn.innerText = 'Archivando...';
      try {
        await archivarUsuario(btn.dataset.uid, btn.dataset.email);
      } finally {
        btn.disabled = false;
        btn.innerText = textoOriginal;
      }
    });
  });
}

function aplicarFiltro() {
  const termino = (document.getElementById('adminBuscador')?.value || '').trim().toLowerCase();
  const filtrados = usuariosCache.filter((u) => {
    const pasaTexto = !termino || u.email.toLowerCase().includes(termino);
    return pasaTexto && pasaSegmento(u, filtroActivo);
  });
  renderUsuarios(filtrados);
}

function iniciarEscuchaUsuarios() {
  const contenedor = document.getElementById('listaUsuarios');
  contenedor.innerHTML = 'Cargando...';
  // Escucha en tiempo real: si se activa/quita un plan desde otro
  // dispositivo (o desde este mismo en otra pestaña), la lista y las
  // tarjetas de resumen se actualizan solas, igual que sincroniza la app.
  detenerEscuchaUsuarios = escucharTodosLosUsuarios((usuarios) => {
    usuariosCache = usuarios;
    renderStats(usuariosCache);
    aplicarFiltro();
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    if (detenerEscuchaUsuarios) {
      detenerEscuchaUsuarios();
      detenerEscuchaUsuarios = null;
    }
    mostrarPantalla('loginScreen');
    return;
  }
  if (user.uid !== ADMIN_UID) {
    mostrarPantalla('noAutorizado');
    return;
  }
  mostrarPantalla('panelAdmin');
  iniciarEscuchaUsuarios();
});

document.getElementById('adminBuscador')?.addEventListener('input', aplicarFiltro);

Object.assign(window, { adminLogin, adminLogout });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('Error al registrar el service worker:', error);
    });
  });
}

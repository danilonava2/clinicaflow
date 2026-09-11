import { auth } from './firebase/config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { escucharTodosLosUsuarios, cambiarPlanUsuario } from './firebase/firestoreDataService.js';

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

async function enviarCorreoBienvenida(email) {
  const { subject, htmlBody } = construirCorreoBienvenida(email);
  const respuesta = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ secret: EMAIL_SECRET, to: email, subject, htmlBody })
  });
  const resultado = await respuesta.json();
  if (!resultado.ok) throw new Error(resultado.error || 'Error desconocido');
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

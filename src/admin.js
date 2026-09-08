import { auth } from './firebase/config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { escucharTodosLosUsuarios, cambiarPlanUsuario } from './firebase/firestoreDataService.js';

// Solo esta cuenta puede ver y usar este panel (ademas de estar reforzado
// en firestore.rules, que es lo que realmente protege los datos).
const ADMIN_UID = 'VJEehVVQdpVgQqd5g6X6r9xxnyr2';

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

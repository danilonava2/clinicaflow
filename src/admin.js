import { auth } from './firebase/config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { listarTodosLosUsuarios, cambiarPlanUsuario } from './firebase/firestoreDataService.js';

// Solo esta cuenta puede ver y usar este panel (ademas de estar reforzado
// en firestore.rules, que es lo que realmente protege los datos).
const ADMIN_UID = 'VJEehVVQdpVgQqd5g6X6r9xxnyr2';

let usuariosCache = [];

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

function renderStats(usuarios) {
  const grid = document.getElementById('adminStatsGrid');
  if (!grid) return;
  const total = usuarios.length;
  const pro = usuarios.filter((u) => estadoUsuario(u).esPro).length;
  const porVencer = usuarios.filter((u) => estadoUsuario(u).porVencerPronto).length;
  const gratis = total - pro;

  grid.innerHTML = `
    <div class="admin-stat-card">
      <div class="stat-num">${total}</div>
      <div class="stat-label">👥 Usuarios totales</div>
    </div>
    <div class="admin-stat-card stat-pro">
      <div class="stat-num">${pro}</div>
      <div class="stat-label">⭐ Plan Pro activo</div>
    </div>
    <div class="admin-stat-card stat-gratis">
      <div class="stat-num">${gratis}</div>
      <div class="stat-label">🆓 Plan Gratis</div>
    </div>
    <div class="admin-stat-card stat-vencer">
      <div class="stat-num">${porVencer}</div>
      <div class="stat-label">⏳ Por vencer (≤7 días)</div>
    </div>
  `;
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
      etiquetaPlan = `⚠️ Vencido (${formatearFechaVencimiento(u.planVenceEl)})`;
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
        await cambiarPlanUsuario(btn.dataset.uid, 'pro', planVenceEl);
        await cargarUsuarios();
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
        await cargarUsuarios();
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
        await cargarUsuarios();
      } catch (error) {
        alert('Error al activar la prueba: ' + error.message);
        btn.disabled = false;
      }
    });
  });
}

function aplicarFiltro() {
  const termino = (document.getElementById('adminBuscador')?.value || '').trim().toLowerCase();
  const filtrados = termino ? usuariosCache.filter((u) => u.email.toLowerCase().includes(termino)) : usuariosCache;
  renderUsuarios(filtrados);
}

async function cargarUsuarios() {
  const contenedor = document.getElementById('listaUsuarios');
  contenedor.innerHTML = 'Cargando...';
  try {
    usuariosCache = await listarTodosLosUsuarios();
    renderStats(usuariosCache);
    aplicarFiltro();
  } catch (error) {
    contenedor.innerHTML = `<p>Error al cargar usuarios: ${error.message}</p>`;
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    mostrarPantalla('loginScreen');
    return;
  }
  if (user.uid !== ADMIN_UID) {
    mostrarPantalla('noAutorizado');
    return;
  }
  mostrarPantalla('panelAdmin');
  cargarUsuarios();
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

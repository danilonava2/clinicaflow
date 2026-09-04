import './firebase/config.js';
import { state, iniciarSincronizacion, detenerSincronizacion, resetState } from './store.js';
import * as authService from './firebase/authService.js';
import { formatearRutInput } from './utils/rut.js';
import { iniciarControlInactividad, detenerControlInactividad } from './utils/inactivityTimer.js';
import { setupNavigation, initMobileMenu, seleccionarSeccion, toggleConfigMenu } from './ui/navigation.js';
import { confirmarAccion, cerrarAviso, mostrarAviso } from './ui/notificaciones.js';
import {
  renderListaCentros,
  actualizarSelectCentros,
  actualizarSelectPrevisionDashboard,
  migrarCentrosDesdePacientes,
  agregarCentro,
  editarCentro,
  eliminarCentro,
  cerrarRenombrarCentroModal,
  confirmarRenombrarCentro,
  cerrarEliminarCentroModal,
  alCambiarOpcionEliminarCentro,
  confirmarEliminarCentro,
  agregarPrevision,
  editarPrevision,
  eliminarPrevision,
  cerrarEditarPrevisionModal,
  confirmarEditarPrevision
} from './modules/centros.js';
import {
  actualizarContador,
  registrarAtencion,
  buscarPacientes,
  limpiarFiltrosBusqueda,
  editarRegistro,
  guardarEdicion,
  eliminarRegistro,
  registrarDuplicadoConfirmado,
  actualizarPrevisionesDisponibles,
  autocompletarMontoPorPrevision
} from './modules/pacientes.js';
import { cargarDashboard } from './modules/dashboard.js';
import {
  generarReporte,
  descargarReportePDF,
  descargarExcel,
  abrirDescuentosModal,
  cerrarDescuentosModal,
  calcularDescuentos
} from './modules/reportes.js';
import { exportarBackup, importarBackup, limpiarTodo } from './modules/backup.js';
import { cerrarEditModal, cerrarModalDuplicado } from './ui/modals.js';

function mostrarPantallaApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';
}

function mostrarPantallaLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
}

function actualizarInfoUsuario(email) {
  document.getElementById('userEmailDisplay').innerText = email;
  const mobileUserInfo = document.getElementById('mobileUserInfo');
  if (mobileUserInfo) mobileUserInfo.innerHTML = email;
}

function mostrarPantallaInicial() {
  setupNavigation();
  initMobileMenu();

  const fechaInput = document.getElementById('fecha');
  if (fechaInput) fechaInput.valueAsDate = new Date();

  document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
  document.getElementById('section-welcome')?.classList.add('active');

  iniciarControlInactividad(() => {
    mostrarAviso('Tu sesión se cerró automáticamente por inactividad.', 'advertencia');
    logout();
  });
}

async function onSesionIniciada(user) {
  state.currentUser = user;
  mostrarPantallaApp();
  actualizarInfoUsuario(user.email);

  // Flag local a esta sesion de login: evita inicializar la pantalla dos
  // veces si el primer dato tarda mas de 10s en llegar (el timeout de abajo
  // ya habria mostrado la pantalla, y el listener sigue vivo de fondo).
  let pantallaInicialMostrada = false;

  const alSincronizarDatos = (esPrimeraVez) => {
    renderListaCentros();
    actualizarSelectCentros();
    actualizarSelectPrevisionDashboard();
    migrarCentrosDesdePacientes();
    actualizarContador();

    if (esPrimeraVez) {
      if (!pantallaInicialMostrada) {
        pantallaInicialMostrada = true;
        mostrarPantallaInicial();
      }
      return;
    }

    // Actualizaciones que llegan de otro dispositivo (o de esta misma
    // sesion): refresca solo la seccion que se esta viendo, para no
    // interrumpir al usuario en otras pantallas.
    if (document.getElementById('section-dashboard')?.classList.contains('active')) cargarDashboard();
    if (document.getElementById('section-buscar')?.classList.contains('active')) buscarPacientes();
  };

  try {
    await Promise.race([
      iniciarSincronizacion(user.uid, alSincronizarDatos),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado')), 10000))
    ]);
  } catch (error) {
    console.error('Error al cargar datos del usuario:', error);
    mostrarAviso('No se pudieron cargar tus datos (revisa tu conexión). La app seguirá funcionando, pero intenta recargar la página.', 'advertencia');
    if (!pantallaInicialMostrada) {
      pantallaInicialMostrada = true;
      mostrarPantallaInicial();
    }
  }
}

async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) {
    mostrarAviso('Ingresa email y contraseña', 'advertencia');
    return;
  }
  try {
    await authService.login(email, password);
  } catch (error) {
    mostrarAviso('Error al iniciar sesión: ' + error.message, 'error');
  }
}

async function register() {
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('registerConfirmPassword').value;

  if (!email || !password) {
    mostrarAviso('Completa todos los campos', 'advertencia');
    return;
  }
  if (password !== confirmPassword) {
    mostrarAviso('Las contraseñas no coinciden', 'advertencia');
    return;
  }
  if (password.length < 6) {
    mostrarAviso('La contraseña debe tener al menos 6 caracteres', 'advertencia');
    return;
  }

  try {
    await authService.register(email, password);
  } catch (error) {
    mostrarAviso('Error al registrarse: ' + error.message, 'error');
  }
}

async function logout() {
  detenerControlInactividad();
  detenerSincronizacion();
  await authService.logout();
  mostrarPantallaLogin();
  resetState();
}

function mostrarLogin() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
}

function mostrarRegistro() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
}

async function resetPassword() {
  const email = document.getElementById('loginEmail').value;
  if (!email) {
    mostrarAviso('Ingresa tu correo electrónico para restablecer la contraseña', 'advertencia');
    return;
  }
  try {
    await authService.resetPassword(email);
    mostrarAviso('Se ha enviado un enlace de restablecimiento a tu correo electrónico.', 'exito');
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      mostrarAviso('No existe una cuenta con ese correo electrónico', 'error');
    } else {
      mostrarAviso('Error al enviar el correo: ' + error.message, 'error');
    }
  }
}

function initializeApp() {
  authService.watchAuthState(
    (user) => onSesionIniciada(user),
    () => mostrarPantallaLogin()
  );
}

// Funciones referenciadas desde atributos onclick/onchange en index.html.
Object.assign(window, {
  login,
  register,
  logout,
  mostrarLogin,
  mostrarRegistro,
  resetPassword,
  toggleConfigMenu,
  seleccionarSeccion,
  buscarPacientes,
  limpiarFiltrosBusqueda,
  cargarDashboard,
  generarReporte,
  descargarReportePDF,
  descargarExcel,
  abrirDescuentosModal,
  cerrarDescuentosModal,
  calcularDescuentos,
  exportarBackup,
  importarBackup,
  limpiarTodo,
  agregarCentro,
  editarCentro,
  eliminarCentro,
  cerrarRenombrarCentroModal,
  confirmarRenombrarCentro,
  cerrarEliminarCentroModal,
  alCambiarOpcionEliminarCentro,
  confirmarEliminarCentro,
  agregarPrevision,
  editarPrevision,
  eliminarPrevision,
  cerrarEditarPrevisionModal,
  confirmarEditarPrevision,
  editarRegistro,
  eliminarRegistro,
  guardarEdicion,
  registrarDuplicadoConfirmado,
  cerrarEditModal,
  cerrarModalDuplicado,
  confirmarAccion,
  cerrarAviso
});

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  document.getElementById('formPaciente')?.addEventListener('submit', registrarAtencion);
  document.getElementById('rut')?.addEventListener('input', (e) => formatearRutInput(e.target));
  document.getElementById('busquedaRut')?.addEventListener('input', (e) => formatearRutInput(e.target));

  document.getElementById('selectInstitucion')?.addEventListener('change', () =>
    actualizarPrevisionesDisponibles('selectInstitucion', 'selectPrevision')
  );
  document.getElementById('selectPrevision')?.addEventListener('change', () =>
    autocompletarMontoPorPrevision('selectInstitucion', 'selectPrevision', 'monto')
  );
  document.getElementById('editSelectInstitucion')?.addEventListener('change', () =>
    actualizarPrevisionesDisponibles('editSelectInstitucion', 'editSelectPrevision')
  );
  document.getElementById('editSelectPrevision')?.addEventListener('change', () =>
    autocompletarMontoPorPrevision('editSelectInstitucion', 'editSelectPrevision', 'editMonto')
  );
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('Error al registrar el service worker:', error);
    });
  });
}

import './firebase/config.js';
import { state, cargarDatosDelUsuario, resetState } from './store.js';
import * as authService from './firebase/authService.js';
import { formatearRutInput } from './utils/rut.js';
import { setupNavigation, initMobileMenu, seleccionarSeccion, toggleConfigMenu } from './ui/navigation.js';
import { confirmAction } from './ui/modals.js';
import {
  renderListaCentros,
  actualizarSelectCentros,
  actualizarSelectPrevisionDashboard,
  migrarCentrosDesdePacientes,
  agregarCentro,
  editarCentro,
  eliminarCentro,
  agregarPrevision,
  editarPrevision,
  eliminarPrevision
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
import { generarReporte, descargarReportePDF, descargarExcel } from './modules/reportes.js';
import { exportarBackup, importarBackup, limpiarTodo } from './modules/backup.js';
import { cerrarModal, cerrarEditModal, cerrarModalDuplicado } from './ui/modals.js';

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

async function onSesionIniciada(user) {
  state.currentUser = user;
  mostrarPantallaApp();
  actualizarInfoUsuario(user.email);

  try {
    await Promise.race([
      cargarDatosDelUsuario(user.uid),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado')), 10000))
    ]);
  } catch (error) {
    console.error('Error al cargar datos del usuario:', error);
    alert('⚠️ No se pudieron cargar tus datos (revisa tu conexión). La app seguirá funcionando, pero intenta recargar la página.');
  }

  renderListaCentros();
  actualizarSelectCentros();
  actualizarSelectPrevisionDashboard();
  migrarCentrosDesdePacientes();
  actualizarContador();
  setupNavigation();
  initMobileMenu();

  const fechaInput = document.getElementById('fecha');
  if (fechaInput) fechaInput.valueAsDate = new Date();

  document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
  document.getElementById('section-welcome')?.classList.add('active');
}

async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) {
    alert('Ingresa email y contraseña');
    return;
  }
  try {
    await authService.login(email, password);
  } catch (error) {
    alert('Error al iniciar sesión: ' + error.message);
  }
}

async function register() {
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('registerConfirmPassword').value;

  if (!email || !password) {
    alert('Completa todos los campos');
    return;
  }
  if (password !== confirmPassword) {
    alert('Las contraseñas no coinciden');
    return;
  }
  if (password.length < 6) {
    alert('La contraseña debe tener al menos 6 caracteres');
    return;
  }

  try {
    await authService.register(email, password);
  } catch (error) {
    alert('Error al registrarse: ' + error.message);
  }
}

async function logout() {
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
    alert('Ingresa tu correo electrónico para restablecer la contraseña');
    return;
  }
  try {
    await authService.resetPassword(email);
    alert('✅ Se ha enviado un enlace de restablecimiento a tu correo electrónico.');
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      alert('❌ No existe una cuenta con ese correo electrónico');
    } else {
      alert('❌ Error al enviar el correo: ' + error.message);
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
  exportarBackup,
  importarBackup,
  limpiarTodo,
  agregarCentro,
  editarCentro,
  eliminarCentro,
  agregarPrevision,
  editarPrevision,
  eliminarPrevision,
  editarRegistro,
  eliminarRegistro,
  guardarEdicion,
  registrarDuplicadoConfirmado,
  cerrarModal,
  cerrarEditModal,
  cerrarModalDuplicado,
  confirmAction
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

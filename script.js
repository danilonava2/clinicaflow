// ==================== FORMATO DE FECHA ====================
function formatearFecha(fechaISO) {
  if (!fechaISO) return '';
  const partes = fechaISO.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return fechaISO;
}



// ==================== CONFIGURACIÓN DE FIREBASE ====================
const firebaseConfig = {
  apiKey: "AIzaSyD2Vtk1Bzmrw1TtOw_3yMf3Z4yVFtDf9KM",
  authDomain: "clinicaflowapp-57a8a.firebaseapp.com",
  databaseURL: "https://clinicaflowapp-57a8a-default-rtdb.firebaseio.com",
  projectId: "clinicaflowapp-57a8a",
  storageBucket: "clinicaflowapp-57a8a.firebasestorage.app",
  messagingSenderId: "451352633928",
  appId: "1:451352633928:web:d4f989e418fef93c236e7d",
  measurementId: "G-3J2MSQX6QM"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// ==================== VARIABLES GLOBALES ====================
let currentUser = null;
let pacientes = [];
let currentReportRows = [];
let generalChart, ingresosCentroChart;
let currentPage = 1;
let pendingConfirmAction = null;
let pendingDuplicateData = null;
const ITEMS_PER_PAGE = 10;
let centros = [];

// ==================== SELECCIONAR SECCIÓN MANUALMENTE ====================
function seleccionarSeccion(section) {
  document.querySelectorAll('.menu-item').forEach(item => {
    if (item.getAttribute('data-section') === section) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  document.querySelectorAll('.mobile-menu-btn').forEach(btn => {
    if (btn.getAttribute('data-section') === section) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const targetSection = document.getElementById(`section-${section}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }
  
  if (section === 'dashboard') {
    cargarDashboard();
  }
}

// ==================== AUTENTICACIÓN ====================
async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  if (!email || !password) {
    alert('Ingresa email y contraseña');
    return;
  }
  
  try {
    await auth.signInWithEmailAndPassword(email, password);
    currentUser = auth.currentUser;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    document.getElementById('userEmailDisplay').innerText = email;
    
    const mobileUserInfo = document.getElementById('mobileUserInfo');
    if (mobileUserInfo) {
      mobileUserInfo.innerHTML = `${email}`;
    }
    
    await cargarDatosUsuario();
  } catch (error) {
    alert('Error al iniciar sesión: ' + error.message);
  }
}

async function register() {
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const confirm = document.getElementById('registerConfirmPassword').value;
  
  if (!email || !password) {
    alert('Completa todos los campos');
    return;
  }
  
  if (password !== confirm) {
    alert('Las contraseñas no coinciden');
    return;
  }
  
  if (password.length < 6) {
    alert('La contraseña debe tener al menos 6 caracteres');
    return;
  }
  
  try {
    await auth.createUserWithEmailAndPassword(email, password);
    currentUser = auth.currentUser;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    document.getElementById('userEmailDisplay').innerText = email;
    
    const mobileUserInfo = document.getElementById('mobileUserInfo');
    if (mobileUserInfo) {
      mobileUserInfo.innerHTML = `${email}`;
    }
    
    await cargarDatosUsuario();
  } catch (error) {
    alert('Error al registrarse: ' + error.message);
  }
}

async function logout() {
  await auth.signOut();
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
  pacientes = [];
  centros = ['Clínica A', 'Consultorio B', 'Hospital C'];
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
    await auth.sendPasswordResetEmail(email);
    alert('✅ Se ha enviado un enlace de restablecimiento a tu correo electrónico.');
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      alert('❌ No existe una cuenta con ese correo electrónico');
    } else {
      alert('❌ Error al enviar el correo: ' + error.message);
    }
  }
}

// ==================== SINCRONIZACIÓN CON FIREBASE ====================
async function guardarEnFirebase() {
  if (!currentUser) return;
  
  try {
    const userData = {
      pacientes: pacientes,
      centros: centros,
      ultimaActualizacion: Date.now()
    };
    await database.ref('usuarios/' + currentUser.uid).set(userData);
    console.log('✅ Datos guardados en Firebase');
  } catch (error) {
    console.error('Error al guardar en Firebase:', error);
  }
}

async function cargarDesdeFirebase() {
  if (!currentUser) return false;
  
  try {
    const snapshot = await database.ref('usuarios/' + currentUser.uid).once('value');
    const data = snapshot.val();
    
    if (data) {
      pacientes = data.pacientes || [];
      centros = data.centros || ['Clínica A', 'Consultorio B', 'Hospital C'];
      console.log('✅ Datos cargados desde Firebase');
      return true;
    }
  } catch (error) {
    console.error('Error al cargar desde Firebase:', error);
  }
  return false;
}

async function cargarDatosUsuario() {
  const cargado = await cargarDesdeFirebase();
  if (!cargado) {
    pacientes = [];
    centros = ['Clínica A', 'Consultorio B', 'Hospital C'];
  }
  
  renderListaCentros();
  actualizarSelectCentros();
  migrarCentrosDesdePacientes();
  actualizarContador();
  setupNavigation();
  initMobileMenu();
  document.getElementById('fecha').valueAsDate = new Date();
  
  // Mostrar bienvenida por defecto
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const welcomeSection = document.getElementById('section-welcome');
  if (welcomeSection) {
    welcomeSection.classList.add('active');
  }
  
  const mobileUserInfo = document.getElementById('mobileUserInfo');
  if (mobileUserInfo && currentUser) {
    mobileUserInfo.innerHTML = `${currentUser.email}`;
  }
  
  const mobileContador = document.getElementById('mobileContadorRegistros');
  if (mobileContador) {
    mobileContador.innerHTML = `${pacientes.length} registros`;
  }
}

function guardarDatos() {
  guardarEnFirebase();
}

function actualizarContador() {
  const count = pacientes.length;
  const contador = document.getElementById('contador-registros');
  if (contador) contador.innerHTML = `${count} registros`;
  
  const mobileContador = document.getElementById('mobileContadorRegistros');
  if (mobileContador) mobileContador.innerHTML = `${count} registros`;
}

// ==================== GESTIÓN DE CENTROS ====================
function guardarCentros() {
  guardarEnFirebase();
}

function renderListaCentros() {
  const container = document.getElementById('listaCentros');
  if (!container) return;
  if (centros.length === 0) {
    container.innerHTML = '<p>No hay centros agregados. Agrega los lugares donde atiendes.</p>';
    return;
  }
  let html = '<div class="centros-grid">';
  centros.forEach((centro, index) => {
    html += `<div class="centro-item">
      <span>🏥 ${escapeHtml(centro)}</span>
      <div>
        <button onclick="editarCentro(${index})" class="btn-edit" style="margin-right:5px;">✏️</button>
        <button onclick="eliminarCentro(${index})" class="btn-delete">🗑️</button>
      </div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

function editarCentro(index) {
  const centroActual = centros[index];
  const nuevoNombre = prompt(`Editar centro "${centroActual}"`, centroActual);
  if (!nuevoNombre || nuevoNombre === centroActual) return;
  if (centros.includes(nuevoNombre)) {
    alert('Ya existe un centro con ese nombre');
    return;
  }
  centros[index] = nuevoNombre;
  let registrosActualizados = 0;
  pacientes = pacientes.map(p => {
    if (p.institucion === centroActual) {
      registrosActualizados++;
      return { ...p, institucion: nuevoNombre };
    }
    return p;
  });
  guardarCentros();
  guardarPacientes();
  renderListaCentros();
  actualizarSelectCentros();
  alert(`Centro "${centroActual}" → "${nuevoNombre}"\nSe actualizaron ${registrosActualizados} registro(s)`);
  if (document.getElementById('section-dashboard').classList.contains('active')) cargarDashboard();
  if (document.getElementById('section-buscar').classList.contains('active')) buscarPacientes(currentPage);
}

function eliminarCentro(index) {
  const centro = centros[index];
  const cantidad = pacientes.filter(p => p.institucion === centro).length;
  let opcion = prompt(`Centro "${centro}" tiene ${cantidad} registro(s) asociado(s).\n1 - Mantener registros\n2 - Eliminar registros\n3 - Reasignar a otro centro\n\nEscribe 1, 2 o 3:`);
  if (opcion === '1') {
    centros.splice(index, 1);
    guardarCentros();
    renderListaCentros();
    actualizarSelectCentros();
    alert(`Centro "${centro}" eliminado. Los registros conservan el nombre.`);
  } else if (opcion === '2') {
    if (confirm(`¿Eliminar ${cantidad} registro(s)?`)) {
      pacientes = pacientes.filter(p => p.institucion !== centro);
      centros.splice(index, 1);
      guardarPacientes();
      guardarCentros();
      renderListaCentros();
      actualizarSelectCentros();
      actualizarContador();
      alert(`Se eliminaron ${cantidad} registro(s) y el centro.`);
      if (document.getElementById('section-dashboard').classList.contains('active')) cargarDashboard();
      if (document.getElementById('section-buscar').classList.contains('active')) buscarPacientes(1);
    }
  } else if (opcion === '3') {
    const otros = centros.filter((c, i) => i !== index);
    if (otros.length === 0) { alert('No hay otros centros.'); return; }
    let lista = otros.map((c, i) => `${i+1} - ${c}`).join('\n');
    let sel = prompt(`Reasignar a:\n${lista}\n\nNúmero:`);
    let idx = parseInt(sel) - 1;
    if (idx >= 0 && idx < otros.length) {
      const nuevo = otros[idx];
      pacientes = pacientes.map(p => p.institucion === centro ? { ...p, institucion: nuevo } : p);
      centros.splice(index, 1);
      guardarPacientes();
      guardarCentros();
      renderListaCentros();
      actualizarSelectCentros();
      actualizarContador();
      alert(`${cantidad} registro(s) reasignados a "${nuevo}"`);
      if (document.getElementById('section-dashboard').classList.contains('active')) cargarDashboard();
      if (document.getElementById('section-buscar').classList.contains('active')) buscarPacientes(1);
    }
  }
}

function agregarCentro() {
  const nombre = document.getElementById('nuevoCentro').value.trim();
  if (!nombre) { alert('Ingresa un nombre'); return; }
  if (centros.includes(nombre)) { alert('Ya existe'); return; }
  centros.push(nombre);
  guardarCentros();
  renderListaCentros();
  actualizarSelectCentros();
  document.getElementById('nuevoCentro').value = '';
  alert(`Centro "${nombre}" agregado`);
}

function actualizarSelectCentros() {
  const selects = [document.getElementById('selectInstitucion'), document.getElementById('busquedaInstitucionSelect'), document.getElementById('filtroInstitucionSelect'), document.getElementById('editSelectInstitucion')];
  selects.forEach(select => {
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">-- Seleccionar centro --</option>';
    centros.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; select.appendChild(opt); });
    if (current && centros.includes(current)) select.value = current;
  });
  const busq = document.getElementById('busquedaInstitucionSelect');
  if (busq) { let all = busq.querySelector('option[value=""]'); if (!all) { all = document.createElement('option'); all.value = ""; all.textContent = "Todos los centros"; busq.insertBefore(all, busq.firstChild); } busq.value = ""; }
  const rep = document.getElementById('filtroInstitucionSelect');
  if (rep) { let all = rep.querySelector('option[value=""]'); if (!all) { all = document.createElement('option'); all.value = ""; all.textContent = "Todos los centros"; rep.insertBefore(all, rep.firstChild); } rep.value = ""; }
}

function migrarCentrosDesdePacientes() {
  const existentes = new Set(centros);
  pacientes.forEach(p => { if (p.institucion && p.institucion.trim()) existentes.add(p.institucion.trim()); });
  const nuevos = Array.from(existentes).filter(c => !centros.includes(c));
  if (nuevos.length) { centros.push(...nuevos); guardarCentros(); }
}

function guardarPacientes() {
  guardarEnFirebase();
}

// ==================== MENÚ MÓVIL ====================
function initMobileMenu() {
  const mobileBtns = document.querySelectorAll('.mobile-menu-btn');
  if (!mobileBtns.length) return;
  mobileBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const section = this.getAttribute('data-section');
      mobileBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      const sec = document.getElementById(`section-${section}`);
      if (sec) sec.classList.add('active');
      document.querySelectorAll('.menu-item').forEach(item => {
        if (item.getAttribute('data-section') === section) item.classList.add('active');
        else item.classList.remove('active');
      });
      if (section === 'dashboard') cargarDashboard();
    });
  });
}

function setupNavigation() {
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.getAttribute('data-section');
      if (!section) return;
      document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      const sec = document.getElementById(`section-${section}`);
      if (sec) sec.classList.add('active');
      document.querySelectorAll('.mobile-menu-btn').forEach(btn => {
        if (btn.getAttribute('data-section') === section) btn.classList.add('active');
        else btn.classList.remove('active');
      });
      if (section === 'dashboard') cargarDashboard();
    });
  });
}

function toggleConfigMenu() {
  const panel = document.getElementById('configPanel');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
}

// ==================== VALIDACIÓN RUT ====================
function validarRUT(rut) {
  if (!rut) return false;
  let limpio = rut.replace(/[^0-9kK]/g, '');
  if (limpio.length < 2) return false;
  let cuerpo = limpio.slice(0, -1);
  let dv = limpio.slice(-1).toUpperCase();
  let suma = 0, mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo.charAt(i)) * mult;
    mult = mult < 7 ? mult + 1 : 2;
  }
  const esperado = 11 - (suma % 11);
  const calculado = esperado === 11 ? '0' : esperado === 10 ? 'K' : esperado.toString();
  return dv === calculado;
}

function buscarRegistrosAnteriores(rut) {
  if (!rut) return [];
  const limpio = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  return pacientes.filter(p => p.rut.replace(/[^0-9kK]/g, '').toUpperCase() === limpio).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
}

function mostrarAdvertenciaDuplicado(rut, nuevos) {
  const previos = buscarRegistrosAnteriores(rut);
  if (previos.length === 0) return false;
  let html = `<p>⚠️ Este RUT ya tiene ${previos.length} atención(es):</p>
    <table style="width:100%; border-collapse:collapse;">
      <thead><tr><th>Fecha</th><th>Monto</th><th>Centro</th></tr></thead>
      <tbody>`;
  previos.forEach(r => { html += `<tr><td style="padding:8px;">${r.fecha}</td><td style="padding:8px;">$${Number(r.monto).toLocaleString()}</td><td style="padding:8px;">${r.institucion || '-'}</td></tr>`; });
  const total = previos.reduce((s,r) => s + (Number(r.monto)||0), 0);
  html += `</tbody>
    </table>
    <div>💰 Total acumulado: $${total.toLocaleString()}</div>
    <p>¿Registrar nueva atención?</p>`;
  pendingDuplicateData = nuevos;
  document.getElementById('duplicateContent').innerHTML = html;
  document.getElementById('duplicateWarningModal').style.display = 'flex';
  return true;
}

function cerrarModalDuplicado() { document.getElementById('duplicateWarningModal').style.display = 'none'; pendingDuplicateData = null; }
function registrarDuplicadoConfirmado() {
  if (pendingDuplicateData) {
    pacientes.unshift(pendingDuplicateData);
    guardarPacientes();
    actualizarContador();
    document.getElementById('successModal').style.display = 'flex';
    document.getElementById('formPaciente').reset();
    document.getElementById('fecha').valueAsDate = new Date();
    cerrarModalDuplicado();
  }
}

function formatearRut(input) {
  if (!input) return;
  let rut = input.value.replace(/[^0-9kK]/g, '').toUpperCase();
  if (rut.length > 9) rut = rut.substring(0,9);
  if (rut.length > 1) {
    let cuerpo = rut.slice(0,-1);
    let dv = rut.slice(-1);
    cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    input.value = cuerpo + "-" + dv;
  } else input.value = rut;
}

// ==================== INICIALIZACIÓN ====================
function initializeApp() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('mainApp').style.display = 'flex';
      document.getElementById('userEmailDisplay').innerText = user.email;
      
      const mobileUserInfo = document.getElementById('mobileUserInfo');
      if (mobileUserInfo) {
        mobileUserInfo.innerHTML = `${user.email}`;
      }
      
      await cargarDatosUsuario();
    } else {
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('mainApp').style.display = 'none';
    }
  });
}

document.addEventListener('DOMContentLoaded', initializeApp);

// ==================== REGISTRAR ATENCIÓN ====================
document.getElementById('formPaciente').addEventListener('submit', (e) => {
  e.preventDefault();
  const rut = document.getElementById('rut').value;
  if (!validarRUT(rut)) { alert("❌ RUT inválido."); return; }
  const nuevos = {
    id: Date.now().toString(),
    fecha: document.getElementById('fecha').value,
    nombre: document.getElementById('nombre').value.trim(),
    rut: rut,
    institucion: document.getElementById('selectInstitucion').value,
    monto: parseInt(document.getElementById('monto').value) || 0,
    timestamp: Date.now()
  };
  if (!nuevos.institucion) { alert("Selecciona un centro"); return; }
  const previos = buscarRegistrosAnteriores(rut);
  if (previos.length > 0) {
    mostrarAdvertenciaDuplicado(rut, nuevos);
  } else {
    pacientes.unshift(nuevos);
    guardarPacientes();
    actualizarContador();
    document.getElementById('successModal').style.display = 'flex';
    e.target.reset();
    document.getElementById('fecha').valueAsDate = new Date();
  }
});

function cerrarModal() { document.getElementById('successModal').style.display = 'none'; }

// ==================== BÚSQUEDA ====================
function buscarPacientes(page = 1) {
  const fi = document.getElementById('busquedaFechaInicio').value;
  const ff = document.getElementById('busquedaFechaFin').value;
  const nom = document.getElementById('busquedaNombre').value.trim().toLowerCase();
  const rut = document.getElementById('busquedaRut').value.trim().toLowerCase();
  const inst = document.getElementById('busquedaInstitucionSelect').value;
  const start = fi ? new Date(fi) : null;
  const end = ff ? new Date(ff) : null;
  if (end) end.setHours(23,59,59);
  let filtered = pacientes.filter(p => {
    const fecha = new Date(p.fecha);
    return (!start || !end || (fecha >= start && fecha <= end)) &&
      (!nom || p.nombre.toLowerCase().includes(nom)) &&
      (!rut || p.rut.toLowerCase().includes(rut)) &&
      (!inst || p.institucion === inst);
  });
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIdx = (page-1)*ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIdx, startIdx+ITEMS_PER_PAGE);
  renderResultados(paginated, filtered.length, page, totalPages);
  currentPage = page;
}

function renderResultados(paginated, total, pageNum, totalPages) {
  const div = document.getElementById('resultados');
  if (!div) return;
  if (paginated.length === 0) { 
    div.innerHTML = "<p>No se encontraron atenciones.</p>"; 
    document.getElementById('paginacion').innerHTML = ''; 
    return; 
  }
  let html = `<div style="overflow-x:auto;"><table class="tabla-resultados"><thead>
    <tr><th>Fecha</th><th>Paciente</th><th>RUT</th><th>Centro</th><th>Monto</th><th>Acciones</th></tr>
    </thead><tbody>`;
  paginated.forEach(p => {
    let rutFormateado = p.rut;
    if (rutFormateado && !rutFormateado.includes('-')) {
      const rutLimpio = rutFormateado.replace(/[^0-9kK]/g, '');
      if (rutLimpio.length > 1) {
        const cuerpo = rutLimpio.slice(0, -1);
        const dv = rutLimpio.slice(-1).toUpperCase();
        let cuerpoFormateado = '';
        for (let i = cuerpo.length; i > 0; i -= 3) {
          const inicio = Math.max(0, i - 3);
          cuerpoFormateado = (cuerpoFormateado ? '.' : '') + cuerpo.substring(inicio, i);
        }
        rutFormateado = cuerpoFormateado + '-' + dv;
      }
    }
    html += `<tr>
      <td>${formatearFecha(p.fecha)}</td>
      <td>${escapeHtml(p.nombre)}</td>
      <td>${rutFormateado}</td>
      <td>${escapeHtml(p.institucion || '-')}</td>
      <td>$${Number(p.monto).toLocaleString()}</td>
      <td><button onclick="editarRegistro('${p.id}')" class="btn-edit">✏️</button>
      <button onclick="eliminarRegistro('${p.rut}','${p.id}')" class="btn-delete">🗑️</button></td>
    </tr>`;
  });
  html += `</tbody></tr></div>`;
  div.innerHTML = html;
  let pagHtml = '<div class="pagination-container">';
  if (pageNum > 1) pagHtml += `<button onclick="buscarPacientes(${pageNum-1})" class="btn-secondary">⬅ Anterior</button>`;
  pagHtml += `<span>Página ${pageNum} de ${totalPages}</span>`;
  if (pageNum < totalPages) pagHtml += `<button onclick="buscarPacientes(${pageNum+1})" class="btn-secondary">Siguiente ➡</button>`;
  pagHtml += '</div>';
  document.getElementById('paginacion').innerHTML = pagHtml;
}

function limpiarFiltrosBusqueda() {
  ['busquedaFechaInicio','busquedaFechaFin','busquedaNombre','busquedaRut'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const sel = document.getElementById('busquedaInstitucionSelect');
  if (sel) sel.value = '';
  buscarPacientes(1);
}

// ==================== EDICIÓN ====================
function editarRegistro(id) {
  const p = pacientes.find(i => i.id === id);
  if (!p) return;
  document.getElementById('editId').value = id;
  document.getElementById('editFecha').value = p.fecha;
  document.getElementById('editNombre').value = p.nombre;
  document.getElementById('editRut').value = p.rut;
  const sel = document.getElementById('editSelectInstitucion');
  if (sel) sel.value = p.institucion;
  document.getElementById('editMonto').value = p.monto;
  document.getElementById('editModal').style.display = 'flex';
}

function guardarEdicion() {
  const id = document.getElementById('editId').value;
  const idx = pacientes.findIndex(p => p.id === id);
  if (idx === -1) return;
  const rut = document.getElementById('editRut').value;
  if (!validarRUT(rut)) { alert("❌ RUT inválido."); return; }
  pacientes[idx].fecha = document.getElementById('editFecha').value;
  pacientes[idx].nombre = document.getElementById('editNombre').value.trim();
  pacientes[idx].rut = rut;
  pacientes[idx].institucion = document.getElementById('editSelectInstitucion').value;
  pacientes[idx].monto = parseInt(document.getElementById('editMonto').value) || 0;
  guardarPacientes();
  alert("✅ Actualizado");
  cerrarEditModal();
  buscarPacientes(currentPage);
}

function cerrarEditModal() { document.getElementById('editModal').style.display = 'none'; }
function eliminarRegistro(rut, id) {
  if (!confirm(`¿Eliminar atención de ${rut}?`)) return;
  pacientes = pacientes.filter(p => p.id !== id);
  guardarPacientes();
  actualizarContador();
  alert("Eliminado");
  buscarPacientes(currentPage);
}

// ==================== DASHBOARD ====================
function cargarDashboard() {
  const inicio = document.getElementById('dashFechaInicio').value;
  const fin = document.getElementById('dashFechaFin').value;
  let data = pacientes;
  if (inicio || fin) {
    const start = inicio ? new Date(inicio) : null;
    const end = fin ? new Date(fin) : null;
    if (end) end.setHours(23,59,59);
    data = data.filter(p => {
      const fecha = new Date(p.fecha);
      return (!start || fecha >= start) && (!end || fecha <= end);
    });
  }
  const total = data.reduce((s,p) => s + (Number(p.monto)||0), 0);
  const atenciones = data.length;
  const promedio = atenciones ? total / atenciones : 0;
  const porCentro = {};
  data.forEach(p => { const c = p.institucion || 'Sin centro'; porCentro[c] = (porCentro[c]||0) + (Number(p.monto)||0); });
  let mejor = '-', max = 0;
  for (const [c, v] of Object.entries(porCentro)) { if (v > max) { max = v; mejor = c; } }
  document.getElementById('totalIngresos').innerText = `$${total.toLocaleString()}`;
  document.getElementById('totalAtenciones').innerText = atenciones;
  document.getElementById('promedioAtencion').innerText = `$${promedio.toLocaleString()}`;
  document.getElementById('mejorCentro').innerText = mejor;
  renderGraficos(data);
}

function renderGraficos(data) {
  const isMobile = window.innerWidth <= 768;
  const byMonth = {};
  data.forEach(p => {
    const mes = p.fecha.substring(0,7);
    if (!byMonth[mes]) byMonth[mes] = { pacientes: 0, monto: 0 };
    byMonth[mes].pacientes++;
    byMonth[mes].monto += Number(p.monto) || 0;
  });
  const meses = Object.keys(byMonth).sort();
  const pacientesData = meses.map(m => byMonth[m].pacientes);
  const montoData = meses.map(m => byMonth[m].monto);
  const ctx1 = document.getElementById('generalChart')?.getContext('2d');
  if (ctx1) {
    if (generalChart) generalChart.destroy();
    generalChart = new Chart(ctx1, {
      type: isMobile ? 'line' : 'bar',
      data: { labels: meses, datasets: [
        { label: 'Atenciones', data: pacientesData, backgroundColor: '#3b82f6', borderColor: '#3b82f6', tension: 0.3, fill: false, pointRadius: isMobile ? 3 : 5 },
        { label: 'Ingresos ($)', data: montoData, backgroundColor: '#10b981', borderColor: '#10b981', tension: 0.3, fill: false, pointRadius: isMobile ? 3 : 5, yAxisID: 'y1' }
      ] },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: isMobile ? 'bottom' : 'top', labels: { boxWidth: 12, font: { size: isMobile ? 10 : 12 } } } }, scales: { y: { beginAtZero: true, ticks: { font: { size: isMobile ? 9 : 11 } } }, y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { font: { size: isMobile ? 9 : 11 }, callback: (v) => isMobile ? `${v/1000}k` : `$${v.toLocaleString()}` } }, x: { ticks: { maxRotation: isMobile ? 45 : 0, autoSkip: true, maxTicksLimit: isMobile ? 6 : 10, font: { size: isMobile ? 9 : 11 } } } } }
    });
  }
  const porCentro = {};
  data.forEach(p => { const c = p.institucion || 'Sin centro'; porCentro[c] = (porCentro[c]||0) + (Number(p.monto)||0); });
  const ctx2 = document.getElementById('ingresosCentroChart')?.getContext('2d');
  if (ctx2) {
    if (ingresosCentroChart) ingresosCentroChart.destroy();
    ingresosCentroChart = new Chart(ctx2, {
      type: 'pie',
      data: { labels: Object.keys(porCentro), datasets: [{ data: Object.values(porCentro), backgroundColor: ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444','#6366f1'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: isMobile ? 'bottom' : 'right', labels: { boxWidth: 10, font: { size: isMobile ? 9 : 11 }, generateLabels: (chart) => { const data = chart.data; if (data.labels.length) { return data.labels.map((label, i) => ({ text: isMobile ? `${label.substring(0,15)}` : label, fillStyle: data.datasets[0].backgroundColor[i], index: i })); } return []; } } }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: $${ctx.raw.toLocaleString()}` } } } }
    });
  }
}

// ==================== REPORTES ====================
function generarReporte() {
  const inicio = document.getElementById('fechaInicio').value;
  const fin = document.getElementById('fechaFin').value;
  const nombre = document.getElementById('reporteNombre').value.trim().toLowerCase();
  const rut = document.getElementById('reporteRut').value.trim().toLowerCase();
  const inst = document.getElementById('filtroInstitucionSelect').value;
  const start = inicio ? new Date(inicio) : null;
  const end = fin ? new Date(fin) : null;
  if (end) end.setHours(23,59,59);
  let rows = [], totalPacientes = 0, totalBruto = 0;
  pacientes.forEach(p => {
    const fecha = new Date(p.fecha);
    const pasaFecha = !start || !end || (fecha >= start && fecha <= end);
    const pasaNombre = !nombre || p.nombre.toLowerCase().includes(nombre);
    const pasaRut = !rut || p.rut.toLowerCase().includes(rut);
    const pasaInst = !inst || p.institucion === inst;
    if (pasaFecha && pasaNombre && pasaRut && pasaInst) {
      totalPacientes++;
      totalBruto += Number(p.monto) || 0;
      rows.push(p);
    }
  });
  currentReportRows = rows;
  const container = document.getElementById('reporteContainer');
  if (!container) return;
  if (totalPacientes === 0) { container.innerHTML = "<p>No se encontraron atenciones.</p>"; return; }
  
  let html = `<h3>Reporte de Atenciones</h3>
    <p><strong>Total atenciones:</strong> ${totalPacientes}</p>
    <div style="overflow-x:auto;">
      <table class="tabla-resultados">
        <thead>
          <tr><th>Fecha</th><th>Paciente</th><th>RUT</th><th>Centro</th><th>Monto</th></tr>
        </thead>
        <tbody>`;
  
  rows.forEach(p => {
    let rutFormateado = p.rut;
    if (rutFormateado && !rutFormateado.includes('-')) {
      const rutLimpio = rutFormateado.replace(/[^0-9kK]/g, '');
      if (rutLimpio.length > 1) {
        const cuerpo = rutLimpio.slice(0, -1);
        const dv = rutLimpio.slice(-1).toUpperCase();
        let cuerpoFormateado = '';
        for (let i = cuerpo.length; i > 0; i -= 3) {
          const inicio = Math.max(0, i - 3);
          cuerpoFormateado = (cuerpoFormateado ? '.' : '') + cuerpo.substring(inicio, i);
        }
        rutFormateado = cuerpoFormateado + '-' + dv;
      }
    }
    html += `<tr>
      <td>${formatearFecha(p.fecha)}</td>
      <td>${escapeHtml(p.nombre)}</td>
      <td>${rutFormateado}</td>
      <td>${escapeHtml(p.institucion || '-')}</td>
      <td>$${Number(p.monto).toLocaleString()}</td>
    </tr>`;
  });
  
  html += `</tbody>
      </table>
    </div>
    <div style="margin:25px 0; padding:25px; background:#f0fdf4; border-radius:12px; text-align:center;">
      <p><strong>Total Ingresos:</strong> $${totalBruto.toLocaleString()}</p>
    </div>
    <button onclick="descargarReportePDF()" class="btn-primary">📄 Descargar PDF</button>`;
  
  container.innerHTML = html;
}


///// descargar pdf////////
function descargarReportePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 20;
  
  // Logo
  try {
    const logoImg = document.querySelector('.sidebar .logo img')?.src;
    if (logoImg) {
      doc.addImage(logoImg, 'PNG', 14, 10, 40, 15);
    } else {
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("ClinicaFlow", 14, 20);
    }
  } catch(e) {
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("ClinicaFlow", 14, 20);
  }
  
  y = 35;
  doc.setFontSize(16);
  doc.setTextColor(59, 130, 246);
  doc.text("Reporte de Ingresos", 14, y);
  y += 6;
  
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.3);
  doc.line(14, y, 196, y);
  y += 10;
  
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL')}`, 14, y);
  
  if (currentUser?.email) {
    doc.text(`Usuario: ${currentUser.email}`, 14, y + 5);
    y += 14;
  } else {
    y += 10;
  }
  
  // Cabecera
  doc.setFillColor(59, 130, 246);
  doc.rect(14, y, 180, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("Fecha", 16, y + 5);
  doc.text("Paciente", 45, y + 5);
  doc.text("RUT", 95, y + 5);
  doc.text("Centro", 120, y + 5);
  doc.text("Monto", 170, y + 5);
  y += 10;
  doc.setTextColor(0, 0, 0);
  
  let total = 0;
  
  for (const p of currentReportRows) {
    total += Number(p.monto) || 0;
    
    if (y > 270) {
      doc.addPage();
      y = 20;
      doc.setFillColor(59, 130, 246);
      doc.rect(14, y, 180, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text("Fecha", 16, y + 5);
      doc.text("Paciente", 45, y + 5);
      doc.text("RUT", 95, y + 5);
      doc.text("Centro", 120, y + 5);
      doc.text("Monto", 170, y + 5);
      y += 10;
      doc.setTextColor(0, 0, 0);
    }
    
    let rutFormateado = p.rut || '';
    if (rutFormateado && !rutFormateado.includes('-')) {
      const rutLimpio = rutFormateado.replace(/[^0-9kK]/g, '');
      if (rutLimpio.length > 1) {
        const cuerpo = rutLimpio.slice(0, -1);
        const dv = rutLimpio.slice(-1).toUpperCase();
        let cuerpoFormateado = '';
        for (let i = cuerpo.length; i > 0; i -= 3) {
          const inicio = Math.max(0, i - 3);
          cuerpoFormateado = (cuerpoFormateado ? '.' : '') + cuerpo.substring(inicio, i);
        }
        rutFormateado = cuerpoFormateado + '-' + dv;
      }
    }
    
    doc.text(p.fecha || '', 16, y);
    doc.text((p.nombre || '').substring(0, 22), 45, y);
    doc.text(rutFormateado, 95, y);
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
  doc.text("ClinicaFlow - Control de Ingresos para Profesionales de la Salud", 14, 285);
  
  const pdfData = doc.output('arraybuffer'); 
  const filename = `Reporte_ClinicaFlow_${new Date().toISOString().slice(0,10)}.pdf`;
  descargarArchivo(pdfData, filename, 'application/pdf');
}


// ==================== excel ====================
function descargarExcel() {
    const data = [["Fecha","Paciente","RUT","Centro","Monto"]];
    
    pacientes.forEach(p => {
        data.push([
            p.fecha, 
            p.nombre, 
            p.rut, 
            p.institucion || "", 
            Number(p.monto) || 0
        ]);
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Atenciones");
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const filename = `Atenciones_${new Date().toISOString().slice(0,10)}.xlsx`;
    descargarArchivo(excelBuffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

// ==================== BACKUP ====================
function exportarBackup() {
    if (pacientes.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }
    
    const backup = { 
        fechaExportacion: new Date().toISOString(), 
        totalRegistros: pacientes.length, 
        centros: centros, 
        pacientes: pacientes 
    };
    
    const jsonString = JSON.stringify(backup, null, 2);
    const filename = `ClinicaFlow_Backup_${new Date().toISOString().slice(0,10)}.json`;
    descargarArchivo(jsonString, filename, 'application/json');
}

function importarBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const backup = JSON.parse(e.target.result);
      if (!backup.pacientes || !Array.isArray(backup.pacientes)) throw new Error();
      if (confirm(`¿Importar ${backup.totalRegistros} registros?`)) {
        pacientes = backup.pacientes;
        if (backup.centros) centros = backup.centros;
        guardarEnFirebase();
        actualizarContador();
        alert("Backup importado.");
        location.reload();
      }
    } catch(error) { alert("Archivo inválido."); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function limpiarTodo() {
  if (confirm("¿Eliminar TODOS los registros?")) {
    pacientes = [];
    centros = ['Clínica A', 'Consultorio B', 'Hospital C'];
    guardarEnFirebase();
    actualizarContador();
    alert("Datos eliminados");
    location.reload();
  }
}

function confirmAction(confirm) {
  if (confirm && pendingConfirmAction) pendingConfirmAction();
  document.getElementById('confirmModal').style.display = 'none';
  pendingConfirmAction = null;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

// ==================== EVENT LISTENERS ====================
document.getElementById('rut')?.addEventListener('input', () => formatearRut(document.getElementById('rut')));
document.getElementById('busquedaRut')?.addEventListener('input', () => formatearRut(document.getElementById('busquedaRut')));

// ==================== DESCARGA PARA PC ====================
function descargarArchivo(data, filename, mimeType = 'application/octet-stream') {
    try {
        let blob;
        
        if (typeof data === 'string') {
            blob = new Blob([data], { type: mimeType });
        } else {
            blob = new Blob([data], { type: mimeType });
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);

        // Notificación de éxito
        const mensaje = document.createElement('div');
        mensaje.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #22c55e;
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            z-index: 9999;
            font-size: 14px;
            font-family: 'Segoe UI', sans-serif;
            max-width: 380px;
            animation: slideIn 0.3s ease;
        `;
        mensaje.innerHTML = `✅ <strong>Descarga completada</strong><br><span style="font-size:12px;opacity:0.9;">${filename}</span>`;
        document.body.appendChild(mensaje);
        
        setTimeout(() => {
            mensaje.style.opacity = '0';
            mensaje.style.transition = 'opacity 0.5s ease';
            setTimeout(() => mensaje.remove(), 500);
        }, 4000);
        
    } catch (e) {
        console.error("Error en descarga:", e);
        alert("❌ Error al preparar la descarga:\n" + e.message);
    }
}
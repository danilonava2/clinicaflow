import { state, guardarDatos } from '../store.js';
import { escapeHtml, formatearMonto } from '../utils/format.js';
import { cargarDashboard } from './dashboard.js';
import { buscarPacientes } from './pacientes.js';

export function renderListaCentros() {
  const container = document.getElementById('listaCentros');
  if (!container) return;
  if (state.centros.length === 0) {
    container.innerHTML = '<p>No hay centros agregados. Agrega los lugares donde atiendes.</p>';
    return;
  }
  let html = '<div class="centros-grid">';
  state.centros.forEach((centro, index) => {
    html += `<div class="centro-card">
      <div class="centro-header">
        <span>🏥 ${escapeHtml(centro.nombre)}</span>
        <div>
          <button onclick="editarCentro(${index})" class="btn-edit" style="margin-right:5px;">✏️</button>
          <button onclick="eliminarCentro(${index})" class="btn-delete">🗑️</button>
        </div>
      </div>
      <div class="previsiones-list">`;

    if (centro.previsiones.length === 0) {
      html += '<p style="color:#94a3b8; font-size:13px; margin:0;">Sin previsiones configuradas todavía.</p>';
    } else {
      centro.previsiones.forEach((prevision, previsionIndex) => {
        html += `<div class="prevision-item">
          <span>🩺 ${escapeHtml(prevision.nombre)} — ${formatearMonto(prevision.monto)}</span>
          <div>
            <button onclick="editarPrevision(${index},${previsionIndex})" class="btn-edit" style="margin-right:5px;">✏️</button>
            <button onclick="eliminarPrevision(${index},${previsionIndex})" class="btn-delete">🗑️</button>
          </div>
        </div>`;
      });
    }

    html += `<div class="prevision-add-form">
        <input type="text" id="nuevaPrevisionNombre-${index}" placeholder="Nombre previsión (ej: Fonasa)">
        <input type="number" id="nuevaPrevisionMonto-${index}" placeholder="Monto">
        <button onclick="agregarPrevision(${index})" class="btn-secondary">+ Agregar previsión</button>
      </div>
    </div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

export function editarCentro(index) {
  const centroActual = state.centros[index];
  const nuevoNombre = prompt(`Editar centro "${centroActual.nombre}"`, centroActual.nombre);
  if (!nuevoNombre || nuevoNombre === centroActual.nombre) return;
  if (state.centros.some((c) => c.nombre === nuevoNombre)) {
    alert('Ya existe un centro con ese nombre');
    return;
  }
  const nombreAnterior = centroActual.nombre;
  centroActual.nombre = nuevoNombre;
  let registrosActualizados = 0;
  state.pacientes = state.pacientes.map((p) => {
    if (p.institucion === nombreAnterior) {
      registrosActualizados++;
      return { ...p, institucion: nuevoNombre };
    }
    return p;
  });
  guardarDatos();
  renderListaCentros();
  actualizarSelectCentros();
  actualizarSelectPrevisionDashboard();
  alert(`Centro "${nombreAnterior}" → "${nuevoNombre}"\nSe actualizaron ${registrosActualizados} registro(s)`);
  if (document.getElementById('section-dashboard').classList.contains('active')) cargarDashboard();
  if (document.getElementById('section-buscar').classList.contains('active')) buscarPacientes();
}

export function eliminarCentro(index) {
  const centro = state.centros[index];
  const cantidad = state.pacientes.filter((p) => p.institucion === centro.nombre).length;
  const opcion = prompt(
    `Centro "${centro.nombre}" tiene ${cantidad} registro(s) asociado(s).\n1 - Mantener registros\n2 - Eliminar registros\n3 - Reasignar a otro centro\n\nEscribe 1, 2 o 3:`
  );
  if (opcion === '1') {
    state.centros.splice(index, 1);
    guardarDatos();
    renderListaCentros();
    actualizarSelectCentros();
    actualizarSelectPrevisionDashboard();
    alert(`Centro "${centro.nombre}" eliminado. Los registros conservan el nombre.`);
  } else if (opcion === '2') {
    if (confirm(`¿Eliminar ${cantidad} registro(s)?`)) {
      state.pacientes = state.pacientes.filter((p) => p.institucion !== centro.nombre);
      state.centros.splice(index, 1);
      guardarDatos();
      renderListaCentros();
      actualizarSelectCentros();
      actualizarSelectPrevisionDashboard();
      alert(`Se eliminaron ${cantidad} registro(s) y el centro.`);
      if (document.getElementById('section-dashboard').classList.contains('active')) cargarDashboard();
      if (document.getElementById('section-buscar').classList.contains('active')) buscarPacientes(1);
    }
  } else if (opcion === '3') {
    const otros = state.centros.filter((c, i) => i !== index);
    if (otros.length === 0) {
      alert('No hay otros centros.');
      return;
    }
    const lista = otros.map((c, i) => `${i + 1} - ${c.nombre}`).join('\n');
    const sel = prompt(`Reasignar a:\n${lista}\n\nNúmero:`);
    const idx = parseInt(sel) - 1;
    if (idx >= 0 && idx < otros.length) {
      const nuevo = otros[idx];
      state.pacientes = state.pacientes.map((p) =>
        p.institucion === centro.nombre ? { ...p, institucion: nuevo.nombre } : p
      );
      state.centros.splice(index, 1);
      guardarDatos();
      renderListaCentros();
      actualizarSelectCentros();
      actualizarSelectPrevisionDashboard();
      alert(`${cantidad} registro(s) reasignados a "${nuevo.nombre}"`);
      if (document.getElementById('section-dashboard').classList.contains('active')) cargarDashboard();
      if (document.getElementById('section-buscar').classList.contains('active')) buscarPacientes(1);
    }
  }
}

export function agregarCentro() {
  const input = document.getElementById('nuevoCentro');
  const nombre = input.value.trim();
  if (!nombre) {
    alert('Ingresa un nombre');
    return;
  }
  if (state.centros.some((c) => c.nombre === nombre)) {
    alert('Ya existe');
    return;
  }
  state.centros.push({ nombre, previsiones: [] });
  guardarDatos();
  renderListaCentros();
  actualizarSelectCentros();
  input.value = '';
  alert(`Centro "${nombre}" agregado`);
}

export function agregarPrevision(centroIndex) {
  const nombreInput = document.getElementById(`nuevaPrevisionNombre-${centroIndex}`);
  const montoInput = document.getElementById(`nuevaPrevisionMonto-${centroIndex}`);
  const nombre = nombreInput.value.trim();
  const monto = parseInt(montoInput.value) || 0;
  if (!nombre) {
    alert('Ingresa un nombre para la previsión');
    return;
  }
  const centro = state.centros[centroIndex];
  if (centro.previsiones.some((p) => p.nombre === nombre)) {
    alert('Ya existe una previsión con ese nombre en este centro');
    return;
  }
  centro.previsiones.push({ nombre, monto });
  guardarDatos();
  renderListaCentros();
  actualizarSelectPrevisionDashboard();
}

export function editarPrevision(centroIndex, previsionIndex) {
  const prevision = state.centros[centroIndex].previsiones[previsionIndex];
  const nuevoNombre = prompt('Nombre de la previsión', prevision.nombre);
  if (nuevoNombre === null) return;
  const nuevoMontoStr = prompt('Monto para esta previsión', prevision.monto);
  if (nuevoMontoStr === null) return;
  prevision.nombre = nuevoNombre.trim() || prevision.nombre;
  prevision.monto = parseInt(nuevoMontoStr) || 0;
  guardarDatos();
  renderListaCentros();
  actualizarSelectPrevisionDashboard();
}

export function eliminarPrevision(centroIndex, previsionIndex) {
  const centro = state.centros[centroIndex];
  const prevision = centro.previsiones[previsionIndex];
  if (!confirm(`¿Eliminar la previsión "${prevision.nombre}"?`)) return;
  centro.previsiones.splice(previsionIndex, 1);
  guardarDatos();
  renderListaCentros();
  actualizarSelectPrevisionDashboard();
}

export function actualizarSelectCentros() {
  const selects = [
    document.getElementById('selectInstitucion'),
    document.getElementById('busquedaInstitucionSelect'),
    document.getElementById('filtroInstitucionSelect'),
    document.getElementById('editSelectInstitucion'),
    document.getElementById('dashInstitucionSelect')
  ];
  selects.forEach((select) => {
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">-- Seleccionar centro --</option>';
    state.centros.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.nombre;
      opt.textContent = c.nombre;
      select.appendChild(opt);
    });
    if (current && state.centros.some((c) => c.nombre === current)) select.value = current;
  });

  const busq = document.getElementById('busquedaInstitucionSelect');
  if (busq) {
    let all = busq.querySelector('option[value=""]');
    if (!all) {
      all = document.createElement('option');
      all.value = '';
      all.textContent = 'Todos los centros';
      busq.insertBefore(all, busq.firstChild);
    }
    busq.value = '';
  }

  const rep = document.getElementById('filtroInstitucionSelect');
  if (rep) {
    let all = rep.querySelector('option[value=""]');
    if (!all) {
      all = document.createElement('option');
      all.value = '';
      all.textContent = 'Todos los centros';
      rep.insertBefore(all, rep.firstChild);
    }
    rep.value = '';
  }

  const dash = document.getElementById('dashInstitucionSelect');
  if (dash) {
    let all = dash.querySelector('option[value=""]');
    if (!all) {
      all = document.createElement('option');
      all.value = '';
      all.textContent = 'Todos los centros';
      dash.insertBefore(all, dash.firstChild);
    }
    dash.value = '';
  }
}

export function actualizarSelectPrevisionDashboard() {
  const select = document.getElementById('dashPrevisionSelect');
  if (!select) return;
  const nombres = new Set();
  state.centros.forEach((c) => c.previsiones.forEach((p) => nombres.add(p.nombre)));
  select.innerHTML = '<option value="">Todas las previsiones</option>';
  Array.from(nombres)
    .sort()
    .forEach((nombre) => {
      const opt = document.createElement('option');
      opt.value = nombre;
      opt.textContent = nombre;
      select.appendChild(opt);
    });
  select.value = '';
}

export function migrarCentrosDesdePacientes() {
  const existentes = new Set(state.centros.map((c) => c.nombre));
  state.pacientes.forEach((p) => {
    if (p.institucion && p.institucion.trim()) existentes.add(p.institucion.trim());
  });
  const nombresActuales = new Set(state.centros.map((c) => c.nombre));
  const nuevos = Array.from(existentes).filter((nombre) => !nombresActuales.has(nombre));
  if (nuevos.length) {
    nuevos.forEach((nombre) => state.centros.push({ nombre, previsiones: [] }));
    guardarDatos();
  }
}

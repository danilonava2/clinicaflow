import { state, guardarDatos } from '../store.js';
import { escapeHtml } from '../utils/format.js';
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

export function editarCentro(index) {
  const centroActual = state.centros[index];
  const nuevoNombre = prompt(`Editar centro "${centroActual}"`, centroActual);
  if (!nuevoNombre || nuevoNombre === centroActual) return;
  if (state.centros.includes(nuevoNombre)) {
    alert('Ya existe un centro con ese nombre');
    return;
  }
  state.centros[index] = nuevoNombre;
  let registrosActualizados = 0;
  state.pacientes = state.pacientes.map((p) => {
    if (p.institucion === centroActual) {
      registrosActualizados++;
      return { ...p, institucion: nuevoNombre };
    }
    return p;
  });
  guardarDatos();
  renderListaCentros();
  actualizarSelectCentros();
  alert(`Centro "${centroActual}" → "${nuevoNombre}"\nSe actualizaron ${registrosActualizados} registro(s)`);
  if (document.getElementById('section-dashboard').classList.contains('active')) cargarDashboard();
  if (document.getElementById('section-buscar').classList.contains('active')) buscarPacientes();
}

export function eliminarCentro(index) {
  const centro = state.centros[index];
  const cantidad = state.pacientes.filter((p) => p.institucion === centro).length;
  const opcion = prompt(
    `Centro "${centro}" tiene ${cantidad} registro(s) asociado(s).\n1 - Mantener registros\n2 - Eliminar registros\n3 - Reasignar a otro centro\n\nEscribe 1, 2 o 3:`
  );
  if (opcion === '1') {
    state.centros.splice(index, 1);
    guardarDatos();
    renderListaCentros();
    actualizarSelectCentros();
    alert(`Centro "${centro}" eliminado. Los registros conservan el nombre.`);
  } else if (opcion === '2') {
    if (confirm(`¿Eliminar ${cantidad} registro(s)?`)) {
      state.pacientes = state.pacientes.filter((p) => p.institucion !== centro);
      state.centros.splice(index, 1);
      guardarDatos();
      renderListaCentros();
      actualizarSelectCentros();
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
    const lista = otros.map((c, i) => `${i + 1} - ${c}`).join('\n');
    const sel = prompt(`Reasignar a:\n${lista}\n\nNúmero:`);
    const idx = parseInt(sel) - 1;
    if (idx >= 0 && idx < otros.length) {
      const nuevo = otros[idx];
      state.pacientes = state.pacientes.map((p) => (p.institucion === centro ? { ...p, institucion: nuevo } : p));
      state.centros.splice(index, 1);
      guardarDatos();
      renderListaCentros();
      actualizarSelectCentros();
      alert(`${cantidad} registro(s) reasignados a "${nuevo}"`);
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
  if (state.centros.includes(nombre)) {
    alert('Ya existe');
    return;
  }
  state.centros.push(nombre);
  guardarDatos();
  renderListaCentros();
  actualizarSelectCentros();
  input.value = '';
  alert(`Centro "${nombre}" agregado`);
}

export function actualizarSelectCentros() {
  const selects = [
    document.getElementById('selectInstitucion'),
    document.getElementById('busquedaInstitucionSelect'),
    document.getElementById('filtroInstitucionSelect'),
    document.getElementById('editSelectInstitucion')
  ];
  selects.forEach((select) => {
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">-- Seleccionar centro --</option>';
    state.centros.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
    if (current && state.centros.includes(current)) select.value = current;
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
}

export function migrarCentrosDesdePacientes() {
  const existentes = new Set(state.centros);
  state.pacientes.forEach((p) => {
    if (p.institucion && p.institucion.trim()) existentes.add(p.institucion.trim());
  });
  const nuevos = Array.from(existentes).filter((c) => !state.centros.includes(c));
  if (nuevos.length) {
    state.centros.push(...nuevos);
    guardarDatos();
  }
}

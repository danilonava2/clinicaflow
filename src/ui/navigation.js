import { cargarDashboard } from '../modules/dashboard.js';

export function seleccionarSeccion(section) {
  document.querySelectorAll('.menu-item').forEach((item) => {
    item.classList.toggle('active', item.getAttribute('data-section') === section);
  });

  document.querySelectorAll('.mobile-menu-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-section') === section);
  });

  document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
  const targetSection = document.getElementById(`section-${section}`);
  if (targetSection) targetSection.classList.add('active');

  if (section === 'dashboard') cargarDashboard();
}

export function setupNavigation() {
  document.querySelectorAll('.menu-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.getAttribute('data-section');
      if (!section) return;
      seleccionarSeccion(section);
    });
  });
}

export function initMobileMenu() {
  const mobileBtns = document.querySelectorAll('.mobile-menu-btn');
  if (!mobileBtns.length) return;
  mobileBtns.forEach((btn) => {
    btn.addEventListener('click', function () {
      const section = this.getAttribute('data-section');
      seleccionarSeccion(section);
    });
  });
}

export function toggleConfigMenu() {
  const panel = document.getElementById('configPanel');
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

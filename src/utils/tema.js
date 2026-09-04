const CLAVE_STORAGE = 'clinicaflow-tema';

function actualizarTextoBotones() {
  const oscuro = esModoOscuro();
  document.querySelectorAll('.theme-toggle-texto').forEach((el) => {
    el.innerText = oscuro ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
  });
}

export function esModoOscuro() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

// Aplica el tema guardado (si hay) apenas carga la pagina, antes incluso de
// iniciar sesion, para que no haya un "flash" del tema equivocado.
export function aplicarTemaGuardado() {
  let guardado = null;
  try {
    guardado = localStorage.getItem(CLAVE_STORAGE);
  } catch (e) {
    // localStorage puede no estar disponible (modo privado); se ignora.
  }
  if (guardado === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  actualizarTextoBotones();
}

export function alternarTema() {
  const nuevoOscuro = !esModoOscuro();
  if (nuevoOscuro) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  try {
    localStorage.setItem(CLAVE_STORAGE, nuevoOscuro ? 'dark' : 'light');
  } catch (e) {
    // No es critico si no se puede persistir.
  }
  actualizarTextoBotones();
}

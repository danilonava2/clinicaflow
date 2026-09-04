import { auth } from './firebase/config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { listarTodosLosUsuarios, cambiarPlanUsuario } from './firebase/firestoreDataService.js';

// Solo esta cuenta puede ver y usar este panel (ademas de estar reforzado
// en firestore.rules, que es lo que realmente protege los datos).
const ADMIN_UID = 'VJEehVVQdpVgQqd5g6X6r9xxnyr2';

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

async function cargarUsuarios() {
  const contenedor = document.getElementById('listaUsuarios');
  contenedor.innerHTML = 'Cargando...';
  try {
    const usuarios = await listarTodosLosUsuarios();
    if (usuarios.length === 0) {
      contenedor.innerHTML = '<p>No hay usuarios registrados.</p>';
      return;
    }

    let html = `<div style="overflow-x:auto;"><table class="tabla-resultados">
      <thead><tr><th>Correo</th><th>Plan</th><th>Registros</th><th>Centros</th><th>Acción</th></tr></thead>
      <tbody>`;
    usuarios.forEach((u) => {
      const esPro = u.plan === 'pro';
      html += `<tr>
        <td>${u.email}</td>
        <td>${esPro ? '⭐ Pro' : 'Gratis'}</td>
        <td>${u.totalRegistros}</td>
        <td>${u.totalCentros}</td>
        <td><button class="${esPro ? 'btn-secondary' : 'btn-primary'} btn-cambiar-plan" data-uid="${u.uid}" data-plan="${esPro ? 'gratis' : 'pro'}">${esPro ? 'Quitar Pro' : 'Activar Pro'}</button></td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    contenedor.innerHTML = html;

    contenedor.querySelectorAll('.btn-cambiar-plan').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.innerText = 'Guardando...';
        try {
          await cambiarPlanUsuario(btn.dataset.uid, btn.dataset.plan);
          await cargarUsuarios();
        } catch (error) {
          alert('Error al cambiar el plan: ' + error.message);
          btn.disabled = false;
        }
      });
    });
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

Object.assign(window, { adminLogin, adminLogout });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('Error al registrar el service worker:', error);
    });
  });
}

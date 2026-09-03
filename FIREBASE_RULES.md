# Reglas de seguridad de Firebase Realtime Database

El archivo `database.rules.json` en la raíz del proyecto define las reglas que
restringen cada cuenta a leer/escribir únicamente sus propios datos
(`usuarios/{uid}`), y bloquea cualquier otra ruta por defecto.

No tengo acceso al proyecto de Firebase (`clinicaflowapp-57a8a`) desde este
entorno, así que hay que aplicarlas manualmente:

## Opción A — Firebase Console (más rápido, sin instalar nada)
1. Entra a https://console.firebase.google.com/project/clinicaflowapp-57a8a/database
2. Ve a la pestaña **Reglas**.
3. Reemplaza el contenido por el de `database.rules.json` (raíz de este repo).
4. Clic en **Publicar**.

## Opción B — Firebase CLI (una vez que instalemos Node.js)
```
npm install -g firebase-tools
firebase login
firebase deploy --only database
```
(requiere un `firebase.json` apuntando a `database.rules.json`, que agregaremos
cuando montemos el proyecto con Vite).

## Por qué importa
Hoy no hay forma de confirmar, sin entrar a la consola, si las reglas actuales
ya restringen el acceso por `auth.uid`. Si las reglas por defecto siguen
abiertas (`".read": true, ".write": true`), **cualquier usuario autenticado
podría leer o modificar los datos de otros profesionales**. Aplicar este
archivo cierra ese hueco.

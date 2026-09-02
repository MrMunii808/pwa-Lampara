# PWA Lámpara ESP32 v2

Versión refactorizada del dashboard original. Mantiene el contrato existente con Supabase y el `deviceId` `lampara-01`.

## Qué cambia

- Estado del ESP32 mediante `devices.last_seen` con ventana de 90 segundos.
- Supabase Realtime para `devices` y `telemetry`.
- Fallback REST cada 15 segundos si Realtime falla.
- Reintento al volver a tener Internet y al volver a la pestaña.
- Service Worker **Network First** para evitar servir una versión vieja desde caché.
- Assets versionados con `?v=2.0.0`.
- Estado de sincronización visible.
- Manejo de errores visible en la interfaz.
- Comandos `power` y `brightness` conservados.
- Historial de potencia conservado.
- Compatible con GitHub Pages en raíz o subcarpeta.

## Publicación en GitHub Pages

Subí **el contenido de esta carpeta** al repositorio. No cambies las rutas relativas.

Luego:

1. GitHub → Settings → Pages.
2. Seleccioná la rama `main` y `/ (root)`.
3. Abrí la URL HTTPS de GitHub Pages.
4. Hacé una recarga fuerte una vez (`Ctrl + Shift + R`).

## Si el navegador conserva la PWA vieja

La v2 intenta actualizar y reemplazar el Service Worker automáticamente. Si ya tenías instalada la PWA anterior y sigue mostrando una versión antigua, abrí la URL en una pestaña normal, recargá con `Ctrl + Shift + R` y volvé a abrirla.

En Chrome también se puede comprobar desde DevTools → Application → Service Workers que el worker activo sea `2.0.0`.

## Supabase

La configuración actual coincide con el proyecto utilizado por el firmware:

- URL: `https://kottyewarcwmqwmyakji.supabase.co`
- Device ID: `lampara-01`
- Publishable key: configurada en `js/config.js`

No se usa `service_role`.

## Realtime

La PWA intenta suscribirse a cambios de `devices` y `telemetry`. Si la publicación Realtime de esas tablas no está habilitada, la PWA sigue funcionando mediante REST cada 15 segundos.

## Comprobación esperada

Con el ESP32 funcionando, Supabase debería mostrar un `devices.last_seen` reciente. La PWA debe mostrar:

`● ESP32 conectado`

y debajo:

`Sincronizado ahora` / `Sincronizado hace Ns`.

El firmware existente actualiza `devices.last_seen` aproximadamente cada 10 segundos, por lo que la ventana de 90 segundos es suficiente.

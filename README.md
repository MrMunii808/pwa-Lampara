# Dashboard PWA — ESP32 + Supabase + GitHub Pages

## 1. Estructura

- `index.html` — dashboard
- `css/styles.css` — interfaz
- `js/config.js` — URL/anon key/device ID
- `js/app.js` — lógica Supabase + gráficos + comandos
- `manifest.json` — PWA
- `service-worker.js` — caché/offline
- `supabase/schema.sql` — tablas, RLS y políticas demo
- `icons/icon.svg` — icono

## 2. Supabase

1. Crea un proyecto en Supabase.
2. Abre SQL Editor.
3. Ejecuta `supabase/schema.sql`.
4. En Database > Replication/Realtime, habilita `devices` y `telemetry`.
5. Copia Project URL y la clave `anon/public` en `js/config.js`.
6. Mantén `deviceId` como `lampara-01` o cambia ambos lados.

## 3. GitHub Pages

Sube toda esta carpeta a un repositorio.

En GitHub:
Settings → Pages → Deploy from a branch → `main` → `/ (root)`.

La PWA debe servirse por HTTPS para que el service worker funcione.

## 4. Contrato esperado del ESP32

El ESP32 debería terminar enviando/actualizando datos con esta forma conceptual:

{
  "device_id": "lampara-01",
  "lamp_on": true,
  "brightness": 75,
  "temperature": 28.4,
  "voltage": 220.1,
  "current": 0.12,
  "power": 26.4,
  "last_seen": "2026-08-28T13:00:00Z"
}

Y registrar muestras en `telemetry`.

Para controlar la lámpara, la PWA inserta en `commands`:

- `{type:"power", value:true/false}`
- `{type:"brightness", value:0..100}`

El ESP32 debe leer comandos pendientes y marcar `executed_at`.

## 5. Seguridad

No pongas la `service_role` key en GitHub Pages ni en el ESP32.

La configuración incluida usa políticas públicas de DEMO para que puedas probar rápidamente. Para una instalación real conviene añadir Supabase Auth y restringir RLS, y usar una Edge Function/backend autenticado para el ESP32.

## 6. GitHub Pages con repositorio en subcarpeta

El proyecto usa rutas relativas (`./`), por lo que funciona también cuando la URL es:

`https://usuario.github.io/nombre-del-repo/`

## 7. Próximo paso

Cuando tengas el código del ESP32, adapta el firmware al contrato anterior. Si me lo pasas, puedo prepararte el `.ino` para publicar telemetría y consumir los comandos de esta PWA.

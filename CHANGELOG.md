# v2.0.0

- Refactor de `app.js` en módulos API, Realtime, UI y gráfico.
- Realtime para `devices` y `telemetry`.
- Fallback de polling REST de 15 s.
- Service Worker Network First y limpieza de cachés anteriores.
- Versionado de assets para invalidar caché.
- Reconexión al volver online y al volver a la pestaña.
- Indicador de edad de `last_seen`.
- Manejo de errores Supabase visible.
- Conservado el contrato `lampara-01`, `devices`, `telemetry`, `commands`.

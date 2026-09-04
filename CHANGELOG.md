# PWA Lampara - V3

- Confirmación real de comandos: la PWA ya no muestra éxito optimista.
- Después de insertar un comando en `commands`, espera `executed_at` y verifica que `devices.lamp_on`/`brightness` coincida con lo solicitado.
- Si no hay confirmación en 12 segundos, muestra advertencia y no declara que la lámpara cambió.
- Compatible con el firmware V5 que actualiza `devices`, inserta `telemetry` y marca `commands.executed_at`.
- Supabase y `device_id` permanecen fijos en la configuración; WiFiManager solo configura Wi-Fi.

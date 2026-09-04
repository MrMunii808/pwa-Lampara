// Configuración pública. Usar únicamente la publishable/anon key.
window.SUPABASE_CONFIG = Object.freeze({
  url: "https://kottyewarcwmqwmyakji.supabase.co",
  anonKey: "sb_publishable_TQJ96wL3sgnW76tW5snsXA_q2rOsH4S",
  deviceId: "lampara-01"
});

window.LAMP_APP_CONFIG = Object.freeze({
  version: "4.0.0",
  onlineWindowMs: 30000,
  devicePollMs: 5000,
  historyLimit: 1000,
  commandTimeoutMs: 15000,
  commandPollMs: 700,
  realtimeReconnectMs: 5000
});

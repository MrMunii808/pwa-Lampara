// Configuración pública del dashboard.
// Esta clave es la publishable/anon key y NO debe ser service_role.
window.SUPABASE_CONFIG = {
  url: "https://kottyewarcwmqwmyakji.supabase.co",
  anonKey: "sb_publishable_TQJ96wL3sgnW76tW5snsXA_q2rOsH4S",
  deviceId: "lampara-01"
};

window.LAMP_APP_CONFIG = {
  version: "2.0.0",
  onlineWindowMs: 90 * 1000,
  pollMs: 15 * 1000,
  historyLimit: 1000
};

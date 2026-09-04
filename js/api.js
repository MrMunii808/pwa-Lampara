(function () {
  const cfg = window.SUPABASE_CONFIG;
  if (!cfg?.url || !cfg?.anonKey || !cfg?.deviceId) {
    throw new Error("Configuración Supabase incompleta.");
  }
  if (!window.supabase?.createClient) {
    throw new Error("No se cargó la librería de Supabase.");
  }

  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 10 } }
  });

  async function getDevice() {
    const { data, error } = await client
      .from("devices")
      .select("device_id,name,lamp_on,brightness,temperature,voltage,current,power,last_seen,updated_at")
      .eq("device_id", cfg.deviceId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function getTelemetry(hours) {
    const since = new Date(Date.now() - Number(hours) * 3600000).toISOString();
    const { data, error } = await client
      .from("telemetry")
      .select("id,created_at,power,temperature,voltage,current,brightness,lamp_on")
      .eq("device_id", cfg.deviceId)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(window.LAMP_APP_CONFIG.historyLimit);
    if (error) throw error;
    return data || [];
  }

  async function sendCommand(type, value) {
    const { data, error } = await client
      .from("commands")
      .insert({ device_id: cfg.deviceId, type, value })
      .select("id,type,value,created_at,executed_at")
      .single();
    if (error) throw error;
    return data;
  }

  async function getCommand(id) {
    const { data, error } = await client
      .from("commands")
      .select("id,type,value,created_at,executed_at")
      .eq("id", id)
      .eq("device_id", cfg.deviceId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  window.LampAPI = {
    client,
    getDevice,
    getTelemetry,
    sendCommand,
    getCommand
  };
})();

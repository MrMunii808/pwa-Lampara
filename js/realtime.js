(function () {
  let channel = null;
  let status = "CLOSED";
  let reconnectTimer = null;

  function stop() {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (channel) {
      window.LampAPI.client.removeChannel(channel);
      channel = null;
    }
    status = "CLOSED";
  }

  function start({ onDevice, onTelemetry, onCommand, onStatus, onError } = {}) {
    stop();

    const cfg = window.SUPABASE_CONFIG;
    const client = window.LampAPI.client;
    const channelName = `lamp-${cfg.deviceId}-v4-${Date.now()}`;

    channel = client
      .channel(channelName)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "devices",
        filter: `device_id=eq.${cfg.deviceId}`
      }, payload => {
        if (payload?.new) onDevice?.(payload.new);
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "telemetry",
        filter: `device_id=eq.${cfg.deviceId}`
      }, payload => {
        if (payload?.new) onTelemetry?.(payload.new);
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "commands",
        filter: `device_id=eq.${cfg.deviceId}`
      }, payload => {
        if (payload?.new) onCommand?.(payload.new);
      })
      .subscribe((newStatus, error) => {
        status = newStatus || "UNKNOWN";
        onStatus?.(status, error);

        if (error) onError?.(error);

        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            start({ onDevice, onTelemetry, onCommand, onStatus, onError });
          }, window.LAMP_APP_CONFIG.realtimeReconnectMs);
        }
      });
  }

  window.LampRealtime = Object.freeze({ start, stop, getStatus: () => status });
})();

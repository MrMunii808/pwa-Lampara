(function () {
  let channel = null;
  let status = "CLOSED";

  function start(onDevice, onTelemetry, onStatus) {
    if (channel) stop();

    const cfg = window.SUPABASE_CONFIG;
    const client = window.LampAPI.client;

    channel = client
      .channel(`lamp-${cfg.deviceId}-v2`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "devices",
        filter: `device_id=eq.${cfg.deviceId}`
      }, payload => {
        if (payload.new) onDevice(payload.new);
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "telemetry",
        filter: `device_id=eq.${cfg.deviceId}`
      }, payload => {
        if (payload.new) onTelemetry(payload.new);
      })
      .subscribe((newStatus) => {
        status = newStatus;
        onStatus?.(newStatus);
      });
  }

  function stop() {
    if (!channel) return;
    window.LampAPI.client.removeChannel(channel);
    channel = null;
    status = "CLOSED";
  }

  window.LampRealtime = { start, stop, getStatus: () => status };
})();

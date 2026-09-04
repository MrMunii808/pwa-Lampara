(function () {
  const { $, toast, setError, setBadge, setSync, isOnline, formatAge, renderDevice, setControlsBusy } = window.LampUI;
  const cfg = window.SUPABASE_CONFIG;
  let device = null;
  let telemetry = [];
  let lastSuccessfulSync = 0;
  let refreshTimer = null;
  let onlineTimer = null;
  let deferredInstallPrompt = null;

  function updateOnlineBadge() {
    setBadge(isOnline(device));
    if (device?.last_seen) setSync(`Sincronizado ${formatAge(device.last_seen)}`);
  }

  async function loadDevice({ silent = false } = {}) {
    const data = await window.LampAPI.getDevice();
    device = data;
    renderDevice(device);
    lastSuccessfulSync = Date.now();
    setError("");
    return data;
  }

  async function loadHistory({ silent = false } = {}) {
    const hours = Number($("historyHours").value);
    const data = await window.LampAPI.getTelemetry(hours);
    telemetry = data;
    window.LampChart.draw(telemetry);
    return data;
  }

  async function refreshAll({ silent = false } = {}) {
    try {
      const results = await Promise.all([loadDevice({ silent }), loadHistory({ silent })]);
      if (!silent) toast("Datos actualizados");
      return results;
    } catch (error) {
      console.error("[PWA] refreshAll", error);
      setError(`No se pudo sincronizar con Supabase: ${error.message || error}`);
      if (!device) setBadge(false);
      if (!silent) toast("Error de sincronización");
      throw error;
    }
  }

  function handleDeviceUpdate(next) {
    device = { ...device, ...next };
    renderDevice(device);
    lastSuccessfulSync = Date.now();
    setError("");
  }

  function handleTelemetryInsert(row) {
    const selectedHours = Number($("historyHours").value);
    const cutoff = Date.now() - selectedHours * 3600000;
    telemetry = [...telemetry, row]
      .filter(item => new Date(item.created_at).getTime() >= cutoff)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(-window.LAMP_APP_CONFIG.historyLimit);
    window.LampChart.draw(telemetry);
  }

  async function waitForCommandConfirmation(commandId, type, value, timeoutMs = 12000) {
    const started = Date.now();
    const expectedPower = type === "power" ? Boolean(value) : null;
    const expectedBrightness = type === "brightness" ? Number(value) : null;

    while (Date.now() - started < timeoutMs) {
      const commandRow = await window.LampAPI.getCommand(commandId);
      const confirmedByCommand = Boolean(commandRow?.executed_at);

      const current = await window.LampAPI.getDevice();
      const stateMatches = type === "power"
        ? Boolean(current?.lamp_on) === expectedPower
        : Number(current?.brightness) === expectedBrightness;

      if (confirmedByCommand && stateMatches) {
        return { confirmed: true, command: commandRow, device: current };
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return { confirmed: false };
  }

  async function command(type, value, successMessage) {
    setControlsBusy(true);
    setSync("Enviando comando al ESP32…");
    try {
      const commandRow = await window.LampAPI.sendCommand(type, value);
      toast("Comando enviado. Esperando confirmación del ESP32…", 3500);

      const result = await waitForCommandConfirmation(commandRow.id, type, value);

      if (result.confirmed) {
        device = result.device;
        renderDevice(device);
        setError("");
        setSync(`Confirmado por ESP32 · ${formatAge(device.last_seen)}`);
        toast(successMessage + " ✓ ESP32 confirmó", 3500);
        return;
      }

      // No declaramos éxito si Supabase no confirma que el ESP32 ejecutó el comando.
      await loadDevice({ silent: true });
      setSync("Comando enviado, pero sin confirmación del ESP32");
      toast("⚠ Comando enviado, pero el ESP32 no confirmó la ejecución", 5000);
      setError("El comando llegó a Supabase, pero todavía no hay confirmación de ejecución del ESP32. Revisá el monitor serial.");
    } catch (error) {
      console.error("[PWA] command", error);
      toast(`No se pudo enviar: ${error.message || "error"}`, 5000);
      setError(`No se pudo enviar el comando: ${error.message || error}`);
      setSync("Error al enviar comando");
    } finally {
      setControlsBusy(false);
    }
  }

  function startRealtime() {
    window.LampRealtime.start(
      handleDeviceUpdate,
      handleTelemetryInsert,
      status => {
        const live = ["SUBSCRIBED", "JOINED"].includes(status);
        if (live) {
          setSync(device?.last_seen ? `Tiempo real activo · ${formatAge(device.last_seen)}` : "Tiempo real activo");
          return;
        }
        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          setSync("Tiempo real no disponible · usando sincronización automática");
        }
      }
    );
  }

  function startPolling() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => refreshAll({ silent: true }).catch(() => {}), window.LAMP_APP_CONFIG.pollMs);

    clearInterval(onlineTimer);
    onlineTimer = setInterval(updateOnlineBadge, 1000);
  }

  function bindEvents() {
    $("toggleBtn").addEventListener("click", () => {
      if (!device) return;
      command("power", !device.lamp_on, device.lamp_on ? "Apagado solicitado" : "Encendido solicitado");
    });

    $("brightness").addEventListener("input", event => {
      $("brightnessValue").textContent = `${event.target.value}%`;
    });

    $("saveBrightness").addEventListener("click", () => {
      const value = Number($("brightness").value);
      command("brightness", value, `Brillo ${value}% solicitado`);
    });

    $("historyHours").addEventListener("change", () => loadHistory().catch(error => {
      console.error(error);
      toast("No se pudo cargar el historial");
    }));

    $("refreshBtn").addEventListener("click", () => refreshAll());

    window.addEventListener("online", () => {
      toast("Conexión restaurada");
      refreshAll({ silent: true }).catch(() => {});
    });

    window.addEventListener("offline", () => {
      setSync("Sin conexión con Internet");
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshAll({ silent: true }).catch(() => {});
    });

    window.addEventListener("resize", () => window.LampChart.draw(telemetry));
  }

  function setupInstallPrompt() {
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      deferredInstallPrompt = event;
      $("installBtn").hidden = false;
    });

    $("installBtn").addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      $("installBtn").hidden = true;
    });
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js?v=3.0.0", { updateViaCache: "none" });
      await registration.update();
    } catch (error) {
      console.warn("[PWA] Service Worker no disponible", error);
    }
  }

  async function start() {
    bindEvents();
    setupInstallPrompt();
    registerServiceWorker();

    if (!window.LampAPI) {
      setError("No se pudo inicializar Supabase.");
      return;
    }

    try {
      setSync(`Conectando a ${cfg.deviceId}…`);
      await refreshAll({ silent: true });
      startRealtime();
      startPolling();
      updateOnlineBadge();
    } catch (error) {
      setBadge(false);
      setSync("Sin sincronización");
      startPolling();
    }
  }

  start();
})();

(function () {
  const {
    $, toast, setError, setBadge, setSync, isOnline, formatAge,
    renderDevice, setControlsBusy, setCommandStatus
  } = window.LampUI;

  const cfg = window.SUPABASE_CONFIG;
  let device = null;
  let telemetry = [];
  let refreshTimer = null;
  let onlineTimer = null;
  let deferredInstallPrompt = null;
  let activeCommand = null;
  let commandTimer = null;
  let realtimeHealthy = false;

  function updateOnlineBadge() {
    setBadge(isOnline(device));
    if (device?.last_seen) {
      setSync(realtimeHealthy
        ? `Tiempo real activo · ${formatAge(device.last_seen)}`
        : `Sincronizado · ${formatAge(device.last_seen)}`);
    }
  }

  async function loadDevice() {
    const data = await window.LampAPI.getDevice();
    device = data;
    renderDevice(device);
    setError("");
    return data;
  }

  async function loadHistory() {
    const hours = Number($("historyHours").value);
    telemetry = await window.LampAPI.getTelemetry(hours);
    window.LampChart.draw(telemetry);
    return telemetry;
  }

  async function refreshAll({ silent = false } = {}) {
    try {
      const results = await Promise.all([loadDevice(), loadHistory()]);
      updateOnlineBadge();
      if (!silent) toast("Datos actualizados");
      return results;
    } catch (error) {
      console.error("[PWA] refreshAll", error);
      setError(`No se pudo sincronizar con Supabase: ${error.message || error}`);
      if (!device) setBadge(false);
      if (!silent) toast("Error de sincronización", 4500);
      throw error;
    }
  }

  function handleDeviceUpdate(next) {
    device = { ...device, ...next };
    renderDevice(device);
    setError("");
    updateOnlineBadge();
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

  function commandExpected(type, value) {
    if (type === "power") return { lamp_on: Boolean(value) };
    const brightness = Number(value);
    return { brightness, lamp_on: brightness > 0 };
  }

  function stateMatches(type, value, current) {
    const expected = commandExpected(type, value);
    if (!current) return false;
    if (type === "power") return Boolean(current.lamp_on) === expected.lamp_on;
    return Number(current.brightness) === expected.brightness && Boolean(current.lamp_on) === expected.lamp_on;
  }

  function finishCommand() {
    clearInterval(commandTimer);
    commandTimer = null;
    activeCommand = null;
    setControlsBusy(false);
  }

  async function confirmCommand(commandRow) {
    const started = Date.now();
    setCommandStatus(
      "waiting",
      `Comando #${commandRow.id} enviado`,
      "Esperando recepción, ejecución y ACK del ESP32…"
    );
    setSync(`Esperando confirmación del comando #${commandRow.id}…`);

    return new Promise(resolve => {
      let finished = false;
      const settle = result => {
        if (finished) return;
        finished = true;
        clearInterval(commandTimer);
        commandTimer = null;
        resolve(result);
      };

      const check = async () => {
        if (Date.now() - started >= window.LAMP_APP_CONFIG.commandTimeoutMs) {
          settle({ confirmed: false, reason: "timeout" });
          return;
        }

        try {
          const row = await window.LampAPI.getCommand(commandRow.id);
          if (!row) return;

          if (row.executed_at) {
            const current = await window.LampAPI.getDevice();
            if (stateMatches(commandRow.type, commandRow.value, current)) {
              settle({ confirmed: true, command: row, device: current });
              return;
            }

            // Hay ACK, pero el estado publicado no coincide: no declarar éxito.
            settle({ confirmed: false, reason: "state_mismatch", command: row, device: current });
          }
        } catch (error) {
          console.warn("[PWA] confirmCommand", error);
        }
      };

      check();
      commandTimer = setInterval(check, window.LAMP_APP_CONFIG.commandPollMs);
    });
  }

  async function command(type, value, successMessage) {
    if (activeCommand) {
      toast("Ya hay un comando esperando confirmación", 3500);
      return;
    }

    setControlsBusy(true);
    activeCommand = { type, value };
    setError("");

    try {
      const commandRow = await window.LampAPI.sendCommand(type, value);
      activeCommand.id = commandRow.id;
      toast(`Comando #${commandRow.id} enviado`, 2500);

      const result = await confirmCommand(commandRow);

      if (result.confirmed) {
        device = result.device;
        renderDevice(device);
        setBadge(true);
        setCommandStatus(
          "success",
          `✓ Comando #${commandRow.id} ejecutado`,
          `${successMessage}. El ESP32 confirmó hardware + estado en Supabase.`
        );
        setSync(`Confirmado por ESP32 · ${formatAge(device.last_seen)}`);
        toast(`${successMessage} ✓ Confirmado`, 4000);
        finishCommand();
        return;
      }

      await loadDevice().catch(() => {});
      setCommandStatus(
        "error",
        `⚠ Comando #${commandRow.id} sin confirmación`,
        result.reason === "state_mismatch"
          ? "Supabase marcó el comando como ejecutado, pero el estado publicado no coincide con lo solicitado."
          : "El comando está en Supabase, pero el ESP32 no confirmó su ejecución dentro del tiempo esperado."
      );
      setSync(`Sin confirmación del comando #${commandRow.id}`);
      setError("No se puede afirmar que la acción impactó correctamente en la lámpara. Revisá el monitor serial y la fila commands en Supabase.");
      toast("⚠ No hubo confirmación del ESP32", 5000);
    } catch (error) {
      console.error("[PWA] command", error);
      setCommandStatus("error", "✕ No se pudo enviar", error.message || "Error desconocido");
      setError(`No se pudo enviar el comando: ${error.message || error}`);
      setSync("Error al enviar comando");
      toast("Error al enviar comando", 5000);
    } finally {
      finishCommand();
    }
  }

  function handleCommandUpdate(row) {
    // El polling sigue siendo la fuente de verdad; Realtime solo acelera la UI.
    if (!activeCommand || row.id !== activeCommand.id) return;
  }

  function startRealtime() {
    window.LampRealtime.start({
      onDevice: handleDeviceUpdate,
      onTelemetry: handleTelemetryInsert,
      onCommand: handleCommandUpdate,
      onStatus: status => {
        realtimeHealthy = ["SUBSCRIBED", "JOINED"].includes(status);
        if (realtimeHealthy) {
          setSync(device?.last_seen ? `Tiempo real activo · ${formatAge(device.last_seen)}` : "Tiempo real activo");
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          setSync("Realtime no disponible · sincronización REST activa");
        }
      },
      onError: error => console.warn("[PWA] Realtime", error)
    });
  }

  function startPolling() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => refreshAll({ silent: true }).catch(() => {}), window.LAMP_APP_CONFIG.devicePollMs);

    clearInterval(onlineTimer);
    onlineTimer = setInterval(updateOnlineBadge, 1000);
  }

  function bindEvents() {
    $("toggleBtn").addEventListener("click", () => {
      if (!device) return;
      const next = !Boolean(device.lamp_on);
      command("power", next, next ? "Encendido aplicado" : "Apagado aplicado");
    });

    $("brightness").addEventListener("input", event => {
      $("brightnessValue").textContent = `${event.target.value}%`;
    });

    $("saveBrightness").addEventListener("click", () => {
      const value = Number($("brightness").value);
      command("brightness", value, `Brillo ${value}% aplicado`);
    });

    $("historyHours").addEventListener("change", () => loadHistory().catch(() => toast("No se pudo cargar el historial", 4000)));
    $("refreshBtn").addEventListener("click", () => refreshAll().catch(() => {}));

    window.addEventListener("online", () => {
      toast("Conexión restaurada");
      refreshAll({ silent: true }).catch(() => {});
    });

    window.addEventListener("offline", () => {
      realtimeHealthy = false;
      setBadge(false);
      setSync("Sin conexión de red");
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
      const registration = await navigator.serviceWorker.register(`./service-worker.js?v=${window.LAMP_APP_CONFIG.version}`, {
        updateViaCache: "none"
      });
      await registration.update();
    } catch (error) {
      console.warn("[PWA] Service Worker no disponible", error);
    }
  }

  async function start() {
    bindEvents();
    setupInstallPrompt();
    registerServiceWorker();

    try {
      setSync(`Conectando a ${cfg.deviceId}…`);
      await refreshAll({ silent: true });
      startRealtime();
      startPolling();
      updateOnlineBadge();
      setCommandStatus("idle", "Sin comandos recientes", "La confirmación real aparecerá aquí después de cada acción.");
    } catch (error) {
      setBadge(false);
      setSync("Sin sincronización");
      startRealtime();
      startPolling();
    }
  }

  start();
})();

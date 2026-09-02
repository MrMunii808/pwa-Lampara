(function () {
  const $ = id => document.getElementById(id);

  function toast(message, duration = 2600) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), duration);
  }

  function setError(message) {
    const el = $("errorBanner");
    el.textContent = message || "";
    el.hidden = !message;
  }

  function setBadge(online) {
    const el = $("connectionBadge");
    el.className = `badge ${online ? "online" : "offline"}`;
    el.textContent = online ? "● ESP32 conectado" : "● ESP32 desconectado";
  }

  function setSync(message) {
    $("syncStatus").textContent = message;
  }

  function isOnline(device) {
    if (!device?.last_seen) return false;
    const timestamp = new Date(device.last_seen).getTime();
    return Number.isFinite(timestamp) && Date.now() - timestamp < window.LAMP_APP_CONFIG.onlineWindowMs;
  }

  function formatNumber(value, unit = "", decimals = 1) {
    if (value === null || value === undefined || value === "") return "—";
    const number = Number(value);
    return Number.isFinite(number) ? `${number.toFixed(decimals)}${unit}` : "—";
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "medium" });
  }

  function formatAge(value) {
    if (!value) return "sin datos";
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return "sin datos";
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 2) return "ahora";
    if (seconds < 60) return `hace ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `hace ${minutes} min`;
    return `hace ${Math.floor(minutes / 60)} h`;
  }

  function renderDevice(device) {
    if (!device) {
      $("deviceName").textContent = "No encontrado";
      setBadge(false);
      setSync("El dispositivo no existe en Supabase");
      return;
    }

    $("deviceName").textContent = device.name || device.device_id;
    $("deviceId").textContent = device.device_id || "—";
    $("lampState").textContent = device.lamp_on ? "Encendida" : "Apagada";
    $("lampIcon").classList.toggle("on", Boolean(device.lamp_on));
    $("brightness").value = device.brightness ?? 0;
    $("brightnessValue").textContent = `${device.brightness ?? 0}%`;
    $("temperature").textContent = formatNumber(device.temperature, " °C");
    $("voltage").textContent = formatNumber(device.voltage, " V");
    $("current").textContent = formatNumber(device.current, " A");
    $("power").textContent = formatNumber(device.power, " W");
    $("lastSeen").textContent = formatDate(device.last_seen);
    setBadge(isOnline(device));
    setSync(device.last_seen ? `Sincronizado ${formatAge(device.last_seen)}` : "Sin last_seen");

    $("toggleBtn").textContent = device.lamp_on ? "Apagar lámpara" : "Encender lámpara";
    $("toggleBtn").disabled = false;
    $("brightness").disabled = false;
    $("saveBrightness").disabled = false;
  }

  function setControlsBusy(busy) {
    $("toggleBtn").disabled = busy;
    $("saveBrightness").disabled = busy;
  }

  window.LampUI = {
    $, toast, setError, setBadge, setSync, isOnline, formatAge, renderDevice, setControlsBusy
  };
})();

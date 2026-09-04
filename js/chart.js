(function () {
  function draw(data) {
    const canvas = document.getElementById("powerChart");
    const empty = document.getElementById("chartEmpty");
    const ctx = canvas.getContext("2d");
    const width = Math.max(320, canvas.parentElement.clientWidth || 600);
    const height = 240;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const points = (data || []).map(row => ({
      time: new Date(row.created_at).getTime(),
      power: Number(row.power) || 0
    })).filter(p => Number.isFinite(p.time));

    if (!points.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    const max = Math.max(...points.map(p => p.power), 1);
    const pad = { left: 50, right: 14, top: 18, bottom: 30 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const minTime = points[0].time;
    const maxTime = points[points.length - 1].time;
    const timeSpan = Math.max(maxTime - minTime, 1);

    ctx.strokeStyle = "#28334b";
    ctx.lineWidth = 1;
    ctx.font = "12px system-ui";
    ctx.fillStyle = "#8e99b0";

    for (let i = 0; i < 4; i++) {
      const y = pad.top + plotH * i / 3;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillText(`${(max * (1 - i / 3)).toFixed(1)} W`, 4, y + 4);
    }

    ctx.beginPath();
    points.forEach((point, index) => {
      const x = pad.left + ((point.time - minTime) / timeSpan) * plotW;
      const y = pad.top + (1 - point.power / max) * plotH;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#a9bcff";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.fillStyle = "#8e99b0";
    const start = new Date(minTime).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const end = new Date(maxTime).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    ctx.fillText(start, pad.left, height - 8);
    const endWidth = ctx.measureText(end).width;
    ctx.fillText(end, width - pad.right - endWidth, height - 8);
  }

  window.LampChart = Object.freeze({ draw });
})();

const cfg = window.SUPABASE_CONFIG;
const $ = id => document.getElementById(id);
const configured = cfg && !cfg.url.includes("TU-PROYECTO") && !cfg.anonKey.includes("TU_SUPABASE");
let supabaseClient = null;
let device = null;
let telemetry = [];
let deferredInstallPrompt = null;

if (configured) supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);

function toast(message){
  const el=$("toast"); el.textContent=message; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2500);
}
function setBadge(online){
  const el=$("connectionBadge");
  el.className="badge "+(online?"online":"offline");
  el.textContent=online?"● ESP32 conectado":"● ESP32 desconectado";
}
function fmt(v, unit=""){return v === null || v === undefined ? "—" : `${Number(v).toFixed(1)}${unit}`}
function renderDevice(){
  if(!device)return;
  $("deviceName").textContent=device.name || device.device_id;
  $("lampState").textContent=device.lamp_on ? "Encendida" : "Apagada";
  $("lampIcon").classList.toggle("on", !!device.lamp_on);
  $("brightness").value=device.brightness ?? 0;
  $("brightnessValue").textContent=`${device.brightness ?? 0}%`;
  $("temperature").textContent=fmt(device.temperature," °C");
  $("voltage").textContent=fmt(device.voltage," V");
  $("current").textContent=fmt(device.current," A");
  $("power").textContent=fmt(device.power," W");
  $("lastSeen").textContent=device.last_seen ? new Date(device.last_seen).toLocaleString() : "—";
  const recent=device.last_seen && Date.now()-new Date(device.last_seen).getTime()<90000;
  setBadge(recent);
  $("toggleBtn").textContent=device.lamp_on?"Apagar lámpara":"Encender lámpara";
  $("toggleBtn").disabled=false;$("brightness").disabled=false;$("saveBrightness").disabled=false;
}
async function loadDevice(){
  const {data,error}=await supabaseClient.from("devices").select("*").eq("device_id",cfg.deviceId).maybeSingle();
  if(error) throw error;
  device=data; renderDevice();
}
async function loadHistory(){
  const hours=Number($("historyHours").value);
  const since=new Date(Date.now()-hours*3600000).toISOString();
  const {data,error}=await supabaseClient.from("telemetry").select("created_at,power").eq("device_id",cfg.deviceId).gte("created_at",since).order("created_at",{ascending:true}).limit(1000);
  if(error){console.error(error);return}
  telemetry=data||[]; drawChart();
}
function drawChart(){
  const canvas=$("powerChart"),ctx=canvas.getContext("2d"),dpr=devicePixelRatio||1;
  const w=canvas.clientWidth,h=220; canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,w,h);
  if(!telemetry.length){ctx.fillStyle="#7d879d";ctx.font="14px system-ui";ctx.fillText("Todavía no hay datos históricos.",20,35);return}
  const vals=telemetry.map(x=>Number(x.power)||0), max=Math.max(...vals,1), pad={l:10,r:10,t:15,b:28};
  ctx.strokeStyle="#28334b";ctx.lineWidth=1;
  for(let i=0;i<4;i++){const y=pad.t+(h-pad.t-pad.b)*i/3;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke()}
  ctx.beginPath(); telemetry.forEach((p,i)=>{const x=pad.l+(w-pad.l-pad.r)*i/Math.max(telemetry.length-1,1);const y=pad.t+(h-pad.t-pad.b)*(1-(Number(p.power)||0)/max);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle="#a9bcff";ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle="#8e99b0";ctx.font="12px system-ui";ctx.fillText(`${max.toFixed(1)} W`,10,12);ctx.fillText("0 W",10,h-7);
}
async function sendCommand(type,value){
  const {error}=await supabaseClient.from("commands").insert({device_id:cfg.deviceId,type,value});
  if(error){toast("No se pudo enviar el comando");console.error(error);return}
  toast("Comando enviado al ESP32");
}
$("toggleBtn").addEventListener("click",()=>sendCommand("power",device?.lamp_on?false:true));
$("saveBrightness").addEventListener("click",()=>sendCommand("brightness",Number($("brightness").value)));
$("brightness").addEventListener("input",e=>$("brightnessValue").textContent=`${e.target.value}%`);
$("historyHours").addEventListener("change",loadHistory);

async function start(){
  if(!configured){
    setBadge(false); $("deviceName").textContent="Configuración pendiente";
    $("toggleBtn").disabled=true; $("saveBrightness").disabled=true;
    toast("Configura Supabase en js/config.js");
    return;
  }
  try{
    await loadDevice(); await loadHistory();
    supabaseClient.channel("lamp-dashboard")
      .on("postgres_changes",{event:"*",schema:"public",table:"devices",filter:`device_id=eq.${cfg.deviceId}`},payload=>{device=payload.new;renderDevice()})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"telemetry",filter:`device_id=eq.${cfg.deviceId}`},payload=>{telemetry.push(payload.new);drawChart()})
      .subscribe();
    setInterval(async()=>{try{await loadDevice()}catch(e){setBadge(false)}},30000);
  }catch(e){console.error(e);toast("Error conectando con Supabase")}
}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;$("installBtn").hidden=false});
$("installBtn").addEventListener("click",async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();deferredInstallPrompt=null;$("installBtn").hidden=true});
if("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js").catch(console.error);
start();
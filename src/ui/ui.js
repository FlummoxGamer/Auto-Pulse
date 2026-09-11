import { CONFIG } from '../core/config.js';

const VERSION = '1.0.0';
const LOGO_URL = 'https://cdn.jsdelivr.net/gh/FlummoxGamer/Auto-Pulse@main/assets/logo.png';

let callbacks = { start: null, stop: null, isRunning: () => false, resetBankroll: null };
let panel = null;
let btn = null;
let startBtn = null;
let statusRing = null;
let runtimeEl = null;
let logsEl = null;
let trackerEl = null;
let statusTextEl = null;
let runtimeSec = 0;
let runtimeTimer = null;
let commandStates = {
  hunt: 'idle',
  battle: 'idle',
  coinflip: 'idle',
  pray: 'idle',
  autoGems: 'idle',
  autoItems: 'idle',
  keepAlive: 'idle'
};
const rowEls = {};

export function initUI(handlers) {
  callbacks = { ...callbacks, ...handlers };
  createUI();
  startRuntimeTimer();
  restorePanelPosition();
}

function makeWavePath(state) {
  if (state === 'running') {
    return `<path d="M0,6 L4,6 L6,2 L8,10 L10,6 L20,6 L22,2 L24,10 L26,6 L36,6 L38,2 L40,10 L42,6"
      fill="none" stroke="#00ff88" stroke-width="1.5"
      stroke-dasharray="60" stroke-dashoffset="0"
      style="animation: ap-pulse 1.5s linear infinite;"/>`;
  }
  if (state === 'error') {
    return `
      <line x1="0" y1="6" x2="15" y2="6" stroke="#ff3355" stroke-width="1.5"/>
      <text x="17" y="10" fill="#ff3355" font-size="12" font-weight="bold">×</text>
      <line x1="25" y1="6" x2="42" y2="6" stroke="#ff3355" stroke-width="1.5"/>
    `;
  }
  return `<line x1="0" y1="6" x2="42" y2="6" stroke="#555566" stroke-width="1.5"/>`;
}

export function createUI() {
  btn = document.createElement('img');
  btn.id = 'ap-ui-btn';
  btn.src = LOGO_URL;
  btn.style.cssText = `
    position:fixed;bottom:90px;right:20px;width:56px;height:56px;
    border-radius:50%;cursor:pointer;z-index:9999;
    border:2px solid transparent;
    background:linear-gradient(#0d0d14,#0d0d14) padding-box,
               conic-gradient(from 0deg, #00ff88, #00d9ff, #a855f7, #ff3355, #00ff88) border-box;
    animation: ap-rgb 6s linear infinite;
    box-shadow:0 4px 12px rgba(0,255,136,0.35);
    object-fit:cover;
  `;
  document.body.appendChild(btn);

  panel = document.createElement('div');
  panel.id = 'ap-ui-panel';
  panel.style.cssText = `
    position:fixed;bottom:160px;right:20px;width:520px;
    background:#0d0d14;color:#eee;z-index:9998;
    border-radius:14px;padding:14px;
    font-family:system-ui,Arial,sans-serif;
    display:none;
    border:2px solid transparent;
    background-image:linear-gradient(#0d0d14,#0d0d14),
                     conic-gradient(from 0deg, #00ff88, #00d9ff, #a855f7, #ff3355, #00ff88);
    background-origin:border-box;
    background-clip:padding-box, border-box;
    animation: ap-rgb 8s linear infinite;
    box-shadow:0 8px 30px rgba(0,0,0,0.6);
  `;

  panel.innerHTML = `
    <style>
      @keyframes ap-rgb { 0%{filter:hue-rotate(0deg)} 100%{filter:hue-rotate(360deg)} }
      @keyframes ap-pulse { 0%{stroke-dashoffset:0} 100%{stroke-dashoffset:-60} }
      @keyframes ap-line-dash { 0%{stroke-dashoffset:0} 100%{stroke-dashoffset:-24} }
      .ap-grid { display:grid; grid-template-columns: 160px 1fr 160px; gap:10px;
        grid-template-areas:
          "status logo runtime"
          "core buttons tracker"
          "core logs logs"; }
      .ap-card { background:#15161c; border:1px solid #232530; border-radius:10px; padding:10px; }
      .ap-title-bar { display:flex; flex-direction:column; align-items:center; margin-bottom:10px; cursor:grab; user-select:none;}
      .ap-title-bar:active { cursor:grabbing; }
      .ap-title { font-size:22px; font-weight:800; letter-spacing:3px;
        background:linear-gradient(90deg,#00ff88,#00d9ff); -webkit-background-clip:text;
        background-clip:text; color:transparent; }
      .ap-title-pulse { width:200px; height:14px; margin-top:2px; }
      .ap-title-pulse path { fill:none; stroke:#00ff88; stroke-width:1.5;
        stroke-dasharray:24; animation: ap-line-dash 1.5s linear infinite; }
      .ap-toggle-row { display:flex; align-items:center; gap:6px; padding:5px 0; font-size:12px;}
      .ap-switch { position:relative; width:28px; height:14px; background:#333; border-radius:7px; cursor:pointer; transition:0.2s; flex-shrink:0;}
      .ap-switch.on { background:#00ff88; }
      .ap-switch::after { content:''; position:absolute; top:1px; left:1px; width:12px; height:12px;
        background:#fff; border-radius:50%; transition:0.2s;}
      .ap-switch.on::after { left:15px; }
      .ap-wave { flex:1; height:14px; min-width:0; }
      .ap-btn { border:none; border-radius:6px; padding:10px 12px; cursor:pointer; font-weight:600; flex:1; font-size:13px;}
      .ap-start { background:#00ff88; color:#0d0d14;}
      .ap-start.stop { background:#ff3355; color:#fff;}
      .ap-reset { background:#f39c12; color:#0d0d14;}
      .ap-logs { height:100%; min-height:120px; overflow-y:auto; font-family:monospace; font-size:11px; line-height:1.4;}
      .ap-log-info { color:#8aa; }
      .ap-log-success { color:#00ff88; }
      .ap-log-warn { color:#ffcc00; }
      .ap-log-error { color:#ff3355; }
      .ap-status-ring { width:90px; height:90px; display:block; margin:0 auto;}
      .ap-status-ring circle { fill:none; stroke-width:6; }
      .ap-status-bg { stroke:#232530; }
      .ap-status-fg { stroke:#00ff88; stroke-linecap:round; transform:rotate(-90deg); transform-origin:50% 50%; transition:stroke-dashoffset 0.5s;}
      .ap-status-line { display:flex; align-items:center; gap:6px; justify-content:flex-start; margin-top:8px;}
      .ap-status-dot { width:14px; height:14px; border-radius:50%; background:#ff3355; flex-shrink:0;}
      .ap-status-dot.on { background:#00ff88; }
      .ap-status-ver { font-size:12px; color:#8aa; }
    </style>

    <div class="ap-title-bar" id="ap-drag-handle">
      <div class="ap-title">AUTO PULSE</div>
      <svg class="ap-title-pulse" viewBox="0 0 200 14" preserveAspectRatio="none">
        <path d="M0,7 L20,7 L25,2 L30,12 L35,7 L70,7 L75,2 L80,12 L85,7 L120,7 L125,2 L130,12 L135,7 L170,7 L175,2 L180,12 L185,7 L200,7"/>
      </svg>
    </div>

    <div class="ap-grid">

      <div class="ap-card" style="grid-area:status;">
        <div style="font-size:12px; color:#8aa; margin-bottom:6px;">Status</div>
        <svg class="ap-status-ring" viewBox="0 0 100 100">
          <circle class="ap-status-bg" cx="50" cy="50" r="44"/>
          <circle class="ap-status-fg" cx="50" cy="50" r="44"
            stroke-dasharray="276" stroke-dashoffset="276" id="ap-status-fg"/>
        </svg>
        <div class="ap-status-line">
          <div class="ap-status-dot" id="ap-status-dot"></div>
          <span class="ap-status-ver" id="ap-status-text">Idle • V${VERSION}</span>
        </div>
      </div>

      <div class="ap-card" style="grid-area:core;">
        <div style="font-size:12px; color:#8aa; margin-bottom:6px;">Core commands</div>
        <div id="ap-toggles"></div>
      </div>

      <div class="ap-card" style="grid-area:logo; height:160px; display:flex; align-items:center; justify-content:center;">
        <img id="ap-logo-card" src="${LOGO_URL}" alt="logo" style="max-width:100%; max-height:100%; border-radius:8px;"/>
      </div>

      <div class="ap-card" style="grid-area:buttons; display:flex; gap:8px;">
        <button class="ap-btn ap-start" id="ap-start-btn">Start</button>
        <button class="ap-btn ap-reset" id="ap-reset-btn">Bankroll reset</button>
      </div>

      <div class="ap-card" style="grid-area:runtime;">
        <div style="font-size:12px; color:#8aa;">Runtime</div>
        <div id="ap-runtime" style="font-size:26px; font-weight:700; text-align:center; color:#00ff88;">00:00:00</div>
      </div>

      <div class="ap-card" style="grid-area:tracker;">
        <div style="font-size:12px; color:#8aa; margin-bottom:6px;">Tracker</div>
        <div id="ap-tracker" style="font-size:12px; line-height:1.7; font-family:monospace;">
          <div>hunt - 0</div>
          <div>battle - 0</div>
          <div>cf - 0/0</div>
          <div>owo - 0</div>
        </div>
      </div>

      <div class="ap-card" style="grid-area:logs; display:flex; flex-direction:column;">
        <div style="font-size:12px; color:#8aa; margin-bottom:6px;">Logs</div>
        <div class="ap-logs" id="ap-logs"></div>
      </div>

    </div>
  `;

  document.body.appendChild(panel);

  startBtn = panel.querySelector('#ap-start-btn');
  startBtn.addEventListener('click', () => {
    if (callbacks.isRunning()) callbacks.stop();
    else callbacks.start();
  });

  panel.querySelector('#ap-reset-btn').addEventListener('click', () => {
    if (callbacks.resetBankroll) callbacks.resetBankroll();
    addLog('Bankroll reset', 'warn');
  });

  logsEl = panel.querySelector('#ap-logs');
  trackerEl = panel.querySelector('#ap-tracker');
  runtimeEl = panel.querySelector('#ap-runtime');
  statusTextEl = panel.querySelector('#ap-status-text');
  statusRing = panel.querySelector('#ap-status-fg');

  buildToggles();

  btn.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  });

  // Event listeners
  window.addEventListener('ap-log', (e) => addLog(e.detail.msg, e.detail.type));
  window.addEventListener('ap-tracker', (e) => updateTracker(e.detail));
  window.addEventListener('ap-runtime', (e) => updateRuntimeUI(e.detail.seconds));
  window.addEventListener('ap-status', (e) => updateStatusUI(e.detail.percent, e.detail.state));
  window.addEventListener('ap-cmd-status', (e) => {
    const { feature, status } = e.detail;
    if (feature in commandStates) {
      commandStates[feature] = status === 'success' ? 'running' : 'error';
      renderCommandIndicator(feature);
    }
  });

  // Draggable
  makeDraggable(panel, panel.querySelector('#ap-drag-handle'));
}

function buildToggles() {
  const container = panel.querySelector('#ap-toggles');
  const items = [
    { label: 'Hunt', key: 'ENABLE_HUNT', stateKey: 'hunt' },
    { label: 'Battle', key: 'ENABLE_BATTLE', stateKey: 'battle' },
    { label: 'Coinflip', key: 'ENABLE_COINFLIP', stateKey: 'coinflip' },
    { label: 'Pray', key: 'ENABLE_PRAY', stateKey: 'pray' },
    { label: 'Auto Gems', key: 'ENABLE_AUTO_GEMS', stateKey: 'autoGems' },
    { label: 'Auto Items', key: 'ENABLE_AUTO_ITEMS', stateKey: 'autoItems' },
    { label: 'Keep Alive', key: 'ENABLE_KEEP_ALIVE', stateKey: 'keepAlive' }
  ];

  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'ap-toggle-row';
    row.innerHTML = `
      <div class="ap-switch ${CONFIG[it.key] ? 'on' : ''}" data-key="${it.key}"></div>
      <span style="flex:0 0 70px;">${it.label}</span>
      <svg class="ap-wave" viewBox="0 0 42 12" preserveAspectRatio="none">
        ${makeWavePath(commandStates[it.stateKey])}
      </svg>
    `;
    const sw = row.querySelector('.ap-switch');
    sw.addEventListener('click', () => {
      CONFIG[it.key] = !CONFIG[it.key];
      sw.classList.toggle('on', CONFIG[it.key]);
      addLog(`${it.label} → ${CONFIG[it.key] ? 'ON' : 'OFF'}`, 'info');
    });
    rowEls[it.stateKey] = row.querySelector('.ap-wave');
    container.appendChild(row);
  });
}

function renderCommandIndicator(stateKey) {
  const svg = rowEls[stateKey];
  if (!svg) return;
  svg.innerHTML = makeWavePath(commandStates[stateKey]);
}

export function resetCommandIndicators() {
  for (const k of Object.keys(commandStates)) {
    commandStates[k] = 'idle';
    renderCommandIndicator(k);
  }
}

export function addLog(msg, type = 'info') {
  if (!logsEl) return;
  const line = document.createElement('div');
  line.className = `ap-log-${type}`;
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
  line.textContent = `[${time}] ${msg}`;
  logsEl.appendChild(line);
  logsEl.scrollTop = logsEl.scrollHeight;
  while (logsEl.children.length > 100) logsEl.removeChild(logsEl.firstChild);
}

export function updateTracker(stats) {
  if (!trackerEl) return;
  trackerEl.innerHTML = `
    <div>hunt - ${stats.hunt || 0}</div>
    <div>battle - ${stats.battle || 0}</div>
    <div>cf - ${stats.cfWins || 0}/${stats.cfTotal || 0}</div>
    <div>owo - ${stats.owo || 0}</div>
  `;
}

export function updateRuntimeUI(seconds) {
  if (!runtimeEl) return;
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  runtimeEl.textContent = `${h}:${m}:${s}`;
}

export function updateStatusUI(percent, state) {
  if (!statusRing || !statusTextEl) return;
  const circumference = 276;
  const offset = circumference - (circumference * percent / 100);
  statusRing.style.strokeDashoffset = offset;

  const dot = document.getElementById('ap-status-dot');
  if (state === 'active') {
    if (dot) dot.classList.add('on');
    statusTextEl.textContent = `Active • V${VERSION}`;
    statusTextEl.style.color = '#00ff88';
  } else if (state === 'error') {
    if (dot) dot.classList.remove('on');
    statusTextEl.textContent = `Error • V${VERSION}`;
    statusTextEl.style.color = '#ff3355';
  } else {
    if (dot) dot.classList.remove('on');
    statusTextEl.textContent = `Idle • V${VERSION}`;
    statusTextEl.style.color = '#8aa';
  }
}

export function updateStartStopButton(isRunning) {
  if (!startBtn) return;
  startBtn.textContent = isRunning ? 'Stop' : 'Start';
  startBtn.classList.toggle('stop', isRunning);
}

function startRuntimeTimer() {
  if (runtimeTimer) clearInterval(runtimeTimer);
  runtimeTimer = setInterval(() => {
    if (callbacks.isRunning()) {
      runtimeSec++;
      window.dispatchEvent(new CustomEvent('ap-runtime', { detail: { seconds: runtimeSec } }));
    }
  }, 1000);
}

export function resetRuntime() {
  runtimeSec = 0;
  updateRuntimeUI(0);
}

// --- Draggable panel ---
function makeDraggable(el, handle) {
  let dragging = false;
  let startX = 0, startY = 0, origLeft = 0, origTop = 0;

  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    const rect = el.getBoundingClientRect();
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    startX = e.clientX;
    startY = e.clientY;
    origLeft = rect.left;
    origTop = rect.top;
    e.preventDefault();
  });

  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.left = (origLeft + dx) + 'px';
    el.style.top = (origTop + dy) + 'px';
  });

  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    try {
      GM_setValue('panel_pos', { left: el.style.left, top: el.style.top });
    } catch (e) {}
  });
}

function restorePanelPosition() {
  try {
    const pos = GM_getValue('panel_pos', null);
    if (pos && pos.left && pos.top) {
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.left = pos.left;
      panel.style.top = pos.top;
    }
  } catch (e) {}
    }

import { CONFIG } from '../core/config.js';

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

const LOGO_URL = 'https://raw.githubusercontent.com/FlummoxGamer/Auto-Pulse/main/assets/logo.png';

export function initUI(handlers) {
  callbacks = { ...callbacks, ...handlers };
  createUI();
  startRuntimeTimer();
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
      @keyframes ap-heartbeat { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
      @keyframes ap-pulse { 0%{stroke-dashoffset:0} 100%{stroke-dashoffset:-40} }
      .ap-grid { display:grid; grid-template-columns: 160px 1fr 160px; gap:10px; }
      .ap-card { background:#15161c; border:1px solid #232530; border-radius:10px; padding:10px; }
      .ap-title { font-size:20px; text-align:center; font-weight:700; letter-spacing:2px;
        background:linear-gradient(90deg,#00ff88,#00d9ff); -webkit-background-clip:text;
        background-clip:text; color:transparent; margin-bottom:8px;}
      .ap-heart { display:inline-block; color:#ff3355; animation: ap-heartbeat 1s infinite; }
      .ap-toggle-row { display:flex; align-items:center; gap:6px; padding:4px 0; font-size:12px;}
      .ap-switch { position:relative; width:28px; height:14px; background:#333; border-radius:7px; cursor:pointer; transition:0.2s;}
      .ap-switch.on { background:#00ff88; }
      .ap-switch::after { content:''; position:absolute; top:1px; left:1px; width:12px; height:12px;
        background:#fff; border-radius:50%; transition:0.2s;}
      .ap-switch.on::after { left:15px; }
      .ap-wave { flex:1; height:12px; }
      .ap-btn { border:none; border-radius:6px; padding:8px 12px; cursor:pointer; font-weight:600;}
      .ap-start { background:#00ff88; color:#0d0d14; flex:1;}
      .ap-start.stop { background:#ff3355; color:#fff;}
      .ap-reset { background:#f39c12; color:#0d0d14; }
      .ap-logs { height:120px; overflow-y:auto; font-family:monospace; font-size:11px; line-height:1.4;}
      .ap-log-info { color:#8aa; }
      .ap-log-success { color:#00ff88; }
      .ap-log-warn { color:#ffcc00; }
      .ap-log-error { color:#ff3355; }
      .ap-status-ring { width:90px; height:90px; display:block; margin:0 auto;}
      .ap-status-ring circle { fill:none; stroke-width:6; }
      .ap-status-bg { stroke:#232530; }
      .ap-status-fg { stroke:#00ff88; stroke-linecap:round; transform:rotate(-90deg); transform-origin:50% 50%; transition:stroke-dashoffset 0.5s;}
    </style>

    <div class="ap-title">AUTO PULSE <span class="ap-heart">♥</span></div>

    <div class="ap-grid">

      <!-- LEFT COLUMN -->
      <div style="display:flex; flex-direction:column; gap:10px;">
        <div class="ap-card" id="ap-status-card">
          <div style="font-size:12px; color:#8aa; margin-bottom:6px;">Status</div>
          <svg class="ap-status-ring" viewBox="0 0 100 100">
            <circle class="ap-status-bg" cx="50" cy="50" r="44"/>
            <circle class="ap-status-fg" cx="50" cy="50" r="44"
              stroke-dasharray="276" stroke-dashoffset="276" id="ap-status-fg"/>
          </svg>
          <div id="ap-status-text" style="text-align:center; font-size:12px; margin-top:6px;">
            <span style="color:#8aa;">● Idle V1.0</span>
          </div>
        </div>
        <div class="ap-card" style="flex:1;">
          <div style="font-size:12px; color:#8aa; margin-bottom:6px;">Core commands</div>
          <div id="ap-toggles"></div>
        </div>
      </div>

      <!-- CENTER COLUMN -->
      <div style="display:flex; flex-direction:column; gap:10px;">
        <div class="ap-card" style="height:160px; display:flex; align-items:center; justify-content:center;">
          <img id="ap-logo-card" src="${LOGO_URL}" alt="logo" style="max-width:100%; max-height:100%; border-radius:8px;"/>
        </div>
        <div class="ap-card" style="display:flex; gap:8px;">
          <button class="ap-btn ap-start" id="ap-start-btn">Start</button>
          <button class="ap-btn ap-reset" id="ap-reset-btn">Bankroll reset</button>
        </div>
        <div class="ap-card" style="flex:1;">
          <div style="font-size:12px; color:#8aa; margin-bottom:6px;">Logs</div>
          <div class="ap-logs" id="ap-logs"></div>
        </div>
      </div>

      <!-- RIGHT COLUMN -->
      <div style="display:flex; flex-direction:column; gap:10px;">
        <div class="ap-card">
          <div style="font-size:12px; color:#8aa;">Runtime</div>
          <div id="ap-runtime" style="font-size:26px; font-weight:700; text-align:center; color:#00ff88;">00:00</div>
        </div>
        <div class="ap-card" style="flex:1;">
          <div style="font-size:12px; color:#8aa; margin-bottom:6px;">Tracker</div>
          <div id="ap-tracker" style="font-size:12px; line-height:1.7; font-family:monospace;">
            <div>hunt - 0</div>
            <div>battle - 0</div>
            <div>cf - 0/0</div>
            <div>owo - 0</div>
          </div>
        </div>
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

  window.addEventListener('ap-log', (e) => addLog(e.detail.msg, e.detail.type));
  window.addEventListener('ap-tracker', (e) => updateTracker(e.detail));
  window.addEventListener('ap-runtime', (e) => updateRuntimeUI(e.detail.seconds));
  window.addEventListener('ap-status', (e) => updateStatusUI(e.detail.percent, e.detail.state));
}

function buildToggles() {
  const container = panel.querySelector('#ap-toggles');
  const items = [
    { label: 'Hunt', key: 'ENABLE_HUNT' },
    { label: 'Battle', key: 'ENABLE_BATTLE' },
    { label: 'Coinflip', key: 'ENABLE_COINFLIP' },
    { label: 'Pray', key: 'ENABLE_PRAY' },
    { label: 'Auto Gems', key: 'ENABLE_AUTO_GEMS' },
    { label: 'Auto Items', key: 'ENABLE_AUTO_ITEMS' },
    { label: 'Keep Alive', key: 'ENABLE_KEEP_ALIVE' }
  ];

  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'ap-toggle-row';
    row.innerHTML = `
      <div class="ap-switch ${CONFIG[it.key] ? 'on' : ''}" data-key="${it.key}"></div>
      <span style="flex:0 0 70px;">${it.label}</span>
      <svg class="ap-wave" viewBox="0 0 40 12" preserveAspectRatio="none">
        <path d="M0,6 L5,6 L7,2 L9,10 L11,6 L20,6 L22,2 L24,10 L26,6 L40,6"
          fill="none" stroke="#00ff88" stroke-width="1.5"
          stroke-dasharray="40" stroke-dashoffset="0"
          style="animation: ap-pulse 1.5s linear infinite;"/>
      </svg>
    `;
    const sw = row.querySelector('.ap-switch');
    sw.addEventListener('click', () => {
      CONFIG[it.key] = !CONFIG[it.key];
      sw.classList.toggle('on', CONFIG[it.key]);
      addLog(`${it.label} → ${CONFIG[it.key] ? 'ON' : 'OFF'}`, 'info');
    });
    container.appendChild(row);
  });
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

  if (state === 'active') {
    statusTextEl.innerHTML = '<span style="color:#00ff88;">● Active V1.0</span>';
  } else if (state === 'error') {
    statusTextEl.innerHTML = '<span style="color:#ff3355;">● Error</span>';
  } else {
    statusTextEl.innerHTML = '<span style="color:#8aa;">● Idle V1.0</span>';
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

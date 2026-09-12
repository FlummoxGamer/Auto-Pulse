import { CONFIG } from '../core/config.js';
import { getRemainingCooldown } from '../systems/cooldown.js';

const FALLBACK_VERSION = '1.0.0';
const VERSION = (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version)
  ? GM_info.script.version
  : FALLBACK_VERSION;

const LOGO_URL = 'https://raw.githubusercontent.com/FlummoxGamer/Auto-Pulse/main/assets/logo.png';

let callbacks = { start: null, stop: null, isRunning: () => false, fullReset: null };
let panelWrap = null;
let panel = null;
let btnWrap = null;
let btn = null;
let btnInner = null;
let startBtn = null;
let statusRing = null;
let runtimeEl = null;
let logsEl = null;
let trackerEl = null;
let statusTextEl = null;
let statusDotEl = null;
let versionEl = null;
let cdHuntEl = null;
let cdBattleEl = null;
let cdCFEl = null;
let runtimeSec = 0;
let runtimeTimer = null;
let cdTimer = null;
let logoBlobUrl = null;

let commandStates = {
  hunt: 'idle', battle: 'idle', coinflip: 'idle', pray: 'idle',
  autoGems: 'idle', autoItems: 'idle', keepAlive: 'idle',
  cash: 'idle', lootbox: 'idle', crate: 'idle'
};
const rowEls = {};

function fetchLogoAsBlob() {
  return new Promise((resolve) => {
    if (typeof GM_xmlhttpRequest === 'undefined') { resolve(null); return; }
    try {
      GM_xmlhttpRequest({
        method: 'GET',
        url: LOGO_URL,
        responseType: 'blob',
        timeout: 10000,
        onload: (res) => {
          if (res.status === 200 && res.response) {
            try { resolve(URL.createObjectURL(res.response)); }
            catch (e) { resolve(null); }
          } else { resolve(null); }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null)
      });
    } catch (e) { resolve(null); }
  });
}

export async function initUI(handlers) {
  callbacks = { ...callbacks, ...handlers };
  createUI();
  startRuntimeTimer();
  startCooldownTimer();
  restorePanelPosition();

  logoBlobUrl = await fetchLogoAsBlob();
  if (logoBlobUrl) {
    const gearImg = document.getElementById('ap-ui-btn');
    const cardImg = document.getElementById('ap-logo-card');
    if (gearImg) { gearImg.src = logoBlobUrl; gearImg.style.display = 'block'; }
    if (btnInner) { btnInner.style.background = '#0d0d14'; }
    if (cardImg) {
      cardImg.src = logoBlobUrl;
      cardImg.style.display = 'block';
      const fallback = cardImg.nextElementSibling;
      if (fallback) fallback.style.display = 'none';
    }
  }
}

function makeWavePath(state) {
  if (state === 'running') {
    return `<path d="M0,6 L4,6 L6,2 L8,10 L10,6 L20,6 L22,2 L24,10 L26,6 L36,6 L38,2 L40,10 L42,6"
      fill="none" stroke="#00ff88" stroke-width="1.8"
      stroke-dasharray="60" stroke-dashoffset="0"
      style="animation: ap-pulse 1.5s linear infinite, ap-hue 3s linear infinite;"/>`;
  }
  if (state === 'error') {
    return `
      <line x1="0" y1="6" x2="14" y2="6" stroke="#ff3355" stroke-width="1.8"/>
      <text x="16" y="10" fill="#ff3355" font-size="13" font-weight="bold">×</text>
      <line x1="26" y1="6" x2="42" y2="6" stroke="#ff3355" stroke-width="1.8"/>`;
  }
  return `<line x1="0" y1="6" x2="42" y2="6" stroke="#4a4a55" stroke-width="1.8"/>`;
}

export function createUI() {
  // GEAR BUTTON
  btnWrap = document.createElement('div');
  btnWrap.id = 'ap-ui-btn-wrap';
  btnWrap.style.cssText = `
    position:fixed;bottom:90px;right:20px;width:60px;height:60px;
    border-radius:50%;cursor:pointer;z-index:9999;
    padding:3px;box-sizing:border-box;
    background:conic-gradient(from 0deg, #00ff88, #00d9ff, #a855f7, #ff3355, #00ff88);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 4px 12px rgba(0,255,136,0.35);
  `;
  btnInner = document.createElement('div');
  btnInner.style.cssText = `
    position:absolute;inset:3px;border-radius:50%;
    background:#0d0d14;display:flex;align-items:center;justify-content:center;overflow:hidden;
  `;
  btn = document.createElement('img');
  btn.id = 'ap-ui-btn';
  btn.src = LOGO_URL;
  btn.style.cssText = `width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;`;
  btn.onerror = () => {
    btn.style.display = 'none';
    btnInner.style.background = 'linear-gradient(135deg, #00ff88, #00d9ff)';
  };
  btnInner.appendChild(btn);
  btnWrap.appendChild(btnInner);
  document.body.appendChild(btnWrap);

  // PANEL
  panelWrap = document.createElement('div');
  panelWrap.id = 'ap-ui-wrap';
  panelWrap.style.cssText = `
    position:fixed;bottom:160px;right:20px;width:540px;
    padding:2px;border-radius:16px;
    background:linear-gradient(#0d0d14,#0d0d14) padding-box,
               conic-gradient(from 0deg, #00ff88, #00d9ff, #a855f7, #ff3355, #00ff88) border-box;
    display:none;z-index:9998;
    box-shadow:0 8px 30px rgba(0,0,0,0.6);
    box-sizing:border-box;
  `;

  panel = document.createElement('div');
  panel.id = 'ap-ui-panel';
  panel.style.cssText = `
    position:relative;
    width:100%;box-sizing:border-box;
    background:#0d0d14;color:#eee;
    border-radius:14px;padding:16px;
    font-family:system-ui,Arial,sans-serif;
  `;

  panel.innerHTML = `
    <style>
      @keyframes ap-pulse { 0%{stroke-dashoffset:0} 100%{stroke-dashoffset:-60} }
      @keyframes ap-hue { 0%{filter:hue-rotate(0deg)} 100%{filter:hue-rotate(360deg)} }
      @keyframes ap-slide-l {
        0%   { opacity: 0; transform: translateX(-60px); }
        25%  { opacity: 1; }
        75%  { opacity: 1; }
        100% { opacity: 0; transform: translateX(30px); }
      }
      @keyframes ap-slide-r {
        0%   { opacity: 0; transform: translateX(60px) scaleX(-1); }
        25%  { opacity: 1; }
        75%  { opacity: 1; }
        100% { opacity: 0; transform: translateX(-30px) scaleX(-1); }
      }
      .ap-grid { display:grid; grid-template-columns: 170px 1fr 170px; gap:10px;
        grid-template-areas:
          "status logo runtime"
          "core buttons tracker"
          "core logs logs"; }
      .ap-card { background:#15161c; border:1px solid #232530; border-radius:10px; padding:10px; box-sizing:border-box; position:relative;}

      /* Corner drag handles */
      .ap-corner { position:absolute; width:26px; height:26px; cursor:move; z-index:20; }
      .ap-corner-tl { top:0; left:0; border-top:3px solid #00ff88; border-left:3px solid #00ff88; border-top-left-radius:14px; }
      .ap-corner-tr { top:0; right:0; border-top:3px solid #00d9ff; border-right:3px solid #00d9ff; border-top-right-radius:14px; }
      .ap-corner-bl { bottom:0; left:0; border-bottom:3px solid #a855f7; border-left:3px solid #a855f7; border-bottom-left-radius:14px; }
      .ap-corner-br { bottom:0; right:0; border-bottom:3px solid #ff3355; border-right:3px solid #ff3355; border-bottom-right-radius:14px; }

      /* Title + corner pulses */
      .ap-title-bar { position:relative; height:44px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; overflow:hidden;}
      .ap-title { font-size:22px; font-weight:800; letter-spacing:4px; z-index:2;
        background:linear-gradient(90deg,#00ff88,#00d9ff); -webkit-background-clip:text;
        background-clip:text; color:transparent; }
      .ap-corner-pulse {
        position:absolute; top:50%; width:110px; height:18px;
        transform:translateY(-50%); pointer-events:none;
      }
      .ap-corner-pulse-l { left:0; animation: ap-slide-l 2.8s ease-in-out infinite; }
      .ap-corner-pulse-r { right:0; animation: ap-slide-r 2.8s ease-in-out infinite; }
      .ap-corner-pulse path { fill:none; stroke:#00ff88; stroke-width:1.6; }

      .ap-toggle-row { display:flex; align-items:center; gap:6px; padding:4px 0; font-size:12px;}
      .ap-switch { position:relative; width:26px; height:13px; background:#333; border-radius:7px; cursor:pointer; transition:0.2s; flex-shrink:0;}
      .ap-switch.on { background:#00ff88; }
      .ap-switch::after { content:''; position:absolute; top:1px; left:1px; width:11px; height:11px;
        background:#fff; border-radius:50%; transition:0.2s;}
      .ap-switch.on::after { left:14px; }
      .ap-switch.hidden { visibility:hidden; }
      .ap-wave { flex:1; height:14px; min-width:0; }

      /* Card buttons */
      .ap-btn { border:1px solid #232530; border-radius:8px; padding:12px 8px; cursor:pointer; font-weight:700;
        flex:1 1 0; min-width:0; font-size:13px; background:#15161c; color:#eee;
        transition:0.2s; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; box-sizing:border-box;}
      .ap-btn:hover { border-color:#00ff88; }
      .ap-start { color:#00ff88; }
      .ap-start.stop { color:#ff3355; border-color:#ff3355; }
      .ap-reset { color:#f39c12; }

      .ap-logs { height:100%; min-height:150px; overflow-y:auto; font-family:monospace; font-size:11px; line-height:1.4;}
      .ap-log-info { color:#8aa; }
      .ap-log-success { color:#00ff88; }
      .ap-log-warn { color:#ffcc00; }
      .ap-log-error { color:#ff3355; }

      .ap-status-ring { width:90px; height:90px; display:block; margin:0 auto;}
      .ap-status-ring circle { fill:none; stroke-width:6; }
      .ap-status-bg { stroke:#232530; }
      .ap-status-fg { stroke:#00ff88; stroke-linecap:round; transform:rotate(-90deg); transform-origin:50% 50%; transition:stroke-dashoffset 0.5s;}
      .ap-status-line { display:flex; align-items:center; gap:8px; justify-content:center; margin-top:8px;}
      .ap-status-dot { width:14px; height:14px; border-radius:50%; background:#ff3355; flex-shrink:0; transition:background 0.2s;}
      .ap-status-dot.on { background:#00ff88; box-shadow:0 0 8px #00ff88; }
      .ap-status-ver { font-size:11px; color:#8aa; }

      .ap-tracker-list { font-size:12px; line-height:1.55; font-family:monospace;}
      .ap-tracker-list .val-pos { color:#00ff88; }
      .ap-tracker-list .val-neg { color:#ff3355; }

      .ap-btn-row { display:flex; gap:8px; height:100%; align-items:stretch;}
      .ap-logo-img { max-width:100%; max-height:100%; border-radius:8px; display:block;}
      .ap-logo-fallback { width:100%; height:100%; border-radius:8px;
        background:linear-gradient(135deg,#00ff88,#00d9ff);
        display:flex; align-items:center; justify-content:center;
        font-size:36px; color:#0d0d14; font-weight:800; }

      .ap-cd-row { display:flex; justify-content:space-between; font-size:11px; color:#8aa; margin-top:3px;}
      .ap-cd-row .ap-cd-val { color:#00ff88; font-family:monospace; }
    </style>

    <div class="ap-corner ap-corner-tl" data-corner="tl"></div>
    <div class="ap-corner ap-corner-tr" data-corner="tr"></div>
    <div class="ap-corner ap-corner-bl" data-corner="bl"></div>
    <div class="ap-corner ap-corner-br" data-corner="br"></div>

    <div class="ap-title-bar">
      <svg class="ap-corner-pulse ap-corner-pulse-l" viewBox="0 0 110 18" preserveAspectRatio="none">
        <path d="M0,9 L20,9 L25,4 L30,14 L35,9 L55,9 L60,4 L65,14 L70,9 L90,9 L95,4 L100,14 L105,9 L110,9"/>
      </svg>
      <div class="ap-title">AUTO PULSE</div>
      <svg class="ap-corner-pulse ap-corner-pulse-r" viewBox="0 0 110 18" preserveAspectRatio="none">
        <path d="M0,9 L20,9 L25,4 L30,14 L35,9 L55,9 L60,4 L65,14 L70,9 L90,9 L95,4 L100,14 L105,9 L110,9"/>
      </svg>
    </div>

    <div class="ap-grid">
      <div class="ap-card" style="grid-area:status;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-size:12px; color:#8aa;">Status</span>
          <span class="ap-status-ver" id="ap-status-version">V${VERSION}</span>
        </div>
        <svg class="ap-status-ring" viewBox="0 0 100 100">
          <circle class="ap-status-bg" cx="50" cy="50" r="44"/>
          <circle class="ap-status-fg" cx="50" cy="50" r="44"
            stroke-dasharray="276" stroke-dashoffset="276" id="ap-status-fg"/>
        </svg>
        <div class="ap-status-line">
          <div class="ap-status-dot" id="ap-status-dot"></div>
          <span class="ap-status-ver" id="ap-status-text">Idle</span>
        </div>
      </div>

      <div class="ap-card" style="grid-area:core;">
        <div style="font-size:12px; color:#8aa; margin-bottom:6px;">Core commands</div>
        <div id="ap-toggles"></div>
      </div>

      <div class="ap-card" style="grid-area:logo; height:160px; display:flex; align-items:center; justify-content:center;">
        <img id="ap-logo-card" class="ap-logo-img" src="${LOGO_URL}" alt="logo"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"/>
        <div class="ap-logo-fallback" style="display:none;">AP</div>
      </div>

      <div class="ap-card" style="grid-area:buttons; min-height:70px;">
        <div class="ap-btn-row">
          <button class="ap-btn ap-start" id="ap-start-btn">Start</button>
          <button class="ap-btn ap-reset" id="ap-reset-btn">Reset</button>
        </div>
      </div>

      <div class="ap-card" style="grid-area:runtime;">
        <div style="font-size:12px; color:#8aa;">Runtime</div>
        <div id="ap-runtime" style="font-size:22px; font-weight:700; text-align:center; color:#00ff88; margin:4px 0;">00:00:00</div>
        <div class="ap-cd-row">Hunt <span class="ap-cd-val" id="ap-cd-hunt">-</span></div>
        <div class="ap-cd-row">Battle <span class="ap-cd-val" id="ap-cd-battle">-</span></div>
        <div class="ap-cd-row">CF <span class="ap-cd-val" id="ap-cd-cf">-</span></div>
      </div>

      <div class="ap-card" style="grid-area:tracker; min-height:70px;">
        <div style="font-size:12px; color:#8aa; margin-bottom:6px;">Tracker</div>
        <div id="ap-tracker" class="ap-tracker-list">
          <div>hunt - 0</div>
          <div>battle - 0</div>
          <div>cf - 0/0</div>
          <div>cash - 0</div>
          <div>profit - <span class="val-pos">+0</span></div>
        </div>
      </div>

      <div class="ap-card" style="grid-area:logs; display:flex; flex-direction:column;">
        <div style="font-size:12px; color:#8aa; margin-bottom:6px;">Logs</div>
        <div class="ap-logs" id="ap-logs"></div>
      </div>
    </div>
  `;

  panelWrap.appendChild(panel);
  document.body.appendChild(panelWrap);

  startBtn = panel.querySelector('#ap-start-btn');
  startBtn.addEventListener('click', () => {
    if (callbacks.isRunning()) callbacks.stop();
    else callbacks.start();
  });

  panel.querySelector('#ap-reset-btn').addEventListener('click', () => {
    if (callbacks.fullReset) callbacks.fullReset();
  });

  logsEl = panel.querySelector('#ap-logs');
  trackerEl = panel.querySelector('#ap-tracker');
  runtimeEl = panel.querySelector('#ap-runtime');
  statusTextEl = panel.querySelector('#ap-status-text');
  statusDotEl = panel.querySelector('#ap-status-dot');
  statusRing = panel.querySelector('#ap-status-fg');
  cdHuntEl = panel.querySelector('#ap-cd-hunt');
  cdBattleEl = panel.querySelector('#ap-cd-battle');
  cdCFEl = panel.querySelector('#ap-cd-cf');
  versionEl = panel.querySelector('#ap-status-version');

  buildToggles();

  btnWrap.addEventListener('click', () => {
    panelWrap.style.display = panelWrap.style.display === 'block' ? 'none' : 'block';
  });

  window.addEventListener('ap-log', (e) => addLog(e.detail.msg, e.detail.type));
  window.addEventListener('ap-tracker', (e) => updateTracker(e.detail));
  window.addEventListener('ap-runtime', (e) => updateRuntimeUI(e.detail.seconds));
  window.addEventListener('ap-status', (e) => updateStatusUI(e.detail.percent, e.detail.state));
  window.addEventListener('ap-cmd-status', (e) => {
    const { feature, status } = e.detail;
    if (feature in commandStates) {
      if (status === 'success') commandStates[feature] = 'running';
      else if (status === 'idle') commandStates[feature] = 'idle';
      else commandStates[feature] = 'error';
      renderCommandIndicator(feature);
    }
  });

  // Attach corner drag handles ONLY
  panel.querySelectorAll('.ap-corner').forEach(h => {
    attachDrag(h);
  });
}

function buildToggles() {
  const container = panel.querySelector('#ap-toggles');
  const items = [
    { label: 'Hunt', key: 'ENABLE_HUNT', stateKey: 'hunt', toggle: true },
    { label: 'Battle', key: 'ENABLE_BATTLE', stateKey: 'battle', toggle: true },
    { label: 'Coinflip', key: 'ENABLE_COINFLIP', stateKey: 'coinflip', toggle: true },
    { label: 'Pray', key: 'ENABLE_PRAY', stateKey: 'pray', toggle: true },
    { label: 'Auto Gems', key: 'ENABLE_AUTO_GEMS', stateKey: 'autoGems', toggle: true },
    { label: 'Auto Items', key: 'ENABLE_AUTO_ITEMS', stateKey: 'autoItems', toggle: true },
    { label: 'Keep Alive', key: 'ENABLE_KEEP_ALIVE', stateKey: 'keepAlive', toggle: true },
    { label: 'Cash', key: null, stateKey: 'cash', toggle: false },
    { label: 'Lootbox', key: null, stateKey: 'lootbox', toggle: false },
    { label: 'Crate', key: null, stateKey: 'crate', toggle: false }
  ];

  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'ap-toggle-row';
    const swHTML = it.toggle
      ? `<div class="ap-switch ${CONFIG[it.key] ? 'on' : ''}" data-key="${it.key}"></div>`
      : `<div class="ap-switch hidden"></div>`;
    row.innerHTML = `
      ${swHTML}
      <span style="flex:0 0 74px;">${it.label}</span>
      <svg class="ap-wave" viewBox="0 0 42 12" preserveAspectRatio="none">
        ${makeWavePath(commandStates[it.stateKey])}
      </svg>
    `;
    if (it.toggle) {
      const sw = row.querySelector('.ap-switch');
      sw.addEventListener('click', () => {
        CONFIG[it.key] = !CONFIG[it.key];
        sw.classList.toggle('on', CONFIG[it.key]);
        addLog(`${it.label} → ${CONFIG[it.key] ? 'ON' : 'OFF'}`, 'info');
      });
    }
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

export function clearLogs() {
  if (logsEl) logsEl.innerHTML = '';
}

export function updateTracker(stats) {
  if (!trackerEl) return;
  const profit = stats.profit || 0;
  const profitStr = profit > 0 ? `+${profit}` : (profit < 0 ? `${profit}` : '+0');
  const profitClass = profit > 0 ? 'val-pos' : (profit < 0 ? 'val-neg' : '');
  trackerEl.innerHTML = `
    <div>hunt - ${stats.hunt || 0}</div>
    <div>battle - ${stats.battle || 0}</div>
    <div>cf - ${stats.cfWins || 0}/${stats.cfTotal || 0}</div>
    <div>cash - ${stats.cash || 0}</div>
    <div>profit - <span class="${profitClass}">${profitStr}</span></div>
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
    if (statusDotEl) statusDotEl.classList.add('on');
    statusTextEl.textContent = 'Active';
    statusTextEl.style.color = '#00ff88';
  } else if (state === 'error') {
    if (statusDotEl) statusDotEl.classList.remove('on');
    statusTextEl.textContent = 'Error';
    statusTextEl.style.color = '#ff3355';
  } else {
    if (statusDotEl) statusDotEl.classList.remove('on');
    statusTextEl.textContent = 'Idle';
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

function startCooldownTimer() {
  if (cdTimer) clearInterval(cdTimer);
  cdTimer = setInterval(() => {
    if (!cdHuntEl) return;
    const h = getRemainingCooldown('owo h');
    const b = getRemainingCooldown('owo b');
    const c = getRemainingCooldown('owo cf');
    cdHuntEl.textContent = h > 0 ? `${h}s` : 'Ready';
    cdBattleEl.textContent = b > 0 ? `${b}s` : 'Ready';
    cdCFEl.textContent = c > 0 ? `${c}s` : 'Ready';
  }, 1000);
}

export function resetRuntime() {
  runtimeSec = 0;
  updateRuntimeUI(0);
}

function attachDrag(handle) {
  let dragging = false;
  let startX = 0, startY = 0, origLeft = 0, origTop = 0;

  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    const rect = panelWrap.getBoundingClientRect();
    panelWrap.style.right = 'auto';
    panelWrap.style.bottom = 'auto';
    panelWrap.style.left = rect.left + 'px';
    panelWrap.style.top = rect.top + 'px';
    startX = e.clientX; startY = e.clientY;
    origLeft = rect.left; origTop = rect.top;
    e.preventDefault();
    e.stopPropagation();
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    panelWrap.style.left = (origLeft + (e.clientX - startX)) + 'px';
    panelWrap.style.top = (origTop + (e.clientY - startY)) + 'px';
  });
  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    try { GM_setValue('panel_pos', { left: panelWrap.style.left, top: panelWrap.style.top }); } catch (e) {}
  });
}

function restorePanelPosition() {
  try {
    const pos = GM_getValue('panel_pos', null);
    if (pos && pos.left && pos.top) {
      panelWrap.style.right = 'auto';
      panelWrap.style.bottom = 'auto';
      panelWrap.style.left = pos.left;
      panelWrap.style.top = pos.top;
    }
  } catch (e) {}
}

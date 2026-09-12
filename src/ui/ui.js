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
let cdHuntEl = null, cdBattleEl = null, cdCFEl = null, cdPrayEl = null, cdItemEl = null;
let runtimeSec = 0;
let runtimeTimer = null;
let cdTimer = null;
let logoBlobUrl = null;

let commandStates = {
  hunt: 'idle', battle: 'idle', coinflip: 'idle', pray: 'idle',
  autoGems: 'idle', autoItems: 'idle', keepAlive: 'idle'
};
const rowEls = {};

function fetchLogoAsBlob() {
  return new Promise((resolve) => {
    if (typeof GM_xmlhttpRequest === 'undefined') { resolve(null); return; }
    try {
      GM_xmlhttpRequest({
        method: 'GET', url: LOGO_URL, responseType: 'blob', timeout: 10000,
        onload: (res) => {
          if (res.status === 200 && res.response) {
            try { resolve(URL.createObjectURL(res.response)); } catch (e) { resolve(null); }
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

function fmtCooldown(sec) {
  if (sec <= 0) return 'Ready';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function createUI() {
  btnWrap = document.createElement('div');
  btnWrap.id = 'ap-ui-btn-wrap';
  btnWrap.style.cssText = `
    position:fixed;bottom:90px;right:20px;width:60px;height:60px;
    border-radius:50%;cursor:pointer;z-index:9999;
    padding:3px;box-sizing:border-box;
    background:conic-gradient(from 0deg, #00ff88, #00d9ff, #a855f7, #ff3355, #00ff88);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 4px 12px rgba(0,255,136,0.35);
    animation: ap-hue 5s linear infinite;
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
    animation: ap-hue 8s linear infinite;
    will-change: transform;
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
      @keyframes ap-card-rgb {
        0%   { filter: hue-rotate(0deg); }
        100% { filter: hue-rotate(360deg); }
      }
      .ap-grid { display:grid; grid-template-columns: 170px 1fr 170px; gap:10px;
        grid-template-areas:
          "status logo runtime"
          "core buttons tracker"
          "core logs logs"; }

      /* RGB border for every card via ::before pseudo element */
      .ap-card {
        position:relative;
        background:#15161c;
        border-radius:12px;
        padding:10px;
        box-sizing:border-box;
      }
      .ap-card::before {
        content:'';
        position:absolute;
        inset:-2px;
        border-radius:14px;
        background:conic-gradient(from 0deg, #00ff88, #00d9ff, #a855f7, #ff3355, #00ff88);
        z-index:-1;
        animation: ap-card-rgb 4s linear infinite;
      }
      .ap-card-inner { position:relative; z-index:1; background:#15161c; border-radius:10px; padding:0; }

      .ap-corner { position:absolute; width:26px; height:26px; cursor:move; z-index:20; touch-action:none; }
      .ap-corner-tl { top:-2px; left:-2px; border-top:3px solid #00ff88; border-left:3px solid #00ff88; border-top-left-radius:14px; }
      .ap-corner-tr { top:-2px; right:-2px; border-top:3px solid #00d9ff; border-right:3px solid #00d9ff; border-top-right-radius:14px; }
      .ap-corner-bl { bottom:-2px; left:-2px; border-bottom:3px solid #a855f7; border-left:3px solid #a855f7; border-bottom-left-radius:14px; }
      .ap-corner-br { bottom:-2px; right:-2px; border-bottom:3px solid #ff3355; border-right:3px solid #ff3355; border-bottom-right-radius:14px; }

      .ap-title-bar { position:relative; height:44px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; overflow:hidden;}
      .ap-title { font-size:22px; font-weight:800; letter-spacing:4px; z-index:2;
        background:linear-gradient(90deg,#00ff88,#00d9ff,#a855f7,#ff3355,#00ff88);
        background-size:300% 100%;
        -webkit-background-clip:text; background-clip:text; color:transparent;
        animation: ap-title-slide 4s linear infinite; }
      @keyframes ap-title-slide {
        0% { background-position: 0% 50%; }
        100% { background-position: 300% 50%; }
      }
      .ap-corner-pulse {
        position:absolute; top:50%; width:110px; height:18px;
        transform:translateY(-50%); pointer-events:none;
      }
      .ap-corner-pulse-l { left:0; animation: ap-slide-l 2.8s ease-in-out infinite; }
      .ap-corner-pulse-r { right:0; animation: ap-slide-r 2.8s ease-in-out infinite; }
      .ap-corner-pulse path { fill:none; stroke:#00ff88; stroke-width:1.6; }

      .ap-toggle-row { display:flex; align-items:center; gap:6px; padding:5px 0; font-size:12px;}
      .ap-switch { position:relative; width:26px; height:13px; background:#333; border-radius:7px; cursor:pointer; transition:0.2s; flex-shrink:0;}
      .ap-switch.on { background:#00ff88; }
      .ap-switch::after { content:''; position:absolute; top:1px; left:1px; width:11px; height:11px;
        background:#fff; border-radius:50%; transition:0.2s;}
      .ap-switch.on::after { left:14px; }
      .ap-wave { flex:1; height:14px; min-width:0; }

      .ap-btn { position:relative; border:1px solid #232530; border-radius:8px; padding:12px 8px;
        cursor:pointer; font-weight:700; flex:1 1 0; min-width:0; font-size:13px;
        background:#15161c; color:#eee; transition:0.2s;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis; box-sizing:border-box;
        z-index:1;}
      .ap-btn::before {
        content:''; position:absolute; inset:-2px; border-radius:10px;
        background:conic-gradient(from 0deg, #00ff88, #00d9ff, #a855f7, #ff3355, #00ff88);
        z-index:-1; animation: ap-card-rgb 4s linear infinite;
      }
      .ap-start { color:#00ff88; }
      .ap-start.stop { color:#ff3355; }

      .ap-logs { height:150px; overflow-y:auto; font-family:monospace; font-size:11px; line-height:1.4; padding-right:4px;}
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
        <div class="ap-card-inner">
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
      </div>

      <div class="ap-card" style="grid-area:core;">
        <div class="ap-card-inner">
          <div style="font-size:12px; color:#8aa; margin-bottom:6px;">Core commands</div>
          <div id="ap-toggles"></div>
        </div>
      </div>

      <div class="ap-card" style="grid-area:logo; height:160px; display:flex; align-items:center; justify-content:center;">
        <div class="ap-card-inner" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
          <img id="ap-logo-card" class="ap-logo-img" src="${LOGO_URL}" alt="logo"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"/>
          <div class="ap-logo-fallback" style="display:none;">AP</div>
        </div>
      </div>

      <div class="ap-card" style="grid-area:buttons; min-height:70px;">
        <div class="ap-card-inner" style="height:100%;">
          <div class="ap-btn-row">
            <button class="ap-btn ap-start" id="ap-start-btn">Start</button>
            <button class="ap-btn ap-reset" id="ap-reset-btn">Reset</button>
          </div>
        </div>
      </div>

      <div class="ap-card" style="grid-area:runtime;">
        <div class="ap-card-inner">
          <div style="font-size:12px; color:#8aa;">Runtime</div>
          <div id="ap-runtime" style="font-size:22px; font-weight:700; text-align:center; color:#00ff88; margin:4px 0;">00:00:00</div>
          <div class="ap-cd-row">Hunt <span class="ap-cd-val" id="ap-cd-hunt">Ready</span></div>
          <div class="ap-cd-row">Battle <span class="ap-cd-val" id="ap-cd-battle">Ready</span></div>
          <div class="ap-cd-row">CF <span class="ap-cd-val" id="ap-cd-cf">Ready</span></div>
          <div class="ap-cd-row">Pray <span class="ap-cd-val" id="ap-cd-pray">Ready</span></div>
          <div class="ap-cd-row">Items <span class="ap-cd-val" id="ap-cd-items">Ready</span></div>
        </div>
      </div>

      <div class="ap-card" style="grid-area:tracker; min-height:70px;">
        <div class="ap-card-inner">
          <div style="font-size:12px; color:#8aa; margin-bottom:6px;">Tracker</div>
          <div id="ap-tracker" class="ap-tracker-list">
            <div>hunt - 0</div>
            <div>battle - 0</div>
            <div>cf - 0/0</div>
            <div>cash - 0</div>
            <div>profit - <span class="val-pos">+0</span></div>
          </div>
        </div>
      </div>

      <div class="ap-card" style="grid-area:logs; display:flex; flex-direction:column;">
        <div class="ap-card-inner" style="display:flex; flex-direction:column; height:100%;">
          <div style="font-size:12px; color:#8aa; margin-bottom:6px;">Logs</div>
          <div class="ap-logs" id="ap-logs"></div>
        </div>
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
  cdPrayEl = panel.querySelector('#ap-cd-pray');
  cdItemEl = panel.querySelector('#ap-cd-items');

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

  panel.querySelectorAll('.ap-corner').forEach(h => attachDrag(h));
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
      <span style="flex:0 0 74px;">${it.label}</span>
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
  while (logsEl.children.length > 200) logsEl.removeChild(logsEl.firstChild);
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
    cdHuntEl.textContent = fmtCooldown(getRemainingCooldown('owo h'));
    cdBattleEl.textContent = fmtCooldown(getRemainingCooldown('owo b'));
    cdCFEl.textContent = fmtCooldown(getRemainingCooldown('owo cf'));
    cdPrayEl.textContent = fmtCooldown(getRemainingCooldown('owo pray'));
    cdItemEl.textContent = fmtCooldown(getRemainingCooldown('owo lb all'));
  }, 1000);
}

export function resetRuntime() {
  runtimeSec = 0;
  updateRuntimeUI(0);
}

// --- Smooth drag using transform ---
function attachDrag(handle) {
  let dragging = false;
  let startX = 0, startY = 0, origX = 0, origY = 0;

  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    const rect = panelWrap.getBoundingClientRect();
    // Lock to current position via left/top, then use transform for drag
    panelWrap.style.right = 'auto';
    panelWrap.style.bottom = 'auto';
    panelWrap.style.left = '0px';
    panelWrap.style.top = '0px';
    panelWrap.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    startX = e.clientX;
    startY = e.clientY;
    origX = rect.left;
    origY = rect.top;
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    panelWrap.style.transform = `translate(${origX + dx}px, ${origY + dy}px)`;
  }, { passive: true });

  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    try {
      const rect = panelWrap.getBoundingClientRect();
      GM_setValue('panel_pos', { left: rect.left + 'px', top: rect.top + 'px' });
    } catch (e) {}
  });
}

function restorePanelPosition() {
  try {
    const pos = GM_getValue('panel_pos', null);
    if (pos && pos.left && pos.top) {
      panelWrap.style.right = 'auto';
      panelWrap.style.bottom = 'auto';
      panelWrap.style.left = '0px';
      panelWrap.style.top = '0px';
      panelWrap.style.transform = `translate(${pos.left}, ${pos.top})`;
    }
  } catch (e) {}
              }

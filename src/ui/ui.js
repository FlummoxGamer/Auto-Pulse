// src/ui/ui.js
export const VERSION = '8.0.0'; // Matches your build version

let panel, statusRing, statusText, statusDot, runtimeText, logsEl, trackerEl;
let huntCdEl, battleCdEl, cfCdEl;
let lastHuntTime = 0, lastBattleTime = 0, lastCFTime = 0;

const LOGO_URL = 'https://raw.githubusercontent.com/FlummoxGamer/Auto-Pulse/main/assets/logo.png';

export function createUI(callbacks) {
  if (document.getElementById('ap-panel')) return;

  panel = document.createElement('div');
  panel.id = 'ap-panel';
  panel.innerHTML = `
    <style>
      #ap-panel {
        position: fixed;
        top: 50px;
        left: 50px;
        width: 360px;
        background: #121212;
        border: 2px solid #2a2a2a;
        border-radius: 12px;
        font-family: 'Courier New', monospace;
        color: #fff;
        z-index: 999999;
        box-shadow: 0 10px 30px rgba(0,0,0,0.8);
        display: flex;
        flex-direction: column;
        user-select: none;
        padding: 10px;
        box-sizing: border-box;
      }
      /* Drag handles */
      .ap-drag-handle {
        position: absolute;
        width: 16px;
        height: 16px;
        background: transparent;
        cursor: move;
        z-index: 1000000;
      }
      .ap-drag-tl { top: 0; left: 0; border-top: 2px solid #00ff88; border-left: 2px solid #00ff88; border-top-left-radius: 10px; }
      .ap-drag-tr { top: 0; right: 0; border-top: 2px solid #00ff88; border-right: 2px solid #00ff88; border-top-right-radius: 10px; }
      .ap-drag-bl { bottom: 0; left: 0; border-bottom: 2px solid #00ff88; border-left: 2px solid #00ff88; border-bottom-left-radius: 10px; }
      .ap-drag-br { bottom: 0; right: 0; border-bottom: 2px solid #00ff88; border-right: 2px solid #00ff88; border-bottom-right-radius: 10px; }

      /* Top Bar Pulse */
      .ap-top-bar {
        position: relative;
        text-align: center;
        font-weight: bold;
        font-size: 20px;
        letter-spacing: 2px;
        color: #ff00ff;
        margin-bottom: 10px;
        overflow: hidden;
        padding: 5px 0;
      }
      .ap-top-bar::before {
        content: '';
        position: absolute;
        top: 50%;
        left: -100%;
        width: 100%;
        height: 2px;
        background: #00ff88;
        animation: pulseLine 2s infinite linear;
      }
      @keyframes pulseLine {
        0% { left: -100%; }
        100% { left: 100%; }
      }

      /* Grid Layout */
      .ap-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px; }
      .ap-block { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; padding: 8px; position: relative; display: flex; flex-direction: column; }
      .ap-block-title { font-size: 11px; color: #888; margin-bottom: 4px; text-transform: uppercase; }
      
      /* Status Block */
      .ap-ring-container { display: flex; justify-content: center; align-items: center; height: 60px; margin: 5px 0; }
      .ap-ring { width: 50px; height: 50px; border-radius: 50%; border: 4px solid #2a2a2a; border-top-color: #00ff88; animation: spin 1s infinite linear; display: none; }
      @keyframes spin { 100% { transform: rotate(360deg); } }
      .ap-status-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; font-size: 11px; }
      .ap-status-left { display: flex; align-items: center; gap: 4px; }
      .ap-dot { width: 8px; height: 8px; border-radius: 50%; background: #ff3355; display: inline-block; }
      
      /* Runtime Block */
      .ap-runtime-text { font-size: 22px; font-weight: bold; color: #ff00ff; text-align: center; margin: 10px 0; }
      .ap-cd-row { display: flex; justify-content: space-between; font-size: 12px; margin-top: 4px; color: #aaa; }
      .ap-cd-val { color: #00ff88; font-weight: bold; }

      /* Core Commands */
      .ap-cmd-list { display: flex; flex-direction: column; gap: 4px; }
      .ap-cmd-item { display: flex; align-items: center; justify-content: space-between; font-size: 12px; }
      .ap-toggle { width: 24px; height: 12px; background: #333; border-radius: 6px; position: relative; cursor: pointer; transition: 0.2s; }
      .ap-toggle.active { background: #00ff88; }
      .ap-toggle::after { content: ''; position: absolute; top: 1px; left: 1px; width: 10px; height: 10px; background: #fff; border-radius: 50%; transition: 0.2s; }
      .ap-toggle.active::after { left: 13px; }

      /* Buttons */
      .ap-btn-container { display: flex; flex-direction: column; gap: 6px; justify-content: center; }
      .ap-btn { padding: 8px; border: none; border-radius: 6px; font-weight: bold; font-size: 14px; cursor: pointer; transition: 0.2s; font-family: inherit; }
      #ap-start-btn { background: #ff00ff; color: #fff; }
      #ap-start-btn:hover { background: #cc00cc; }
      #ap-start-btn.running { background: #333; color: #888; }
      #ap-reset-btn { background: #00ff88; color: #121212; }
      #ap-reset-btn:hover { background: #00cc66; }

      /* Tracker */
      .ap-tracker-list { font-size: 13px; display: flex; flex-direction: column; gap: 4px; }
      .ap-tracker-row { display: flex; justify-content: space-between; }
      .ap-tracker-val { color: #ff00ff; font-weight: bold; }

      /* Logs */
      .ap-logs-block { grid-column: 1 / -1; height: 140px; display: flex; flex-direction: column; }
      .ap-logs { font-size: 12px; overflow-y: auto; flex: 1; padding-right: 4px; scrollbar-width: thin; scrollbar-color: #333 #121212; }
      .ap-logs::-webkit-scrollbar { width: 4px; }
      .ap-logs::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      .ap-log-line { margin-bottom: 2px; line-height: 1.2; word-break: break-all; }
      .ap-log-line.info { color: #00ff88; }
      .ap-log-line.warn { color: #ffaa00; }
      .ap-log-line.error { color: #ff3355; }
    </style>
    
    <div class="ap-drag-handle ap-drag-tl" data-corner="tl"></div>
    <div class="ap-drag-handle ap-drag-tr" data-corner="tr"></div>
    <div class="ap-drag-handle ap-drag-bl" data-corner="bl"></div>
    <div class="ap-drag-handle ap-drag-br" data-corner="br"></div>

    <div class="ap-top-bar">
      <img id="ap-logo" src="${LOGO_URL}" style="height:20px; vertical-align:middle; margin-right:5px;" onerror="this.style.display='none'">
      AUTO PULSE
    </div>

    <div class="ap-grid">
      <!-- Status Block -->
      <div class="ap-block">
        <div class="ap-block-title">Status</div>
        <div class="ap-ring-container"><div class="ap-ring" id="ap-ring"></div></div>
        <div class="ap-status-footer">
          <div class="ap-status-left">
            <span class="ap-dot" id="ap-dot"></span>
            <span id="ap-status-text">Idle</span>
          </div>
          <span id="ap-version">V${VERSION}</span>
        </div>
      </div>

      <!-- Runtime Block -->
      <div class="ap-block">
        <div class="ap-block-title">Runtime</div>
        <div class="ap-runtime-text" id="ap-runtime">00:00:00</div>
        <div class="ap-cd-row">Hunt <span class="ap-cd-val" id="ap-cd-hunt">-</span></div>
        <div class="ap-cd-row">Battle <span class="ap-cd-val" id="ap-cd-battle">-</span></div>
        <div class="ap-cd-row">CF <span class="ap-cd-val" id="ap-cd-cf">-</span></div>
      </div>

      <!-- Buttons Block -->
      <div class="ap-block ap-btn-container">
        <button class="ap-btn" id="ap-start-btn">Start</button>
        <button class="ap-btn" id="ap-reset-btn">Reset</button>
      </div>

      <!-- Core Commands -->
      <div class="ap-block">
        <div class="ap-block-title">Core Commands</div>
        <div class="ap-cmd-list" id="ap-cmd-list"></div>
      </div>

      <!-- Tracker -->
      <div class="ap-block">
        <div class="ap-block-title">Tracker</div>
        <div class="ap-tracker-list" id="ap-tracker">
          <div class="ap-tracker-row">hunt <span class="ap-tracker-val" id="tr-hunt">0</span></div>
          <div class="ap-tracker-row">battle <span class="ap-tracker-val" id="tr-battle">0</span></div>
          <div class="ap-tracker-row">cf <span class="ap-tracker-val" id="tr-cf">0/0</span></div>
          <div class="ap-tracker-row">owo <span class="ap-tracker-val" id="tr-owo">0</span></div>
        </div>
      </div>

      <!-- Logs -->
      <div class="ap-block ap-logs-block">
        <div class="ap-block-title">Logs</div>
        <div class="ap-logs" id="ap-logs"></div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Cache DOM elements
  statusRing = document.getElementById('ap-ring');
  statusText = document.getElementById('ap-status-text');
  statusDot = document.getElementById('ap-dot');
  runtimeText = document.getElementById('ap-runtime');
  logsEl = document.getElementById('ap-logs');
  trackerEl = document.getElementById('ap-tracker');
  huntCdEl = document.getElementById('ap-cd-hunt');
  battleCdEl = document.getElementById('ap-cd-battle');
  cfCdEl = document.getElementById('ap-cd-cf');

  // Initial Status Setup
  updateStatusUI(0, 'idle');

  // Setup Drag Handles
  setupDragHandles();

  // Setup Double Click Reset on Logo
  document.getElementById('ap-logo').addEventListener('dblclick', () => {
    panel.style.left = '50px';
    panel.style.top = '50px';
    GM_setValue('ap-panel-pos', { left: '50px', top: '50px' });
  });

  // Restore saved position
  const savedPos = GM_getValue('ap-panel-pos');
  if (savedPos) {
    panel.style.left = savedPos.left;
    panel.style.top = savedPos.top;
  }

  // Setup Callbacks
  document.getElementById('ap-start-btn').addEventListener('click', callbacks.start);
  document.getElementById('ap-reset-btn').addEventListener('click', callbacks.reset);
}

function setupDragHandles() {
  const handles = document.querySelectorAll('.ap-drag-handle');
  let activeHandle = null;
  let startX, startY, startLeft, startTop;

  handles.forEach(handle => {
    handle.addEventListener('pointerdown', (e) => {
      activeHandle = handle;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = panel.offsetLeft;
      startTop = panel.offsetTop;
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
  });

  document.addEventListener('pointermove', (e) => {
    if (!activeHandle) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    requestAnimationFrame(() => {
      panel.style.left = `${startLeft + dx}px`;
      panel.style.top = `${startTop + dy}px`;
    });
  });

  document.addEventListener('pointerup', (e) => {
    if (activeHandle) {
      activeHandle.releasePointerCapture(e.pointerId);
      activeHandle = null;
      GM_setValue('ap-panel-pos', { left: panel.style.left, top: panel.style.top });
    }
  });
}

export function updateStatusUI(progress, state) {
  if (state === 'running') {
    statusRing.style.display = 'block';
    statusRing.style.borderTopColor = '#00ff88';
    statusText.textContent = 'Running';
    statusDot.style.background = '#00ff88';
  } else if (state === 'idle') {
    statusRing.style.display = 'block';
    statusRing.style.borderTopColor = '#ffaa00';
    statusText.textContent = 'Idle';
    statusDot.style.background = '#ff3355';
  } else {
    statusRing.style.display = 'none';
    statusText.textContent = 'Stopped';
    statusDot.style.background = '#ff3355';
  }
}

export function updateRuntime(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  runtimeText.textContent = `${h}:${m}:${s}`;
}

export function updateTracker(stats) {
  document.getElementById('tr-hunt').textContent = stats.hunt || 0;
  document.getElementById('tr-battle').textContent = stats.battle || 0;
  document.getElementById('tr-cf').textContent = `${stats.cf || 0}/${stats.cfTotal || 0}`;
  document.getElementById('tr-owo').textContent = stats.owo || 0;
}

export function appendLog(text, type = 'info') {
  const line = document.createElement('div');
  line.className = `ap-log-line ${type}`;
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  line.textContent = `[${time}] ${text}`;
  logsEl.appendChild(line);
  logsEl.scrollTop = logsEl.scrollHeight; // Auto-scroll to bottom
}

export function updateCooldowns(hunt, battle, cf) {
  huntCdEl.textContent = hunt > 0 ? `${hunt}s` : '-';
  battleCdEl.textContent = battle > 0 ? `${battle}s` : '-';
  cfCdEl.textContent = cf > 0 ? `${cf}s` : '-';
}

export function setStartButtonState(isRunning) {
  const btn = document.getElementById('ap-start-btn');
  if (isRunning) {
    btn.textContent = 'Stop';
    btn.classList.add('running');
  } else {
    btn.textContent = 'Start';
    btn.classList.remove('running');
  }
}

export function clearLogs() {
  logsEl.innerHTML = '';
}

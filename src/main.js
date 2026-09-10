import { CONFIG, GEM_TYPES } from './core/config.js';
import { getHumanDelay, sleep, sendDiscordMessage, scanChat, sanitizeText, playNotificationSound, triggerNotification, setFeatureStatus, featureStatus, setHardStop, isHardStopped } from './core/utils.js';
import { startKeepAlive, stopKeepAlive } from './core/keepalive.js';
import { playCoinflip } from './games/coinflip.js';
import { bankroll } from './systems/bankroll.js';
import { autoGems, resetGems, detectGemExpiry, markExpired } from './systems/autoGems.js';

let botStarted = false;
let isStartupRunning = false;
let huntTimer = null;
let gambleTimer = null;
let cycleCounter = 0;
let lastPrayTime = 0;
let startStopBtn = null;
const statusDots = {};

// --- Observer ---
let observer = null;

function startObserver() {
  if (observer) observer.disconnect();
  const chatContainer = document.querySelector('ol[class*="scroller"]') || document.querySelector('[class*="scrollerInner"]');
  if (!chatContainer) { console.log('[Auto Pulse] Observer: container not found.'); return; }

  observer = new MutationObserver((mutations) => {
    if (!botStarted || isHardStopped) return;

    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;

        const scan = scanChat(node);

        if (scan && scan.type === 'captcha') {
          console.error('[Auto Pulse] CAPTCHA DETECTED! Hard stopping.');
          playNotificationSound();
          triggerNotification(`Captcha detected! Bot stopped.\nTrigger: "${scan.trigger}"`);
          stopBot();
          return;
        }

        // Gem expiry detection
        if (CONFIG.ENABLE_AUTO_GEMS) {
          const expiryCats = detectGemExpiry(node.innerText || '');
          if (expiryCats) {
            console.log('[AutoGems] Expiry detected, triggering check.');
            markExpired(expiryCats);
            autoGems();
          }
        }
      }
    }
  });

  observer.observe(chatContainer, { childList: true, subtree: true });
  console.log('[Auto Pulse] Observer started.');
}

function stopObserver() { if (observer) { observer.disconnect(); observer = null; } }

// --- Startup Sequence ---
async function runStartupCommands() {
  isStartupRunning = true;
  const commands = ['owo lb all', 'owo wc all', 'owo pray'];
  for (const cmd of commands) {
    if (!botStarted || isHardStopped) return;
    await sendDiscordMessage(cmd, 'startup', true);
    await sleep(getHumanDelay(CONFIG.STARTUP_DELAY_MIN, CONFIG.STARTUP_DELAY_MAX));
  }
  isStartupRunning = false;
}

// --- Hunt/Battle Loop ---
async function huntBattleLoop() {
  if (!botStarted || isStartupRunning || isHardStopped) {
    if (botStarted && !isHardStopped) huntTimer = setTimeout(huntBattleLoop, 3000);
    return;
  }
  await sendDiscordMessage('owo h', 'hunt');
  await sleep(getHumanDelay(CONFIG.HUNT_BATTLE_GAP_MIN, CONFIG.HUNT_BATTLE_GAP_MAX));
  await sendDiscordMessage('owo b', 'battle');
  cycleCounter++;

  if (CONFIG.ENABLE_PRAY && Date.now() - lastPrayTime > CONFIG.PRAY_INTERVAL) {
    await sendDiscordMessage('owo pray', 'pray');
    lastPrayTime = Date.now();
  }
  if (CONFIG.ENABLE_AUTO_ITEMS && cycleCounter % 45 === 0) {
    await sendDiscordMessage('owo lb all', 'autoItems');
    await sleep(getHumanDelay(2500, 4000));
    await sendDiscordMessage('owo wc all', 'autoItems');
  }
  huntTimer = setTimeout(huntBattleLoop, getHumanDelay(CONFIG.HUNT_BATTLE_INTERVAL_MIN, CONFIG.HUNT_BATTLE_INTERVAL_MAX));
}

// --- Gamble Loop ---
async function gambleLoop() {
  if (!botStarted || isStartupRunning || isHardStopped) {
    if (botStarted && !isHardStopped) gambleTimer = setTimeout(gambleLoop, 3000);
    return;
  }
  if (CONFIG.ENABLE_COINFLIP) await playCoinflip();
  gambleTimer = setTimeout(gambleLoop, getHumanDelay(CONFIG.CF_INTERVAL_MIN, CONFIG.CF_INTERVAL_MAX));
}

// --- Start / Stop ---
async function startBot() {
  if (botStarted) return;

  console.log('[Auto Pulse] Running startup safety scan...');
  const startupScan = scanChat();
  if (startupScan && startupScan.type === 'captcha') {
    console.error('[Auto Pulse] CAPTCHA in recent chat! Aborting start.');
    playNotificationSound();
    triggerNotification(`Warning in recent chat! Aborted.\nTrigger: "${startupScan.trigger}"`);
    return;
  }

  botStarted = true;
  setHardStop(false);
  updateStartStopButton();
  resetGems();
  startKeepAlive();
  startObserver();

  await bankroll.init();
  lastPrayTime = Date.now();
  await runStartupCommands();

  // Startup settle delay (5s) - lets pending timers flush
  await sleep(5000);

  huntBattleLoop();
  gambleLoop();
}

function stopBot() {
  botStarted = false;
  isStartupRunning = false;
  setHardStop(true);
  updateStartStopButton();
  stopKeepAlive();
  stopObserver();
  if (huntTimer) clearTimeout(huntTimer);
  if (gambleTimer) clearTimeout(gambleTimer);
}

function updateStartStopButton() {
  if (startStopBtn) {
    startStopBtn.textContent = botStarted ? 'Stop Bot' : 'Start Bot';
    startStopBtn.style.background = botStarted ? '#e74c3c' : '#2ecc71';
  }
}

function updateStatusDots() {
  for (const [feature, dot] of Object.entries(statusDots)) {
    const status = featureStatus[feature] || 'idle';
    dot.style.background = status === 'success' ? '#2ecc71' : status === 'fail' ? '#e74c3c' : '#95a5a6';
  }
}

// --- UI ---
function createUI() {
  const btn = document.createElement('div');
  btn.id = 'ap-ui-btn';
  btn.style.cssText = 'position:fixed;bottom:90px;right:20px;width:50px;height:50px;background:#5865F2;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:9999;box-shadow:0 4px 8px rgba(0,0,0,0.3);color:white;font-size:24px;font-family:Arial,sans-serif;user-select:none;';
  btn.textContent = '⚙️';
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'ap-ui-panel';
  panel.style.cssText = 'position:fixed;bottom:150px;right:20px;background:#2C2F33;border:1px solid #444;border-radius:10px;padding:12px;z-index:9998;display:none;flex-direction:column;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);font-family:Arial,sans-serif;color:white;min-width:170px;';

  startStopBtn = document.createElement('button');
  startStopBtn.textContent = 'Start Bot';
  startStopBtn.style.cssText = 'background:#2ecc71;color:white;border:none;border-radius:5px;padding:8px;cursor:pointer;font-size:14px;width:100%;';
  startStopBtn.addEventListener('click', () => { if (!botStarted) startBot(); else stopBot(); });
  panel.appendChild(startStopBtn);

  const toggles = [
    { label: 'Hunt', key: 'ENABLE_HUNT' }, { label: 'Battle', key: 'ENABLE_BATTLE' },
    { label: 'Coinflip', key: 'ENABLE_COINFLIP' }, { label: 'Pray', key: 'ENABLE_PRAY' },
    { label: 'Auto Gems', key: 'ENABLE_AUTO_GEMS' }, { label: 'Auto Items', key: 'ENABLE_AUTO_ITEMS' },
    { label: 'Keep Alive', key: 'ENABLE_KEEP_ALIVE' }
  ];

  toggles.forEach(t => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px;';
    const dot = document.createElement('span');
    dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:#95a5a6;display:inline-block;margin-right:5px;';
    statusDots[t.key] = dot;
    const label = document.createElement('span');
    label.textContent = t.label;
    label.style.fontSize = '14px';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = CONFIG[t.key];
    checkbox.addEventListener('change', () => {
      CONFIG[t.key] = checkbox.checked;
      if (t.key === 'ENABLE_KEEP_ALIVE') { if (CONFIG[t.key]) startKeepAlive(); else stopKeepAlive(); }
    });
    row.appendChild(dot); row.appendChild(label); row.appendChild(checkbox); panel.appendChild(row);
  });

  window.addEventListener('ap-status-update', updateStatusDots);

  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset Bankroll';
  resetBtn.style.cssText = 'background:#f39c12;color:white;border:none;border-radius:5px;padding:5px;cursor:pointer;font-size:12px;width:100%;';
  resetBtn.addEventListener('click', () => { bankroll.reset(); });
  panel.appendChild(resetBtn);
  document.body.appendChild(panel);
  btn.addEventListener('click', () => { panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex'; updateStatusDots(); });
}

function init() {
  try { if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') Notification.requestPermission().catch(() => {}); } catch (e) {}
  createUI();
}

init();

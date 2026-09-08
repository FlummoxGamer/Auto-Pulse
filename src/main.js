import { CONFIG, GEM_TYPES } from './config.js';
import { getHumanDelay, sleep, sendDiscordMessage, scanChat, triggerAlarm, triggerNotification } from './utils.js';
import { playBlackjack } from './blackjack.js';
import { playCoinflip } from './coinflip.js';
import { bankroll } from './bankroll.js';

let botStarted = false;
let loopTimeout = null;
let audio = null;
let cycleCounter = 0;

function startKeepAlive() {
  if (audio) return;
  try {
    audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
    audio.loop = true;
    audio.volume = 0.01;
    audio.play();
    console.log('[Keep-Alive] Started');
  } catch (e) {}
}

function stopKeepAlive() {
  if (audio) {
    audio.pause();
    audio = null;
  }
}

async function runFarmPipeline() {
  if (!botStarted) return;

  const scanResult = scanChat();
  if (scanResult === 'captcha') {
    triggerAlarm();
    triggerNotification('Captcha detected! Bot paused.');
    stopBot();
    return;
  }
  if (scanResult === 'cooldown') {
    await sleep(30000);
  }

  // Bankroll check (simplified: we only update after each game, not here)
  if (bankroll.isOverBudget()) {
    stopBot();
    triggerNotification('Loss limit reached! Bot stopped.');
    return;
  }
  if (bankroll.isProfitTargetHit()) {
    stopBot();
    triggerNotification('Profit target reached! Bot stopped.');
    return;
  }

  if (CONFIG.ENABLE_HUNT) {
    await sendDiscordMessage('owo h');
    await sleep(getHumanDelay(CONFIG.HUNT_BATTLE_GAP_MIN, CONFIG.HUNT_BATTLE_GAP_MAX));
    if (!botStarted) return;
  }

  if (CONFIG.ENABLE_BATTLE) {
    await sendDiscordMessage('owo b');
    await sleep(CONFIG.HUNT_BATTLE_INTERVAL);
    if (!botStarted) return;
  }

  if (CONFIG.ENABLE_BLACKJACK) {
    await playBlackjack();
    await sleep(getHumanDelay(CONFIG.STEP_DELAY_MIN, CONFIG.STEP_DELAY_MAX));
    if (!botStarted) return;
  }

  if (CONFIG.ENABLE_COINFLIP) {
    await playCoinflip();
    await sleep(getHumanDelay(CONFIG.STEP_DELAY_MIN, CONFIG.STEP_DELAY_MAX));
    if (!botStarted) return;
  }

  if (CONFIG.ENABLE_PRAY && cycleCounter % 15 === 0) {
    await sendDiscordMessage('owo pray');
    await sleep(getHumanDelay(CONFIG.STEP_DELAY_MIN, CONFIG.STEP_DELAY_MAX));
    if (!botStarted) return;
  }

  if (CONFIG.ENABLE_AUTO_ITEMS && cycleCounter % 45 === 0) {
    await sendDiscordMessage('owo lb all');
    await sleep(getHumanDelay(2500, 4000));
    await sendDiscordMessage('owo cr all');
    await sleep(getHumanDelay(CONFIG.STEP_DELAY_MIN, CONFIG.STEP_DELAY_MAX));
    if (!botStarted) return;
  }

  if (CONFIG.ENABLE_AUTO_GEMS && cycleCounter % 20 === 0) {
    // Simple gem equipping (will be refined later)
    await sendDiscordMessage('owo inv');
    await sleep(3000);
    // (full gem parser can be added here later)
  }

  cycleCounter++;
  const delay = getHumanDelay(CONFIG.INTERVAL_MIN, CONFIG.INTERVAL_MAX);
  loopTimeout = setTimeout(runFarmPipeline, delay);
}

function startBot() {
  if (botStarted) return;
  botStarted = true;
  startKeepAlive();
  bankroll.init();
  cycleCounter = 0;
  runFarmPipeline();
}

function stopBot() {
  botStarted = false;
  stopKeepAlive();
  if (loopTimeout) clearTimeout(loopTimeout);
}

function createUI() {
  // Floating button
  const btn = document.createElement('div');
  btn.id = 'ap-ui-btn';
  btn.style.cssText = 'position:fixed;bottom:20px;right:20px;width:50px;height:50px;background:#5865F2;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:9999;box-shadow:0 4px 8px rgba(0,0,0,0.3);color:white;font-size:24px;font-family:Arial,sans-serif;user-select:none;';
  btn.textContent = '⚙️';
  document.body.appendChild(btn);

  // Panel
  const panel = document.createElement('div');
  panel.id = 'ap-ui-panel';
  panel.style.cssText = 'position:fixed;bottom:80px;right:20px;background:#2C2F33;border:1px solid #444;border-radius:10px;padding:12px;z-index:9998;display:none;flex-direction:column;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);font-family:Arial,sans-serif;color:white;min-width:160px;';

  // Start/Stop button
  const startStop = document.createElement('button');
  startStop.textContent = 'Start Bot';
  startStop.style.cssText = 'background:#2ecc71;color:white;border:none;border-radius:5px;padding:8px;cursor:pointer;font-size:14px;width:100%;';
  startStop.addEventListener('click', () => {
    if (!botStarted) {
      startBot();
      startStop.textContent = 'Stop Bot';
      startStop.style.background = '#e74c3c';
    } else {
      stopBot();
      startStop.textContent = 'Start Bot';
      startStop.style.background = '#2ecc71';
    }
  });
  panel.appendChild(startStop);

  // Toggles
  const toggles = [
    { label: 'Hunt', key: 'ENABLE_HUNT' },
    { label: 'Battle', key: 'ENABLE_BATTLE' },
    { label: 'Blackjack', key: 'ENABLE_BLACKJACK' },
    { label: 'Coinflip', key: 'ENABLE_COINFLIP' },
    { label: 'Pray', key: 'ENABLE_PRAY' },
    { label: 'Auto Gems', key: 'ENABLE_AUTO_GEMS' },
    { label: 'Auto Items', key: 'ENABLE_AUTO_ITEMS' }
  ];

  toggles.forEach(t => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px;';
    const label = document.createElement('span');
    label.textContent = t.label;
    label.style.fontSize = '14px';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = CONFIG[t.key];
    checkbox.addEventListener('change', () => {
      CONFIG[t.key] = checkbox.checked;
      console.log(`[UI] ${t.label} -> ${checkbox.checked}`);
    });
    row.appendChild(label);
    row.appendChild(checkbox);
    panel.appendChild(row);
  });

  // Bankroll reset button
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset Bankroll';
  resetBtn.style.cssText = 'background:#f39c12;color:white;border:none;border-radius:5px;padding:5px;cursor:pointer;font-size:12px;width:100%;';
  resetBtn.addEventListener('click', () => {
    bankroll.reset();
    console.log('[UI] Bankroll reset');
  });
  panel.appendChild(resetBtn);

  document.body.appendChild(panel);

  btn.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
  });
}

function init() {
  if (typeof Notification !== 'undefined' && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
  createUI();
  // NO auto-start – bot stays off until user clicks Start
}

init();

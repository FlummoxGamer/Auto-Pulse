import { CONFIG, GEM_TYPES } from './config.js';
import { getHumanDelay, sleep, sendDiscordMessage, scanChat, triggerAlarm, triggerNotification } from './utils.js';
import { playBlackjack } from './blackjack.js';
import { playCoinflip } from './coinflip.js';
import { bankroll } from './bankroll.js';

let botStarted = false;
let loopTimeout = null;
let audio = null;
let cycleCounter = 0;
let lastPrayTime = 0;
let gemCheckCounter = 0;

// Keep-alive toggle
function startKeepAlive() {
  if (!CONFIG.ENABLE_KEEP_ALIVE || audio) return;
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

async function autoGems() {
  await sendDiscordMessage('owo inv');
  await sleep(4000);
  const chat = document.querySelector('ol[class*="scroller"]');
  const msgs = chat ? chat.querySelectorAll('li[class*="message"]') : [];
  const lastMsg = msgs[msgs.length - 1];
  const invText = lastMsg ? lastMsg.innerText : '';

  const ownedGemIds = new Set();
  const gemRegex = /(\d{3})\s*(?:\[|x)?\s*(\d+)/g;
  let match;
  while ((match = gemRegex.exec(invText)) !== null) {
    ownedGemIds.add(match[1]);
  }

  // Use best gems for each category if available
  for (const [category, ids] of Object.entries(GEM_TYPES)) {
    for (const id of ids) {
      if (ownedGemIds.has(id)) {
        await sendDiscordMessage(`owo use ${id}`);
        await sleep(getHumanDelay(2000, 3200));
        break; // use the highest tier we own
      }
    }
  }
  // If no gems found, we'll skip this check for a while (set gemCheckCounter to 0 but the main loop will skip every 20 cycles)
}

async function runFarmPipeline() {
  if (!botStarted) return;

  const scanResult = scanChat();
  if (scanResult === 'captcha') {
    triggerAlarm();
    triggerNotification('Captcha detected! Bot stopped.');
    stopBot();
    return;
  }
  if (scanResult === 'cooldown') {
    await sleep(30000);
  }

  // Bankroll checks
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

  const startTime = Date.now();

  // HUNT + BATTLE every 12 seconds (combined)
  if (CONFIG.ENABLE_HUNT) {
    await sendDiscordMessage('owo h');
    await sleep(getHumanDelay(CONFIG.HUNT_BATTLE_GAP_MIN, CONFIG.HUNT_BATTLE_GAP_MAX));
  }
  if (CONFIG.ENABLE_BATTLE) {
    await sendDiscordMessage('owo b');
    // Wait remainder of 12s cycle
    const elapsed = Date.now() - startTime;
    if (elapsed < CONFIG.HUNT_BATTLE_INTERVAL) {
      await sleep(CONFIG.HUNT_BATTLE_INTERVAL - elapsed);
    }
  }

  // GAMBLING (if enabled) - after hunt/battle cooldown
  if (CONFIG.ENABLE_BLACKJACK && CONFIG.ENABLE_COINFLIP) {
    // alternate between them
    if (cycleCounter % 2 === 0) await playBlackjack();
    else await playCoinflip();
  } else if (CONFIG.ENABLE_BLACKJACK) {
    await playBlackjack();
  } else if (CONFIG.ENABLE_COINFLIP) {
    await playCoinflip();
  }

  // PRAY every 5 minutes (300s)
  if (CONFIG.ENABLE_PRAY && Date.now() - lastPrayTime > CONFIG.PRAY_INTERVAL) {
    await sendDiscordMessage('owo pray');
    lastPrayTime = Date.now();
    await sleep(getHumanDelay(CONFIG.STEP_DELAY_MIN, CONFIG.STEP_DELAY_MAX));
  }

  // AUTO GEMS check every 20 cycles (or based on timer)
  if (CONFIG.ENABLE_AUTO_GEMS && cycleCounter % CONFIG.AUTO_GEMS_CHECK_INTERVAL === 0) {
    await autoGems();
  }

  // AUTO ITEMS (open lootboxes/crates)
  if (CONFIG.ENABLE_AUTO_ITEMS && cycleCounter % 45 === 0) {
    await sendDiscordMessage('owo lb all');
    await sleep(getHumanDelay(2500, 4000));
    await sendDiscordMessage('owo wc all');
    await sleep(getHumanDelay(2500, 4000));
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
  lastPrayTime = Date.now();
  runFarmPipeline();
}

function stopBot() {
  botStarted = false;
  stopKeepAlive();
  if (loopTimeout) clearTimeout(loopTimeout);
}

// UI creation
function createUI() {
  const btn = document.createElement('div');
  btn.id = 'ap-ui-btn';
  btn.style.cssText = 'position:fixed;bottom:20px;right:20px;width:50px;height:50px;background:#5865F2;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:9999;box-shadow:0 4px 8px rgba(0,0,0,0.3);color:white;font-size:24px;font-family:Arial,sans-serif;user-select:none;';
  btn.textContent = '⚙️';
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'ap-ui-panel';
  panel.style.cssText = 'position:fixed;bottom:80px;right:20px;background:#2C2F33;border:1px solid #444;border-radius:10px;padding:12px;z-index:9998;display:none;flex-direction:column;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);font-family:Arial,sans-serif;color:white;min-width:170px;';

  // Start / Stop button
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

  // Toggle list
  const toggles = [
    { label: 'Hunt', key: 'ENABLE_HUNT' },
    { label: 'Battle', key: 'ENABLE_BATTLE' },
    { label: 'Blackjack', key: 'ENABLE_BLACKJACK' },
    { label: 'Coinflip', key: 'ENABLE_COINFLIP' },
    { label: 'Pray', key: 'ENABLE_PRAY' },
    { label: 'Auto Gems', key: 'ENABLE_AUTO_GEMS' },
    { label: 'Auto Items', key: 'ENABLE_AUTO_ITEMS' },
    { label: 'Keep Alive', key: 'ENABLE_KEEP_ALIVE' }
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
      if (t.key === 'ENABLE_KEEP_ALIVE') {
        if (CONFIG[t.key]) startKeepAlive();
        else stopKeepAlive();
      }
      console.log(`[UI] ${t.label} -> ${checkbox.checked}`);
    });
    row.appendChild(label);
    row.appendChild(checkbox);
    panel.appendChild(row);
  });

  // Reset bankroll button
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
  // No auto-start
}

init();

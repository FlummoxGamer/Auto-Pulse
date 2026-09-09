import { CONFIG, GEM_TYPES } from './config.js';
import { getHumanDelay, sleep, sendDiscordMessage, scanChat, triggerAlarm, triggerNotification, setFeatureStatus, featureStatus } from './utils.js';
import { playBlackjack } from './blackjack.js';
import { playCoinflip } from './coinflip.js';
import { bankroll } from './bankroll.js';

let botStarted = false;
let huntTimer = null;
let gambleTimer = null;
let audioCtx = null;
let lastPrayTime = 0;
let startStopBtn = null;
const statusDots = {};

function startKeepAlive() {
  if (!CONFIG.ENABLE_KEEP_ALIVE || audioCtx) return;
  try {
    // Use a tiny silent WAV file as a data URI (allowed by Discord's CSP)
    const silentWav = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    const audio = new Audio(silentWav);
    audio.loop = true;
    audio.volume = 0.01; // inaudible
    audio.play();
    audioCtx = audio;
    console.log('[Keep-Alive] Started with silent WAV (data URI)');
  } catch (e) {
    console.warn('[Keep-Alive] Failed to start');
  }
}

function stopKeepAlive() {
  if (audioCtx) {
    audioCtx.pause();
    audioCtx = null;
  }
}

async function autoGems() {
  const success = await sendDiscordMessage('owo inv', 'autoGems');
  if (!success) return;
  await sleep(4000);
  const chat = document.querySelector('ol[class*="scroller"]');
  const msgs = chat ? chat.querySelectorAll('li[class*="message"]') : [];
  const lastMsg = msgs[msgs.length - 1];
  const invText = lastMsg ? lastMsg.innerText : '';
  const ownedGemIds = new Set();
  const gemRegex = /(\d{3})\s*(?:\[|x)?\s*(\d+)/g;
  let match;
  while ((match = gemRegex.exec(invText)) !== null) ownedGemIds.add(match[1]);
  for (const [category, ids] of Object.entries(GEM_TYPES)) {
    for (const id of ids) {
      if (ownedGemIds.has(id)) {
        const used = await sendDiscordMessage(`owo use ${id}`, 'autoGems');
        if (used) await sleep(getHumanDelay(2000, 3200));
        break;
      }
    }
  }
}

// Separate hunt/battle loop – runs every 12s, never delayed by gambling
async function huntBattleLoop() {
  if (!botStarted) return;

  await sendDiscordMessage('owo h', 'hunt');
  await sleep(getHumanDelay(2000, 2500));
  await sendDiscordMessage('owo b', 'battle');

  // Auto-gem detection when hunting
  const chat = document.querySelector('ol[class*="scroller"]');
  if (chat && chat.innerText.includes("gem expired") && CONFIG.ENABLE_AUTO_GEMS) {
    await autoGems();
  }

  // Pray every 5 minutes
  if (CONFIG.ENABLE_PRAY && Date.now() - lastPrayTime > CONFIG.PRAY_INTERVAL) {
    await sendDiscordMessage('owo pray', 'pray');
    lastPrayTime = Date.now();
  }

  huntTimer = setTimeout(huntBattleLoop, CONFIG.HUNT_BATTLE_INTERVAL);
}

// Separate gambling loop – runs every 30s
async function gambleLoop() {
  if (!botStarted) return;

  if (CONFIG.ENABLE_BLACKJACK && CONFIG.ENABLE_COINFLIP) {
    if (Math.random() < 0.5) await playBlackjack();
    else await playCoinflip();
  } else if (CONFIG.ENABLE_BLACKJACK) {
    await playBlackjack();
  } else if (CONFIG.ENABLE_COINFLIP) {
    await playCoinflip();
  }

  gambleTimer = setTimeout(gambleLoop, CONFIG.BJ_CF_INTERVAL);
}

function startBot() {
  if (botStarted) return;
  botStarted = true;
  startKeepAlive();
  bankroll.init();
  lastPrayTime = Date.now();
  huntBattleLoop();
  gambleLoop();
  updateStartStopButton();
}

function stopBot() {
  botStarted = false;
  stopKeepAlive();
  if (huntTimer) clearTimeout(huntTimer);
  if (gambleTimer) clearTimeout(gambleTimer);
  updateStartStopButton();
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
    dot.title = `${feature}: ${status}`;
  }
}

function createUI() {
  const btn = document.createElement('div');
  btn.id = 'ap-ui-btn';
  // Shifted up: bottom from 20px to 90px so it doesn't overlap textbox icons
  btn.style.cssText = 'position:fixed;bottom:90px;right:20px;width:50px;height:50px;background:#5865F2;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:9999;box-shadow:0 4px 8px rgba(0,0,0,0.3);color:white;font-size:24px;font-family:Arial,sans-serif;user-select:none;';
  btn.textContent = '⚙️';
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'ap-ui-panel';
  // Panel also shifted up
  panel.style.cssText = 'position:fixed;bottom:150px;right:20px;background:#2C2F33;border:1px solid #444;border-radius:10px;padding:12px;z-index:9998;display:none;flex-direction:column;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);font-family:Arial,sans-serif;color:white;min-width:170px;';

  startStopBtn = document.createElement('button');
  startStopBtn.textContent = 'Start Bot';
  startStopBtn.style.cssText = 'background:#2ecc71;color:white;border:none;border-radius:5px;padding:8px;cursor:pointer;font-size:14px;width:100%;';
  startStopBtn.addEventListener('click', () => {
    if (!botStarted) startBot();
    else stopBot();
  });
  panel.appendChild(startStopBtn);

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
    const dot = document.createElement('span');
    dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:#95a5a6;display:inline-block;margin-right:5px;';
    dot.title = 'idle';
    statusDots[t.key] = dot;

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
    });

    row.appendChild(dot);
    row.appendChild(label);
    row.appendChild(checkbox);
    panel.appendChild(row);
  });

  window.addEventListener('ap-status-update', updateStatusDots);

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
    updateStatusDots();
  });
}

function init() {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      Notification.requestPermission().catch(() => {});
    }
  } catch (e) {}
  createUI();
}

init();

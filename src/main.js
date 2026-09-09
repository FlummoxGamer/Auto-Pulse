import { CONFIG, GEM_TYPES } from './config.js';
import { getHumanDelay, sleep, sendDiscordMessage, scanChat, triggerAlarm, triggerNotification, setFeatureStatus, featureStatus } from './utils.js';
import { playBlackjack } from './blackjack.js';
import { playCoinflip } from './coinflip.js';
import { bankroll } from './bankroll.js';

let botStarted = false;
let huntTimer = null;
let gambleTimer = null;
let audioCtx = null;
let cycleCounter = 0;
let lastPrayTime = 0;
let startStopBtn = null;
const statusDots = {};

// Keep-alive audio (real looping audio using a short beep)
function startKeepAlive() {
  if (!CONFIG.ENABLE_KEEP_ALIVE || audioCtx) return;
  try {
    // Generate a valid WAV with a very quiet tone (data URI allowed by CSP)
    const sampleRate = 44100;
    const duration = 1; // 1 second
    const buffer = new ArrayBuffer(44 + sampleRate * duration * 2);
    const view = new DataView(buffer);
    const writeString = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
    writeString(0, 'RIFF'); view.setUint32(4, 36 + sampleRate * duration * 2, true); writeString(8, 'WAVE');
    writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeString(36, 'data'); view.setUint32(40, sampleRate * duration * 2, true);
    // Fill with a very quiet sine wave (volume ~0.005)
    for (let i = 0; i < sampleRate * duration; i++) {
      const sample = Math.sin(2 * Math.PI * 1 * i / sampleRate) * 0.005;
      view.setInt16(44 + i * 2, sample * 32767, true);
    }
    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 1.0; // actual volume is in the sample data
    audio.play();
    audioCtx = audio;
    console.log('[Keep-Alive] Started with quiet tone WAV');
  } catch (e) {
    console.warn('[Keep-Alive] Failed to start:', e);
  }
}

function stopKeepAlive() {
  if (audioCtx) {
    audioCtx.pause();
    audioCtx = null;
  }
}

// Continuous captcha scanner (runs every 1 second)
let captchaScanTimer = null;
function startCaptchaScanner() {
  captchaScanTimer = setInterval(() => {
    if (!botStarted) return;
    const scan = scanChat();
    if (scan === 'captcha') {
      console.error('%c[Auto Pulse] CAPTCHA DETECTED! Hard stopping.', 'color:red;font-weight:bold;');
      triggerNotification('Captcha detected! Bot stopped. Solve it manually.');
      triggerAlarm(); // short alert sound
      stopBot();
    } else if (scan === 'cooldown') {
      // no need to stop for cooldown, just wait
    }
  }, 1000);
}

function stopCaptchaScanner() {
  if (captchaScanTimer) clearInterval(captchaScanTimer);
}

async function autoGems() {
  await sendDiscordMessage('owo inv', 'autoGems');
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
        await sendDiscordMessage(`owo use ${id}`, 'autoGems');
        await sleep(getHumanDelay(2000, 3200));
        break;
      }
    }
  }
}

async function runStartupCommands() {
  await sleep(getHumanDelay(1000, 2000));
  await sendDiscordMessage('owo cash', 'cash');
  await sleep(getHumanDelay(2000, 3000));
  await sendDiscordMessage('owo inv', 'autoGems');
  await sleep(getHumanDelay(2000, 3000));
  await sendDiscordMessage('owo lb all', 'autoItems');
  await sleep(getHumanDelay(2000, 3000));
  await sendDiscordMessage('owo wc all', 'autoItems');
  await sleep(getHumanDelay(2000, 3000));
  await sendDiscordMessage('owo pray', 'pray');
}

async function huntBattleLoop() {
  if (!botStarted) return;

  // Random pre-command pause to mimic human
  await sleep(getHumanDelay(CONFIG.PRE_COMMAND_PAUSE_MIN, CONFIG.PRE_COMMAND_PAUSE_MAX));
  await sendDiscordMessage('owo h', 'hunt');
  await sleep(getHumanDelay(CONFIG.HUNT_BATTLE_GAP_MIN, CONFIG.HUNT_BATTLE_GAP_MAX));
  await sendDiscordMessage('owo b', 'battle');

  cycleCounter++;

  // Recurring commands based on cycle counter (approximate times)
  if (CONFIG.ENABLE_PRAY && Date.now() - lastPrayTime > CONFIG.PRAY_INTERVAL) {
    await sendDiscordMessage('owo pray', 'pray');
    lastPrayTime = Date.now();
  }

  if (CONFIG.ENABLE_AUTO_GEMS && cycleCounter % 20 === 0) {
    await autoGems();
  }

  if (CONFIG.ENABLE_AUTO_ITEMS && cycleCounter % 45 === 0) {
    await sendDiscordMessage('owo lb all', 'autoItems');
    await sleep(getHumanDelay(2500, 4000));
    await sendDiscordMessage('owo wc all', 'autoItems');
  }

  // Next hunt/battle with random interval
  const next = getHumanDelay(CONFIG.HUNT_BATTLE_INTERVAL_MIN, CONFIG.HUNT_BATTLE_INTERVAL_MAX);
  huntTimer = setTimeout(huntBattleLoop, next);
}

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

  const next = getHumanDelay(CONFIG.BJ_CF_INTERVAL_MIN, CONFIG.BJ_CF_INTERVAL_MAX);
  gambleTimer = setTimeout(gambleLoop, next);
}

function startBot() {
  if (botStarted) return;
  botStarted = true;
  startKeepAlive();
  startCaptchaScanner();
  bankroll.init();
  lastPrayTime = Date.now();
  runStartupCommands();
  huntBattleLoop();
  gambleLoop();
  updateStartStopButton();
}

function stopBot() {
  botStarted = false;
  stopKeepAlive();
  stopCaptchaScanner();
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
  btn.style.cssText = 'position:fixed;bottom:90px;right:20px;width:50px;height:50px;background:#5865F2;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:9999;box-shadow:0 4px 8px rgba(0,0,0,0.3);color:white;font-size:24px;font-family:Arial,sans-serif;user-select:none;';
  btn.textContent = '⚙️';
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'ap-ui-panel';
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

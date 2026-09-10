import { CONFIG, GEM_TYPES } from './config.js';
import { getHumanDelay, sleep, sendDiscordMessage, scanChat, sanitizeText, playNotificationSound, triggerNotification, setFeatureStatus, featureStatus, setHardStop, isHardStopped } from './utils.js';
import { playBlackjack } from './blackjack.js';
import { playCoinflip } from './coinflip.js';
import { bankroll } from './bankroll.js';

let botStarted = false;
let isStartupRunning = false;
let huntTimer = null;
let gambleTimer = null;
let audioCtx = null;
let cycleCounter = 0;
let lastPrayTime = 0;
let startStopBtn = null;
const statusDots = {};

// --- MutationObserver for real-time chat scan ---
let observer = null;

function startObserver() {
  if (observer) observer.disconnect();
  const chatContainer = document.querySelector('ol[class*="scroller"]') || document.querySelector('[class*="scrollerInner"]');
  if (!chatContainer) {
    console.log('[Auto Pulse Debug] Observer: Chat container not found.');
    return;
  }
  observer = new MutationObserver(() => {
    if (!botStarted || isHardStopped) return;
    console.log('[Auto Pulse Debug] Observer triggered, scanning chat...');
    const scan = scanChat();
    if (scan === 'captcha') {
      console.error('[Auto Pulse] CAPTCHA DETECTED (real-time)! Hard stopping.');
      playNotificationSound();
      triggerNotification('Captcha detected! Bot stopped.');
      stopBot();
    }
  });
  observer.observe(chatContainer, { childList: true, subtree: true, characterData: true });
  console.log('[Auto Pulse Debug] Observer started.');
}

function stopObserver() {
  if (observer) { observer.disconnect(); observer = null; }
}

// --- Keep-alive (same as before) ---
function startKeepAlive() {
  if (!CONFIG.ENABLE_KEEP_ALIVE || audioCtx) return;
  try {
    const sampleRate = 44100, duration = 10;
    const buffer = new ArrayBuffer(44 + sampleRate * duration * 2);
    const view = new DataView(buffer);
    const writeString = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
    writeString(0, 'RIFF'); view.setUint32(4, 36 + sampleRate * duration * 2, true); writeString(8, 'WAVE');
    writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeString(36, 'data'); view.setUint32(40, sampleRate * duration * 2, true);
    const blob = new Blob([buffer], { type: 'audio/wav' });
    const audio = new Audio(URL.createObjectURL(blob));
    audio.loop = true; audio.volume = 0.01; audio.play();
    audioCtx = audio;
  } catch (e) {}
}

function stopKeepAlive() { if (audioCtx) { audioCtx.pause(); audioCtx = null; } }

// --- Auto Gems (same, but uses queue via sendDiscordMessage) ---
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
      if (ownedGemIds.has(id)) { await sendDiscordMessage(`owo use ${id}`, 'autoGems'); await sleep(getHumanDelay(2000, 3200)); break; }
    }
  }
}

// --- Startup commands (will be queued one by one) ---
async function runStartupCommands() {
  isStartupRunning = true;
  // 'owo cash' is already sent by bankroll.init() – no need to send it again here
  const commands = ['owo inv', 'owo lb all', 'owo wc all', 'owo pray'];
  for (const cmd of commands) {
    if (!botStarted || isHardStopped) return;
    await sendDiscordMessage(cmd, 'startup');
    await sleep(getHumanDelay(CONFIG.STARTUP_DELAY_MIN, CONFIG.STARTUP_DELAY_MAX));
  }
  isStartupRunning = false;
}

// --- Main loops (now they just enqueue commands; no direct sends) ---
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
  if (CONFIG.ENABLE_AUTO_GEMS && cycleCounter % 20 === 0) await autoGems();
  if (CONFIG.ENABLE_AUTO_ITEMS && cycleCounter % 45 === 0) {
    await sendDiscordMessage('owo lb all', 'autoItems');
    await sleep(getHumanDelay(2500, 4000));
    await sendDiscordMessage('owo wc all', 'autoItems');
  }
  huntTimer = setTimeout(huntBattleLoop, getHumanDelay(CONFIG.HUNT_BATTLE_INTERVAL_MIN, CONFIG.HUNT_BATTLE_INTERVAL_MAX));
}

async function gambleLoop() {
  if (!botStarted || isStartupRunning || isHardStopped) {
    if (botStarted && !isHardStopped) gambleTimer = setTimeout(gambleLoop, 3000);
    return;
  }
  if (CONFIG.ENABLE_BLACKJACK && CONFIG.ENABLE_COINFLIP) {
    if (Math.random() < 0.5) await playBlackjack();
    else await playCoinflip();
  } else if (CONFIG.ENABLE_BLACKJACK) {
    await playBlackjack();
  } else if (CONFIG.ENABLE_COINFLIP) {
    await playCoinflip();
  }
  gambleTimer = setTimeout(gambleLoop, getHumanDelay(CONFIG.BJ_CF_INTERVAL_MIN, CONFIG.BJ_CF_INTERVAL_MAX));
}

async function startBot() {
  if (botStarted) return;
  botStarted = true;
  setHardStop(false); 
  updateStartStopButton();
  startKeepAlive();
  startObserver();
  
  await bankroll.init(); // Wait for bankroll to finish
  lastPrayTime = Date.now();
  
  await runStartupCommands(); // Wait for ALL startup commands to finish
  
  huntBattleLoop(); // Now start the loops
  gambleLoop();
}

function stopBot() {
  botStarted = false;
  setHardStop(true); // Kill all sends instantly
  isStartupRunning = false;
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
  startStopBtn.addEventListener('click', () => { if (!botStarted) startBot(); else stopBot(); });
  panel.appendChild(startStopBtn);

  const toggles = [
    { label: 'Hunt', key: 'ENABLE_HUNT' }, { label: 'Battle', key: 'ENABLE_BATTLE' },
    { label: 'Blackjack', key: 'ENABLE_BLACKJACK' }, { label: 'Coinflip', key: 'ENABLE_COINFLIP' },
    { label: 'Pray', key: 'ENABLE_PRAY' }, { label: 'Auto Gems', key: 'ENABLE_AUTO_GEMS' },
    { label: 'Auto Items', key: 'ENABLE_AUTO_ITEMS' }, { label: 'Keep Alive', key: 'ENABLE_KEEP_ALIVE' }
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

import { CONFIG } from './core/config.js';
import { getHumanDelay, sleep, sendDiscordMessage, scanChat, playNotificationSound, triggerNotification, setHardStop, isHardStopped, emitLog, emitTracker, emitStatus, emitCommandStatus, getToken } from './core/utils.js';
import { startKeepAlive, stopKeepAlive } from './core/keepalive.js';
import { playCoinflip } from './games/coinflip.js';
import { bankroll, stats, resetCF } from './systems/bankroll.js';
import { triggerAutoGems, resetGems } from './systems/autoGems.js';
import { initUI, updateStartStopButton, resetRuntime, resetCommandIndicators, clearLogs } from './ui/ui.js';
import { initWebSocketHook, startPolling, stopPolling } from './systems/dmScanner.js';

let botStarted = false;
let isStartupRunning = false;
let huntTimer = null;
let gambleTimer = null;
let cycleCounter = 0;
let lastPrayTime = 0;
let observer = null;

function startObserver() {
  if (observer) observer.disconnect();
  const chatContainer = document.querySelector('ol[class*="scroller"]') || document.querySelector('[class*="scrollerInner"]');
  if (!chatContainer) return;

  observer = new MutationObserver((mutations) => {
    if (!botStarted || isHardStopped) return;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;

        const scan = scanChat(node);
        if (scan && scan.type === 'captcha') {
          playNotificationSound();
          triggerNotification(`Captcha detected! Bot stopped.\nTrigger: "${scan.trigger}"`);
          stopBot();
          return;
        }

        const text = (node.innerText || '').toLowerCase();
        if (text.includes('hunt is empowered')) { stats.hunt++; emitTracker(stats); }
        if (text.includes('goes into battle')) { stats.battle++; emitTracker(stats); }
        if (text.includes('cowoncy') && text.includes('you currently have')) {
          const match = text.match(/you currently have ([\d,]+) cowoncy/i);
          if (match) {
            stats.cash = parseInt(match[1].replace(/,/g, ''));
            emitTracker(stats);
          }
        }
        if (CONFIG.ENABLE_AUTO_GEMS) {
          const html = node.innerHTML || '';
          if (/hunt is empowered/i.test(text)) triggerAutoGems(html);
        }
      }
    }
  });
  observer.observe(chatContainer, { childList: true, subtree: true });
}

function stopObserver() { if (observer) { observer.disconnect(); observer = null; } }

async function runStartupCommands() {
  isStartupRunning = true;
  const commands = [
    { cmd: 'owo lb all', feature: 'lootbox' },
    { cmd: 'owo wc all', feature: 'crate' },
    { cmd: 'owo pray', feature: 'pray' }
  ];
  for (const { cmd, feature } of commands) {
    if (!botStarted || isHardStopped) return;
    await sendDiscordMessage(cmd, feature, true);
    await sleep(getHumanDelay(CONFIG.STARTUP_DELAY_MIN, CONFIG.STARTUP_DELAY_MAX));
  }
  isStartupRunning = false;
}

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
    await sendDiscordMessage('owo lb all', 'lootbox');
    await sleep(getHumanDelay(2500, 4000));
    await sendDiscordMessage('owo wc all', 'crate');
  }
  huntTimer = setTimeout(huntBattleLoop, getHumanDelay(CONFIG.HUNT_BATTLE_INTERVAL_MIN, CONFIG.HUNT_BATTLE_INTERVAL_MAX));
}

async function gambleLoop() {
  if (!botStarted || isStartupRunning || isHardStopped) {
    if (botStarted && !isHardStopped) gambleTimer = setTimeout(gambleLoop, 3000);
    return;
  }
  if (CONFIG.ENABLE_COINFLIP) await playCoinflip();
  gambleTimer = setTimeout(gambleLoop, getHumanDelay(CONFIG.CF_INTERVAL_MIN, CONFIG.CF_INTERVAL_MAX));
}

async function startBot() {
  if (botStarted) return;

  emitStatus(0, 'active');
  emitLog('Running startup safety scan...', 'info');
  const startupScan = scanChat();
  if (startupScan && startupScan.type === 'captcha') {
    emitLog('Warning in recent chat! Aborted.', 'error');
    playNotificationSound();
    triggerNotification(`Warning in recent chat! Aborted.\nTrigger: "${startupScan.trigger}"`);
    emitStatus(0, 'error');
    return;
  }

  botStarted = true;
  setHardStop(false);
  updateStartStopButton(true);
  resetCommandIndicators();
  resetGems();
  resetRuntime();

  startKeepAlive();
  emitCommandStatus('keepAlive', 'success');

  startObserver();
  startPolling(getToken, stopBot, () => botStarted);

  emitStatus(25, 'active');
  await bankroll.init();
  emitLog('Bankroll initialized.', 'success');

  emitStatus(50, 'active');
  lastPrayTime = Date.now();
  await runStartupCommands();
  emitLog('Startup commands done.', 'success');

  emitStatus(100, 'active');
  emitLog('Bot started.', 'success');

  huntBattleLoop();
  gambleLoop();
}

function stopBot() {
  botStarted = false;
  isStartupRunning = false;
  setHardStop(true);
  updateStartStopButton(false);
  resetCommandIndicators();

  stopKeepAlive();
  emitCommandStatus('keepAlive', 'idle');

  stopObserver();
  stopPolling();
  if (huntTimer) clearTimeout(huntTimer);
  if (gambleTimer) clearTimeout(gambleTimer);
  emitLog('Bot stopped.', 'warn');
  emitStatus(0, 'idle');
  resetRuntime();
}

function fullReset() {
  if (botStarted) stopBot();

  stats.hunt = 0;
  stats.battle = 0;
  stats.cfWins = 0;
  stats.cfTotal = 0;
  stats.cash = 0;
  stats.profit = 0;
  emitTracker(stats);

  resetCF();
  bankroll.reset();
  resetGems();
  resetRuntime();
  resetCommandIndicators();
  clearLogs();

  emitLog('Full reset complete', 'success');
}

function init() {
  try { if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') Notification.requestPermission().catch(() => {}); } catch (e) {}

  initWebSocketHook(getToken, stopBot, () => botStarted);

  initUI({
    start: startBot,
    stop: stopBot,
    isRunning: () => botStarted,
    fullReset: fullReset
  });
}

init();

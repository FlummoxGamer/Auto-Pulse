// src/main.js
import { apiSend, parseLogs } from './core/utils.js';
import { 
  createUI, updateStatusUI, updateRuntime, updateTracker, 
  appendLog, updateCooldowns, setStartButtonState, clearLogs 
} from './ui/ui.js';

let isRunning = false;
let runtimeInterval = null;
let runtimeSeconds = 0;
let cooldownInterval = null;

let stats = { hunt: 0, battle: 0, cf: 0, cfTotal: 0, owo: 0 };
let commandStates = {
  hunt: true, battle: true, coinflip: true, pray: true,
  autogems: true, autoitems: true, keepalive: true
};

// Cooldown timestamps (in ms)
let cdTimestamps = { hunt: 0, battle: 0, cf: 0 };

export function initBot() {
  createUI({
    start: toggleBot,
    reset: resetBot
  });

  buildCommandList();
  setupLogObserver();
  
  // Initial UI setup
  updateStatusUI(0, 'idle');
  updateTracker(stats);
  updateRuntime(0);
}

function buildCommandList() {
  const list = document.getElementById('ap-cmd-list');
  list.innerHTML = '';
  Object.keys(commandStates).forEach(key => {
    const item = document.createElement('div');
    item.className = 'ap-cmd-item';
    item.innerHTML = `
      <span style="text-transform: capitalize;">${key}</span>
      <div class="ap-toggle ${commandStates[key] ? 'active' : ''}" data-cmd="${key}"></div>
    `;
    item.querySelector('.ap-toggle').addEventListener('click', (e) => {
      commandStates[key] = !commandStates[key];
      e.target.classList.toggle('active', commandStates[key]);
      appendLog(`${key} -> ${commandStates[key] ? 'ON' : 'OFF'}`);
    });
    list.appendChild(item);
  });
}

function setupLogObserver() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && node.tagName === 'DIV') {
          parseLogs(node.innerText || node.textContent);
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function handleLog(text) {
  // Update stats based on log content
  if (text.includes('Hunt') && text.includes('found')) stats.hunt++;
  if (text.includes('Battle') && text.includes('won')) stats.battle++;
  if (text.includes('Coinflip') && text.includes('won')) stats.cf++;
  if (text.includes('Coinflip') && text.includes('lost')) stats.cfTotal++;
  if (text.includes('owo')) stats.owo++;

  updateTracker(stats);
  appendLog(text);
}

async function toggleBot() {
  if (isRunning) {
    stopBot();
  } else {
    await startBot();
  }
}

async function startBot() {
  if (isRunning) return;
  isRunning = true;
  setStartButtonState(true);
  updateStatusUI(0, 'running');
  appendLog('Bot started.', 'info');

  // FIX 1: Initialize indicators BEFORE starter commands
  resetCommandIndicators();
  
  // Start runtime timer
  runtimeSeconds = 0;
  updateRuntime(runtimeSeconds);
  runtimeInterval = setInterval(() => {
    runtimeSeconds++;
    updateRuntime(runtimeSeconds);
  }, 1000);

  // Start cooldown ticker
  cooldownInterval = setInterval(() => {
    const now = Date.now();
    const huntCd = Math.max(0, Math.ceil((cdTimestamps.hunt + 15000 - now) / 1000));
    const battleCd = Math.max(0, Math.ceil((cdTimestamps.battle + 30000 - now) / 1000));
    const cfCd = Math.max(0, Math.ceil((cdTimestamps.cf + 45000 - now) / 1000));
    updateCooldowns(huntCd, battleCd, cfCd);
  }, 1000);

  // Run starter commands
  await runStartupCommands();

  // Start main loop
  mainLoop();
}

function stopBot() {
  isRunning = false;
  setStartButtonState(false);
  updateStatusUI(0, 'idle');
  appendLog('Bot stopped.', 'warn');
  clearInterval(runtimeInterval);
  clearInterval(cooldownInterval);
  updateCooldowns(0, 0, 0);
}

// FIX 10: Full Bot Reset instead of Bankroll Reset
function resetBot() {
  appendLog('Resetting bot...', 'warn');
  stopBot();
  
  // Reset state
  stats = { hunt: 0, battle: 0, cf: 0, cfTotal: 0, owo: 0 };
  runtimeSeconds = 0;
  cdTimestamps = { hunt: 0, battle: 0, cf: 0 };
  
  // Reset UI
  updateTracker(stats);
  updateRuntime(0);
  clearLogs();
  resetCommandIndicators();
  
  appendLog('Bot reset complete.', 'info');
}

async function runStartupCommands() {
  appendLog('Running startup safety scan...');
  await apiSend('owo cash');
  await apiSend('owo lb all');
  await apiSend('owo wc all');
  await apiSend('owo pray');
  appendLog('Startup commands done.');
}

function mainLoop() {
  if (!isRunning) return;
  
  // Example main loop logic
  if (commandStates.hunt) {
    apiSend('owo hunt');
    cdTimestamps.hunt = Date.now();
  }
  if (commandStates.battle) {
    apiSend('owo battle');
    cdTimestamps.battle = Date.now();
  }
  
  // Schedule next loop
  setTimeout(mainLoop, 5000);
}

function resetCommandIndicators() {
  // Reset any indicator internal state here
  appendLog('Command indicators reset.');
                              }

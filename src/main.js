// src/main.js
import { apiSend, parseLogs, sleep } from './core/utils.js';
import { 
  createUI, updateStatusUI, updateRuntime, updateTracker, 
  appendLog, updateCooldowns, setStartButtonState, clearLogs 
} from './ui/ui.js';

// --- Global State ---
let isRunning = false;
let runtimeInterval = null;
let runtimeSeconds = 0;
let cooldownInterval = null;

// Initialize global objects attached to window for cross-file access
window.apStats = { hunt: 0, battle: 0, cf: 0, cfTotal: 0, owo: 0 };
window.cdTimestamps = { hunt: 0, battle: 0, cf: 0 };

let commandStates = {
  hunt: true,
  battle: true,
  coinflip: true,
  pray: true,
  autogems: true,
  autoitems: true,
  keepalive: true
};

// --- Initialization ---
export function initBot() {
  // 1. Create the UI and pass in the button callbacks
  createUI({
    start: toggleBot,
    reset: resetBot
  });

  // 2. Build the core commands toggles inside the UI
  buildCommandList();
  
  // 3. Start listening for Discord chat messages
  setupLogObserver();
  
  // 4. Listen for parsed logs from utils.js to update the UI
  window.addEventListener('ap-log', (e) => {
    const { text, stats, updated } = e.detail;
    
    // Update the UI tracker if stats changed
    if (updated) {
      updateTracker(stats);
    }
    
    // Append the raw log to the UI
    appendLog(text);
  });

  // 5. Set initial UI states
  updateStatusUI(0, 'idle');
  updateTracker(window.apStats);
  updateRuntime(0);
  updateCooldowns(0, 0, 0);
}

// --- UI & Observer Setup ---
function buildCommandList() {
  const list = document.getElementById('ap-cmd-list');
  if (!list) return;
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
      appendLog(`${key} -> ${commandStates[key] ? 'ON' : 'OFF'}`, 'info');
    });
    list.appendChild(item);
  });
}

function setupLogObserver() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        // Only process Element nodes
        if (node.nodeType !== 1 || node.tagName !== 'DIV') return;
        
        // SAFETY: Ignore our own UI panel so we don't create an infinite loop
        if (node.closest('#ap-panel')) return;
        
        // Pass the text to utils.js for parsing
        parseLogs(node.innerText || node.textContent);
      });
    });
  });
  
  // Observe the entire body for new chat messages
  observer.observe(document.body, { childList: true, subtree: true });
}

// --- Bot Control Logic ---
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

  // FIX 1: Initialize indicators BEFORE starter commands so they register
  resetCommandIndicators();
  
  // Start Runtime Timer
  runtimeSeconds = 0;
  updateRuntime(runtimeSeconds);
  runtimeInterval = setInterval(() => {
    runtimeSeconds++;
    updateRuntime(runtimeSeconds);
  }, 1000);

  // Start Cooldown Ticker (Runs every second to update the UI)
  cooldownInterval = setInterval(() => {
    const now = Date.now();
    // Example cooldowns: Hunt 15s, Battle 30s, CF 45s
    const huntCd = Math.max(0, Math.ceil((window.cdTimestamps.hunt + 15000 - now) / 1000));
    const battleCd = Math.max(0, Math.ceil((window.cdTimestamps.battle + 30000 - now) / 1000));
    const cfCd = Math.max(0, Math.ceil((window.cdTimestamps.cf + 45000 - now) / 1000));
    
    updateCooldowns(huntCd, battleCd, cfCd);
  }, 1000);

  // Run Starter Commands (Indicators are already listening)
  await runStartupCommands();

  // Start the main execution loop
  mainLoop();
}

function stopBot() {
  isRunning = false;
  setStartButtonState(false);
  updateStatusUI(0, 'idle');
  appendLog('Bot stopped.', 'warn');
  
  clearInterval(runtimeInterval);
  clearInterval(cooldownInterval);
  
  // Reset cooldown displays to '-'
  updateCooldowns(0, 0, 0);
}

// FIX 10: Full Bot Reset (Replaces Bankroll Reset)
function resetBot() {
  appendLog('Resetting bot...', 'warn');
  stopBot();
  
  // Reset all internal state variables
  window.apStats = { hunt: 0, battle: 0, cf: 0, cfTotal: 0, owo: 0 };
  runtimeSeconds = 0;
  window.cdTimestamps = { hunt: 0, battle: 0, cf: 0 };
  
  // Reset all UI elements
  updateTracker(window.apStats);
  updateRuntime(0);
  updateCooldowns(0, 0, 0);
  clearLogs();
  resetCommandIndicators();
  
  appendLog('Bot reset complete. Ready to start.', 'info');
}

// --- Core Bot Logic ---
async function runStartupCommands() {
  appendLog('Running startup safety scan...', 'info');
  await apiSend('owo cash');
  await apiSend('owo lb all');
  await apiSend('owo wc all');
  await apiSend('owo pray');
  appendLog('Startup commands done.', 'info');
}

function mainLoop() {
  if (!isRunning) return;
  
  // Note: Cooldown logic is handled by the interval ticker
  // This loop just dispatches the commands based on the current state
  
  if (commandStates.hunt) {
    apiSend('owo hunt');
  }
  
  if (commandStates.battle) {
    apiSend('owo battle');
  }
  
  if (commandStates.coinflip) {
    apiSend('owo cf 100'); // Example bet amount
  }
  
  // Schedule the next loop iteration (e.g., every 15 seconds)
  // Adjust this timing based on your desired bot speed
  setTimeout(() => {
    mainLoop();
  }, 15000); 
}

// --- Indicator Management ---
function resetCommandIndicators() {
  // This function is called before startup commands and during a reset.
  // Add any internal logic here if you have specific indicator tracking 
  // (e.g., resetting a queue of commands waiting for their 'done' signal).
  appendLog('Command indicators reset.', 'info');
}

// --- Initialize on Script Load ---
// Wait for the page to fully load before injecting the UI
window.addEventListener('load', () => {
  // Small delay to ensure Discord's DOM is ready
  setTimeout(initBot, 1500);
});

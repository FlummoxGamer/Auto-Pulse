// src/systems/cooldown.js

// Cooldowns in milliseconds (based on our confirmed timers)
const COOLDOWNS = {
  'owo h': 12000,      // 12s
  'owo b': 12000,      // 12s
  'owo cf': 15000,     // 15s
  'owo pray': 330000,  // 5m 30s
  'owo cash': 180000,  // 3m
  'owo inv': 600000,   // 10m
  'owo lb all': 540000,// 9m
  'owo wc all': 540000,// 9m
  'owo use': 60000,    // 1m
  'default': 5000      // 5s fallback
};

const lastSent = {};

export function isOnCooldown(commandText) {
  const now = Date.now();
  
  // Extract the base command (e.g., 'owo cf 10 h' -> 'owo cf')
  let baseCommand = commandText.split(' ').slice(0, 2).join(' ').toLowerCase();
  
  // Special handling for 'owo use'
  if (commandText.startsWith('owo use')) baseCommand = 'owo use';
  
  // Standardize hunt/battle aliases
  if (baseCommand === 'owo hunt') baseCommand = 'owo h';
  if (baseCommand === 'owo battle') baseCommand = 'owo b';

  const cooldownTime = COOLDOWNS[baseCommand] || COOLDOWNS['default'];
  const lastTime = lastSent[baseCommand] || 0;
  const timePassed = now - lastTime;

  if (timePassed < cooldownTime) {
    const remaining = Math.ceil((cooldownTime - timePassed) / 1000);
    console.log(`[Cooldown] Dropped "${commandText}" - ${remaining}s remaining.`);
    return true;
  }

  lastSent[baseCommand] = now;
  return false;
}

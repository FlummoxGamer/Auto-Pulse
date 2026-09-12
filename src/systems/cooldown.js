const COOLDOWNS = {
  'owo h': 12000,
  'owo b': 12000,
  'owo cf': 15000,
  'owo pray': 330000,
  'owo cash': 180000,
  'owo inv': 600000,
  'owo lb all': 540000,
  'owo wc all': 540000,
  'owo use': 60000,
  'default': 5000
};

const lastSent = {};

function baseOf(commandText) {
  let baseCommand = commandText.split(' ').slice(0, 2).join(' ').toLowerCase();
  if (commandText.startsWith('owo use')) baseCommand = 'owo use';
  if (baseCommand === 'owo hunt') baseCommand = 'owo h';
  if (baseCommand === 'owo battle') baseCommand = 'owo b';
  return baseCommand;
}

export function isOnCooldown(commandText) {
  const now = Date.now();
  const baseCommand = baseOf(commandText);
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

export function getRemainingCooldown(commandText) {
  const baseCommand = baseOf(commandText);
  const cooldownTime = COOLDOWNS[baseCommand] || COOLDOWNS['default'];
  const lastTime = lastSent[baseCommand] || 0;
  const remaining = cooldownTime - (Date.now() - lastTime);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

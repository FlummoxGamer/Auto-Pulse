// src/systems/autoGems.js
import { CONFIG } from '../core/config.js';
import { sendDiscordMessage, sleep, getHumanDelay } from '../core/utils.js';

// Session state: tracks which gem tier is currently active per category
const activeGems = {
  HUNTING: null,
  EMPOWERING: null,
  LUCKY: null,
  SPECIAL: null
};

// Category to ID range mapping (higher number = higher tier)
const CATEGORY_RANGES = {
  HUNTING:    { min: 51, max: 57 },
  EMPOWERING: { min: 58, max: 64 },
  LUCKY:      { min: 65, max: 71 },
  SPECIAL:    { min: 72, max: 78 }
};

// Keywords that indicate a gem has expired
const EXPIRY_KEYWORDS = [
  'gem broke', 'gem expired', 'gem shone',
  'your gem ran out', 'gems ran out', 'gem has broken',
  'gem has expired', 'the gem broke', 'the gem expired'
];

export function detectGemExpiry(text) {
  const lower = text.toLowerCase();
  const hasExpiry = EXPIRY_KEYWORDS.some(k => lower.includes(k));
  if (!hasExpiry) return null;

  const expired = [];
  if (lower.includes('hunting gem') || lower.includes('hunting')) expired.push('HUNTING');
  if (lower.includes('empowering gem') || lower.includes('empowering')) expired.push('EMPOWERING');
  if (lower.includes('lucky gem') || lower.includes('lucky')) expired.push('LUCKY');
  if (lower.includes('special gem') || lower.includes('special')) expired.push('SPECIAL');

  // If no specific category detected, assume all expired
  if (expired.length === 0) return ['HUNTING', 'EMPOWERING', 'LUCKY', 'SPECIAL'];
  return expired;
}

export function markExpired(categories) {
  for (const cat of categories) {
    if (activeGems[cat]) {
      console.log(`[AutoGems] Marked ${cat} gem as expired.`);
      activeGems[cat] = null;
    }
  }
}

export async function autoGems() {
  console.log('[AutoGems] Running smart gem check...');

  // 1. Request inventory
  await sendDiscordMessage('owo inv', 'autoGems', true); // force bypass cooldown
  await sleep(getHumanDelay(4000, 5000));

  // 2. Read inventory response
  const chat = document.querySelector('ol[class*="scroller"]');
  if (!chat) { console.log('[AutoGems] No chat container.'); return; }
  const msgs = Array.from(chat.querySelectorAll('li[class*="message"]')).slice(-5);

  let invText = '';
  for (let i = msgs.length - 1; i >= 0; i--) {
    const txt = msgs[i].innerText;
    if (/inventory/i.test(txt) || (/\b05[1-9]\b/.test(txt) && /\b06[0-9]\b/.test(txt))) {
      invText = txt;
      break;
    }
  }
  if (!invText && msgs.length > 0) invText = msgs[msgs.length - 1].innerText;
  if (!invText) { console.log('[AutoGems] Could not read inventory.'); return; }

  // 3. Parse all 3-digit IDs
  const foundIds = new Set();
  const idRegex = /\b(\d{3})\b/g;
  let match;
  while ((match = idRegex.exec(invText)) !== null) foundIds.add(match[1]);

  // 4. For each MISSING category, find highest tier we own
  const idsToUse = [];
  for (const [category, range] of Object.entries(CATEGORY_RANGES)) {
    if (activeGems[category]) continue;
    for (let i = range.max; i >= range.min; i--) {
      const id = String(i).padStart(3, '0');
      if (foundIds.has(id)) { idsToUse.push(id); break; }
    }
  }

  if (idsToUse.length === 0) {
    console.log('[AutoGems] No missing gems or no gems owned.');
    return;
  }

  // 5. Send single owo use command with all IDs
  const useCmd = `owo use ${idsToUse.join(' ')}`;
  console.log(`[AutoGems] Equipping: ${useCmd}`);
  await sendDiscordMessage(useCmd, 'autoGems', true);

  // 6. Mark as active
  for (const id of idsToUse) {
    const num = parseInt(id);
    for (const [cat, range] of Object.entries(CATEGORY_RANGES)) {
      if (num >= range.min && num <= range.max) activeGems[cat] = id;
    }
  }
  console.log(`[AutoGems] Active: ${JSON.stringify(activeGems)}`);
}

export function resetGems() {
  activeGems.HUNTING = null;
  activeGems.EMPOWERING = null;
  activeGems.LUCKY = null;
  activeGems.SPECIAL = null;
  console.log('[AutoGems] State reset.');
}

export function getActiveGems() {
  return { ...activeGems };
        }

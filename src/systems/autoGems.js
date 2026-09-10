import { sendDiscordMessage, sleep, getHumanDelay } from '../core/utils.js';

// Rarity prefixes: higher = better
const RARITY_PREFIX = { 'c': 1, 'u': 2, 'r': 3, 'e': 4, 'm': 5, 'l': 6, 'f': 7 };

// Category suffix mapping
const CATEGORY_SUFFIX = { '1': 'HUNTING', '3': 'EMPOWERING', '4': 'LUCKY', '': 'SPECIAL' };

let lastAutoGemsRun = 0;

export function resetGems() {
  lastAutoGemsRun = 0;
  console.log('[AutoGems] State reset.');
}

export async function triggerAutoGems(huntHtml) {
  // Debounce: only run once every 30 seconds
  if (Date.now() - lastAutoGemsRun < 30000) return;

  // 1. Detect which gem categories are currently equipped (from hunt reply)
  const equipped = { HUNTING: false, EMPOWERING: false, LUCKY: false, SPECIAL: false };
  const equippedRegex = /([curemlf])gem([134]?)/gi;
  let match;

  while ((match = equippedRegex.exec(huntHtml)) !== null) {
    const prefix = match[1].toLowerCase();
    const suffix = match[2] || '';
    const category = CATEGORY_SUFFIX[suffix];
    if (!category) continue;

    // Check if depleted: look for "[0/" shortly after this emoji
    const after = huntHtml.slice(match.index, match.index + 200);
    const depleted = /\[0\//.test(after);
    if (!depleted) equipped[category] = true;
  }

  const missing = Object.keys(equipped).filter(c => !equipped[c]);
  if (missing.length === 0) {
    console.log('[AutoGems] All 4 gems equipped and active.');
    return;
  }

  console.log(`[AutoGems] Missing/depleted: ${missing.join(', ')}`);
  lastAutoGemsRun = Date.now();

  // 2. Send owo inv
  await sendDiscordMessage('owo inv', 'autoGems', true);
  await sleep(getHumanDelay(4000, 5000));

  // 3. Find the latest OwO inventory message
  const chat = document.querySelector('ol[class*="scroller"]');
  if (!chat) return;
  const msgs = Array.from(chat.querySelectorAll('li[class*="message"]')).slice(-6);

  let invHtml = '';
  for (let i = msgs.length - 1; i >= 0; i--) {
    const txt = msgs[i].innerText || '';
    if (/inventory/i.test(txt)) {
      invHtml = msgs[i].innerHTML;
      break;
    }
  }
  if (!invHtml) { console.log('[AutoGems] No inventory found.'); return; }

  // 4. Parse inventory: pair numeric ID with gem emoji
  const items = [];
  const imgPattern = /<img[^>]*?\/([curemlf])gem([134]?)[^>]*?>/gi;
  let imgMatch;

  while ((imgMatch = imgPattern.exec(invHtml)) !== null) {
    const prefix = imgMatch[1].toLowerCase();
    const suffix = imgMatch[2] || '';
    const category = CATEGORY_SUFFIX[suffix];
    const tier = RARITY_PREFIX[prefix];
    if (!category || !tier) continue;

    // Look at HTML before this emoji to find the numeric ID
    const before = invHtml.slice(0, imgMatch.index);
    const textBefore = before.replace(/<[^>]*>/g, ' ');
    const numbers = textBefore.match(/\b\d{3}\b/g);
    const id = numbers ? numbers[numbers.length - 1] : null;

    if (id) {
      items.push({ id, category, tier });
      console.log(`[AutoGems] Found: ${id} = ${prefix}gem${suffix} (${category}, tier ${tier})`);
    }
  }

  // 5. Find highest tier per missing category
  const toUse = [];
  for (const cat of missing) {
    const candidates = items.filter(i => i.category === cat);
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => b.tier - a.tier);
    toUse.push(candidates[0].id);
  }

  if (toUse.length === 0) {
    console.log('[AutoGems] No gems found for missing categories.');
    return;
  }

  // 6. Send owo use with numeric IDs
  const cmd = `owo use ${toUse.join(' ')}`;
  console.log(`[AutoGems] Equipping: ${cmd}`);
  await sendDiscordMessage(cmd, 'autoGems', true);
}

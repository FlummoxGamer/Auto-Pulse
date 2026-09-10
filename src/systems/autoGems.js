import { sendDiscordMessage, sleep, getHumanDelay } from '../core/utils.js';

const RARITY_PREFIX = { 'c': 1, 'u': 2, 'r': 3, 'e': 4, 'm': 5, 'l': 6, 'f': 7 };
const CATEGORY_SUFFIX = { '1': 'HUNTING', '3': 'EMPOWERING', '4': 'LUCKY', '': 'SPECIAL' };

let lastAutoGemsRun = 0;

// --- Inventory Cache ---
let inventoryCache = null;
let inventoryCacheTime = 0;
const INVENTORY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function resetGems() {
  lastAutoGemsRun = 0;
  inventoryCache = null;
  inventoryCacheTime = 0;
  console.log('[AutoGems] State reset.');
}

// Debug: log all gem-related img URLs
function logGemImages(html, label) {
  const imgRegex = /<img[^>]*?src="([^"]+)"[^>]*?>/gi;
  let m;
  const found = [];
  while ((m = imgRegex.exec(html)) !== null) {
    if (/gem/i.test(m[1])) found.push(m[1]);
  }
  console.log(`[AutoGems Debug] ${label}: ${found.length} gem images found`);
  found.forEach(url => console.log(`[AutoGems Debug]   ${url}`));
}

export async function triggerAutoGems(huntHtml) {
  if (Date.now() - lastAutoGemsRun < 30000) return;

  // Debug: see what gem images are in the hunt reply
  logGemImages(huntHtml, 'HUNT REPLY');

  // 1. Detect equipped gems
  const equipped = { HUNTING: false, EMPOWERING: false, LUCKY: false, SPECIAL: false };
  const equippedRegex = /([curemlf])gem([134]?)/gi;
  let match;

  while ((match = equippedRegex.exec(huntHtml)) !== null) {
    const prefix = match[1].toLowerCase();
    const suffix = match[2] || '';
    const category = CATEGORY_SUFFIX[suffix];
    if (!category) continue;
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

  // 2. Get inventory (from cache if fresh)
  let invHtml;
  if (inventoryCache && (Date.now() - inventoryCacheTime) < INVENTORY_CACHE_TTL) {
    console.log('[AutoGems] Using cached inventory.');
    invHtml = inventoryCache;
  } else {
    await sendDiscordMessage('owo inv', 'autoGems', true);
    await sleep(getHumanDelay(4000, 5000));
    const chat = document.querySelector('ol[class*="scroller"]');
    if (!chat) return;
    const msgs = Array.from(chat.querySelectorAll('li[class*="message"]')).slice(-6);
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (/inventory/i.test(msgs[i].innerText || '')) {
        invHtml = msgs[i].innerHTML;
        break;
      }
    }
    if (!invHtml) { console.log('[AutoGems] No inventory found.'); return; }
    inventoryCache = invHtml;
    inventoryCacheTime = Date.now();
  }

  // Debug: see what gem images are in the inventory
  logGemImages(invHtml, 'INVENTORY');

  // 3. Parse inventory
  const items = [];
  const imgPattern = /<img[^>]*?src="([^"]+)"[^>]*?>/gi;
  let imgMatch;

  while ((imgMatch = imgPattern.exec(invHtml)) !== null) {
    const url = imgMatch[1];
    if (!/gem/i.test(url)) continue;
    const nameMatch = url.match(/([curemlf])gem([134]?)(?=[^a-z0-9]|$)/i);
    if (!nameMatch) continue;

    const prefix = nameMatch[1].toLowerCase();
    const suffix = nameMatch[2] || '';
    const category = CATEGORY_SUFFIX[suffix];
    const tier = RARITY_PREFIX[prefix];
    if (!category || !tier) continue;

    const before = invHtml.slice(0, imgMatch.index).replace(/<[^>]*>/g, ' ');
    const numbers = before.match(/\b\d{3}\b/g);
    const id = numbers ? numbers[numbers.length - 1] : null;
    if (id) {
      items.push({ id, category, tier, url });
      console.log(`[AutoGems] Found: ${id} = ${prefix}gem${suffix} (${category}, tier ${tier})`);
    }
  }

  if (items.length === 0) {
    console.log('[AutoGems] No items parsed from inventory. Check debug logs above.');
    return;
  }

  // 4. Find highest tier per missing category
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

  const cmd = `owo use ${toUse.join(' ')}`;
  console.log(`[AutoGems] Equipping: ${cmd}`);
  await sendDiscordMessage(cmd, 'autoGems', true);
}

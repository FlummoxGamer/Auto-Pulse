import { sendDiscordMessage, sleep, getHumanDelay } from '../core/utils.js';

const RARITY_PREFIX = { 'c': 1, 'u': 2, 'r': 3, 'e': 4, 'm': 5, 'l': 6, 'f': 7 };
const CATEGORY_SUFFIX = { '1': 'HUNTING', '3': 'EMPOWERING', '4': 'LUCKY', '': 'SPECIAL' };

let lastAutoGemsRun = 0;
let inventoryCache = null;
let inventoryCacheTime = 0;
const INVENTORY_CACHE_TTL = 10 * 60 * 1000;

export function resetGems() {
  lastAutoGemsRun = 0;
  inventoryCache = null;
  inventoryCacheTime = 0;
  console.log('[AutoGems] State reset.');
}

// Read emoji name from the ALT attribute (this is where Discord stores it)
function extractGems(html, label) {
  const gems = [];
  // Match any <img ... > that has an alt containing "gem"
  const imgRegex = /<img[^>]*?alt="([^"]*?gem[^"]*?)"[^>]*?>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const alt = match[1];
    const nameMatch = alt.match(/([curemlf])gem([134]?)(?=[^a-z0-9]|$)/i);
    if (!nameMatch) continue;
    const prefix = nameMatch[1].toLowerCase();
    const suffix = nameMatch[2] || '';
    const category = CATEGORY_SUFFIX[suffix];
    const tier = RARITY_PREFIX[prefix];
    if (!category || !tier) continue;

    // Look backwards in raw HTML for numeric ID
    const before = html.slice(0, match.index).replace(/<[^>]*>/g, ' ');
    const numbers = before.match(/\b\d{3}\b/g);
    const id = numbers ? numbers[numbers.length - 1] : null;

    gems.push({ id, alt, prefix, suffix, category, tier, index: match.index });
  }
  console.log(`[AutoGems Debug] ${label}: ${gems.length} gems parsed.`);
  gems.forEach(g => console.log(`[AutoGems Debug]   alt="${g.alt}" id=${g.id} (${g.category}, tier ${g.tier})`));
  return gems;
}

export async function triggerAutoGems(huntHtml) {
  if (Date.now() - lastAutoGemsRun < 30000) return;

  // 1. Detect equipped gems from HUNT reply
  const equippedGems = extractGems(huntHtml, 'HUNT');
  const equipped = { HUNTING: false, EMPOWERING: false, LUCKY: false, SPECIAL: false };

  for (const gem of equippedGems) {
    // Depleted if "[0/" appears shortly after
    const after = huntHtml.slice(gem.index, gem.index + 300);
    if (!/\[0\//.test(after)) {
      equipped[gem.category] = true;
    }
  }

  const missing = Object.keys(equipped).filter(c => !equipped[c]);
  if (missing.length === 0) {
    console.log('[AutoGems] All 4 gems active.');
    return;
  }
  console.log(`[AutoGems] Missing/depleted: ${missing.join(', ')}`);
  lastAutoGemsRun = Date.now();

  // 2. Get inventory (cached)
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

  // 3. Parse inventory
  const invGems = extractGems(invHtml, 'INVENTORY');
  if (invGems.length === 0) {
    console.log('[AutoGems] No items parsed. Check debug logs.');
    return;
  }

  // 4. Highest tier per missing category
  const toUse = [];
  for (const cat of missing) {
    const candidates = invGems.filter(g => g.category === cat && g.id);
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

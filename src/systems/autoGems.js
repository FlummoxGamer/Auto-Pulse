import { sendDiscordMessage, sleep, getHumanDelay } from '../core/utils.js';

const RARITY_PREFIX = { 'c': 1, 'u': 2, 'r': 3, 'e': 4, 'm': 5, 'l': 6, 'f': 7 };

// CORRECT mapping based on your data:
// 1 = HUNTING, 3 = EMPOWERING, 4 = LUCKY, (empty) = SPECIAL
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

// Parse equipped from hunt reply HTML
function parseHuntReply(html) {
  const equipped = { HUNTING: false, EMPOWERING: false, LUCKY: false, SPECIAL: false };
  // Match :XgemN: or :Xgem: (with optional colons)
  const regex = /alt=":?([curemlf])gem([134]?):?"/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const prefix = m[1].toLowerCase();
    const suffix = m[2] || '';
    const category = CATEGORY_SUFFIX[suffix];
    if (!category) continue;

    // Look 50 chars forward for [0/ to detect depleted
    const after = html.slice(m.index, m.index + 80);
    if (!/\[0\//.test(after)) {
      equipped[category] = true;
      console.log(`[AutoGems Debug] HUNT: ${m[1]}gem${suffix} → ${category} equipped`);
    } else {
      console.log(`[AutoGems Debug] HUNT: ${m[1]}gem${suffix} → ${category} DEPLETED`);
    }
  }
  return equipped;
}

// Parse inventory HTML for gems (format: "052 <img alt=":cgem1:"> 1")
function parseInventory(html) {
  const gems = [];
  // Match optional space + 3-digit ID + optional space + <img with gem alt>
  const regex = /(\d{3})\s*<img[^>]*?alt=":?([curemlf])gem([134]?):?"[^>]*?>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const id = m[1];
    const prefix = m[2].toLowerCase();
    const suffix = m[3] || '';
    const category = CATEGORY_SUFFIX[suffix];
    const tier = RARITY_PREFIX[prefix];
    if (!category || !tier) continue;
    gems.push({ id, prefix, suffix, category, tier });
    console.log(`[AutoGems Debug] INV: ${id} = ${prefix}gem${suffix} (${category}, tier ${tier})`);
  }
  return gems;
}

export async function triggerAutoGems(huntHtml) {
  if (Date.now() - lastAutoGemsRun < 30000) return;

  const equipped = parseHuntReply(huntHtml);
  const missing = Object.keys(equipped).filter(c => !equipped[c]);
  if (missing.length === 0) {
    console.log('[AutoGems] All 4 gems active.');
    return;
  }
  console.log(`[AutoGems] Missing/depleted: ${missing.join(', ')}`);
  lastAutoGemsRun = Date.now();

  // Get inventory (cached)
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

  const invGems = parseInventory(invHtml);
  if (invGems.length === 0) {
    console.log('[AutoGems] No gems parsed from inventory.');
    return;
  }

  const toUse = [];
  for (const cat of missing) {
    const candidates = invGems.filter(g => g.category === cat);
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => b.tier - a.tier);
    toUse.push(candidates[0].id);
  }

  if (toUse.length === 0) {
    console.log('[AutoGems] No matching gems in inventory for missing categories.');
    return;
  }

  const cmd = `owo use ${toUse.join(' ')}`;
  console.log(`[AutoGems] Equipping: ${cmd}`);
  await sendDiscordMessage(cmd, 'autoGems', true);
}

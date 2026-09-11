import { sendDiscordMessage, sleep, getHumanDelay } from '../core/utils.js';

const RARITY_PREFIX = { 'c': 1, 'u': 2, 'r': 3, 'e': 4, 'm': 5, 'l': 6, 'f': 7 };

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

// Parse alt name → { category, tier, prefix, suffix }
function parseAlt(alt) {
  const clean = alt.replace(/:/g, '').toLowerCase();

  // Special: Xstar (no number)
  const starMatch = clean.match(/^([curemlf])star$/);
  if (starMatch) {
    const tier = RARITY_PREFIX[starMatch[1]];
    if (tier) return { category: 'SPECIAL', tier, prefix: starMatch[1], suffix: 'star' };
  }

  // Regular: Xgem1 / Xgem3 / Xgem4
  const gemMatch = clean.match(/^([curemlf])gem([134])$/);
  if (gemMatch) {
    const tier = RARITY_PREFIX[gemMatch[1]];
    const suffix = gemMatch[2];
    const category = suffix === '1' ? 'HUNTING' : suffix === '3' ? 'EMPOWERING' : 'LUCKY';
    if (tier) return { category, tier, prefix: gemMatch[1], suffix };
  }
  return null;
}

// Parse equipped from hunt reply (uses alt attributes)
function parseHuntReply(html) {
  const equipped = { HUNTING: false, EMPOWERING: false, LUCKY: false, SPECIAL: false };
  const regex = /alt="([^"]*(?:gem|star)[^"]*)"/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const parsed = parseAlt(m[1]);
    if (!parsed) continue;
    const after = html.slice(m.index, m.index + 80);
    if (!/\[0\//.test(after)) {
      equipped[parsed.category] = true;
      console.log(`[AutoGems Debug] HUNT: ${m[1]} → ${parsed.category} equipped`);
    } else {
      console.log(`[AutoGems Debug] HUNT: ${m[1]} → ${parsed.category} DEPLETED`);
    }
  }
  return equipped;
}

// Parse inventory — allows arbitrary HTML between the number and the img tag
function parseInventory(html) {
  const gems = [];
  // Match: <3-digit number> ... (up to 200 chars of any HTML) ... alt=":XgemN:" or ":Xstar:"
  const regex = /(\d{3})[\s\S]{0,200}?alt="([^"]*(?:gem|star)[^"]*)"/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const id = m[1];
    const parsed = parseAlt(m[2]);
    if (!parsed) continue;
    // Guard: make sure the matched number isn't part of a longer number (like a data-id)
    const before = html.slice(Math.max(0, m.index - 1), m.index);
    if (/\d/.test(before)) continue;
    gems.push({ id, ...parsed });
    console.log(`[AutoGems Debug] INV: ${id} = ${m[2]} (${parsed.category}, tier ${parsed.tier})`);
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
    console.log('[AutoGems] No matching gems in inventory.');
    return;
  }

  const cmd = `owo use ${toUse.join(' ')}`;
  console.log(`[AutoGems] Equipping: ${cmd}`);
  await sendDiscordMessage(cmd, 'autoGems', true);
      }

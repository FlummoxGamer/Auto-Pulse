import { sendDiscordMessage, sleep, getHumanDelay } from '../core/utils.js';

// Mapping of rarity prefixes to their tier value (higher = better)
const RARITY_PREFIX = { 'c': 1, 'u': 2, 'r': 3, 'e': 4, 'm': 5, 'l': 6, 'f': 7 };

// Mapping of suffix to category
const CATEGORY_SUFFIX = { '1': 'HUNTING', '3': 'EMPOWERING', '4': 'LUCKY', '': 'SPECIAL' };

let lastAutoGemsRun = 0;

export function resetGems() {
  lastAutoGemsRun = 0;
  console.log('[AutoGems] State reset.');
}

export async function triggerAutoGems(html) {
  // Debounce: Only run once every 15 seconds
  if (Date.now() - lastAutoGemsRun < 15000) return;
  
  const equipped = {
    HUNTING: false,
    EMPOWERING: false,
    LUCKY: false,
    SPECIAL: false
  };

  // 1. Check what is currently equipped (and not depleted)
  // Regex matches 'cgem1', 'fgem3', 'mgem', etc.
  const gemRegex = /([curemlf])gem([134]?)/gi;
  let match;
  
  while ((match = gemRegex.exec(html)) !== null) {
    const prefix = match[1].toLowerCase();
    const suffix = match[2] || '';
    const category = CATEGORY_SUFFIX[suffix];
    
    if (category) {
      // Check if the gem is depleted (shows [0/...)
      const matchIndex = match.index;
      const surroundingText = html.slice(matchIndex, matchIndex + 100);
      const isDepleted = surroundingText.includes('[0/');
      
      if (!isDepleted) {
        equipped[category] = true;
      } else {
        console.log(`[AutoGems] ${category} gem is depleted (0 charges).`);
      }
    }
  }

  // 2. Find missing categories
  const missingCategories = Object.keys(equipped).filter(cat => !equipped[cat]);
  if (missingCategories.length === 0) {
    console.log('[AutoGems] All 4 gems are equipped and active.');
    return;
  }

  console.log(`[AutoGems] Missing/Depleted gems: ${missingCategories.join(', ')}`);
  lastAutoGemsRun = Date.now();

  // 3. Send owo inv to check inventory
  await sendDiscordMessage('owo inv', 'autoGems', true); // Force bypass cooldown
  await sleep(getHumanDelay(4000, 5000));

  // 4. Read inventory HTML
  const chat = document.querySelector('ol[class*="scroller"]');
  if (!chat) return;
  const msgs = Array.from(chat.querySelectorAll('li[class*="message"]')).slice(-5);
  
  let invHtml = '';
  for (let i = msgs.length - 1; i >= 0; i--) {
    const txt = msgs[i].innerHTML;
    if (/inventory/i.test(txt) || /gem/i.test(txt)) {
      invHtml = txt;
      break;
    }
  }
  if (!invHtml) { console.log('[AutoGems] Could not read inventory HTML.'); return; }

  // 5. Parse inventory for highest tier per missing category
  const inventoryGems = { HUNTING: null, EMPOWERING: null, LUCKY: null, SPECIAL: null };
  const invRegex = /([curemlf])gem([134]?)/gi;
  let invMatch;

  while ((invMatch = invRegex.exec(invHtml)) !== null) {
    const prefix = invMatch[1].toLowerCase();
    const suffix = invMatch[2] || '';
    const category = CATEGORY_SUFFIX[suffix];
    const tierValue = RARITY_PREFIX[prefix];

    if (category && tierValue) {
      // If we don't have a gem for this category yet, or this one is higher tier, save it
      if (!inventoryGems[category] || tierValue > RARITY_PREFIX[inventoryGems[category].prefix]) {
        inventoryGems[category] = { prefix, suffix, tierValue, id: invMatch[0] };
      }
    }
  }

  // 6. Build the owo use command
  const idsToUse = [];
  for (const cat of missingCategories) {
    if (inventoryGems[cat]) {
      idsToUse.push(inventoryGems[cat].id);
    }
  }

  if (idsToUse.length === 0) {
    console.log('[AutoGems] No matching gems found in inventory to equip.');
    return;
  }

  const useCmd = `owo use ${idsToUse.join(' ')}`;
  console.log(`[AutoGems] Equipping: ${useCmd}`);
  await sendDiscordMessage(useCmd, 'autoGems', true);
}

import { CONFIG, FIBONACCI } from './config.js';
import { sendDiscordMessage, sleep, getHumanDelay } from './utils.js';

let fibIndex = 0;
let lastHand = null;

export async function playBlackjack() {
  const bet = Math.min(CONFIG.BJ_BASE_BET * FIBONACCI[fibIndex], CONFIG.BJ_MAX_BET);
  await sendDiscordMessage(`owo bj ${bet}`);
  await sleep(getHumanDelay(5000, 7000));

  const chat = document.querySelector('ol[class*="scroller"]');
  const msgs = chat ? chat.querySelectorAll('li[class*="message"]') : [];
  let bjMsg = null;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].innerText.toLowerCase().includes('blackjack') || msgs[i].innerText.includes('BJ')) {
      bjMsg = msgs[i];
      break;
    }
  }
  if (!bjMsg) return;

  const text = bjMsg.innerText.toLowerCase();
  const handMatch = text.match(/you have (\d+)/);
  const dealerMatch = text.match(/dealer shows (\d+)/);
  if (!handMatch) return;

  const hand = parseInt(handMatch[1]);
  const dealer = dealerMatch ? parseInt(dealerMatch[1]) : 10;

  // Basic strategy: hit if <12, stand if >=17, else use dealer
  let action = 'stand';
  if (hand < 12) action = 'hit';
  else if (hand >= 17) action = 'stand';
  else if (dealer >= 7 || dealer === 10) action = 'hit';
  else action = 'stand';

  // Find reaction buttons: they have aria-label containing the emoji or text
  const buttons = bjMsg.querySelectorAll('button[class*="reaction"]');
  let hitBtn = null, standBtn = null;
  for (const btn of buttons) {
    const label = btn.getAttribute('aria-label') || btn.innerText || '';
    if (label.includes('👊') || label.toLowerCase().includes('hit')) hitBtn = btn;
    if (label.includes('🛑') || label.toLowerCase().includes('stand') || label.toLowerCase().includes('stop')) standBtn = btn;
  }

  if (action === 'hit' && hitBtn) hitBtn.click();
  else if (action === 'stand' && standBtn) standBtn.click();
  else if (buttons.length >= 2) {
    // fallback: first is hit, last is stand
    if (action === 'hit') buttons[0].click();
    else buttons[buttons.length - 1].click();
  }

  // Update Fibonacci on win/loss if text shows
  if (text.includes('won') || text.includes('win')) fibIndex = Math.max(0, fibIndex - 2);
  else if (text.includes('lost') || text.includes('lose')) fibIndex = Math.min(fibIndex + 1, FIBONACCI.length - 1);
}

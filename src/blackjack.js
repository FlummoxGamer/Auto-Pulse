import { CONFIG, FIBONACCI } from './config.js';
import { sendDiscordMessage, sleep, getHumanDelay } from './utils.js';

let fibIndex = 0;

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

  // Basic strategy: stand on 17+, hit <12, else check dealer
  let action = 'stand';
  if (hand < 12) action = 'hit';
  else if (hand >= 17) action = 'stand';
  else if (dealer >= 7 || dealer === 10) action = 'hit';
  else action = 'stand';

  const buttons = bjMsg.querySelectorAll('button[class*="reaction"]');
  if (buttons.length >= 2) {
    const target = action === 'hit' ? buttons[0] : buttons[1]; // 👊 = hit, 🛑 = stand
    target.click();
  }

  // Update Fibonacci based on result (if message shows win/loss)
  if (text.includes('won') || text.includes('win')) fibIndex = Math.max(0, fibIndex - 2);
  else if (text.includes('lost') || text.includes('lose')) fibIndex = Math.min(fibIndex + 1, FIBONACCI.length - 1);
}

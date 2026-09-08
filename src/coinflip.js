import { CONFIG, FIBONACCI } from './config.js';
import { sendDiscordMessage, sleep, getHumanDelay } from './utils.js';

let fibIndex = 0;
let history = [];

export async function playCoinflip() {
  const bet = Math.min(CONFIG.CF_BASE_BET * FIBONACCI[fibIndex], CONFIG.CF_MAX_BET);
  // Choose side: if last 3 are heads, bet tails, else heads
  let side = 'h';
  if (history.length >= 3 && history.slice(-3).every(x => x === 'heads')) side = 't';
  else if (history.length >= 3 && history.slice(-3).every(x => x === 'tails')) side = 'h';
  
  await sendDiscordMessage(`owo cf ${bet} ${side}`);
  await sleep(getHumanDelay(5000, 7000));

  const chat = document.querySelector('ol[class*="scroller"]');
  const msgs = chat ? chat.querySelectorAll('li[class*="message"]') : [];
  let cfMsg = null;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].innerText.toLowerCase().includes('flipped')) {
      cfMsg = msgs[i];
      break;
    }
  }
  if (!cfMsg) return;

  const text = cfMsg.innerText.toLowerCase();
  if (text.includes('won')) fibIndex = 0;
  else if (text.includes('lost')) fibIndex = Math.min(fibIndex + 1, FIBONACCI.length - 1);

  if (text.includes('heads')) history.push('heads');
  else history.push('tails');
  if (history.length > 10) history.shift();
}

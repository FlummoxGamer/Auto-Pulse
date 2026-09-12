import { CONFIG, FIBONACCI } from '../core/config.js';
import { sendDiscordMessage, sleep, getHumanDelay, emitTracker } from '../core/utils.js';
import { stats } from '../systems/bankroll.js';

let fibIndex = 0;
let history = [];

function predictSide() {
  if (history.length < 3) return 'h';
  const heads = history.filter(x => x === 'heads').length;
  const tails = history.length - heads;
  if (heads > tails) return 't';
  if (tails > heads) return 'h';
  return Math.random() < 0.5 ? 'h' : 't';
}

function findCFResult() {
  const chat = document.querySelector('ol[class*="scroller"]');
  if (!chat) return null;
  const msgs = Array.from(chat.querySelectorAll('li[class*="message"]'));
  for (let i = msgs.length - 1; i >= 0; i--) {
    const t = msgs[i].innerText.toLowerCase();
    if ((t.includes('coin spins') || t.includes('spins...')) &&
        (t.includes('you won') || t.includes('you lost') ||
         t.includes('and you won') || t.includes('and you lost'))) {
      return { msg: msgs[i], text: t };
    }
  }
  return null;
}

export async function playCoinflip() {
  const bet = Math.min(CONFIG.CF_BASE_BET * FIBONACCI[fibIndex], CONFIG.CF_MAX_BET);
  const side = predictSide();
  await sendDiscordMessage(`owo cf ${bet} ${side}`, 'coinflip');

  // Wait and retry up to 3 times
  let result = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(getHumanDelay(4000, 6000));
    result = findCFResult();
    if (result) break;
  }

  if (!result) return;

  const text = result.text;
  stats.cfTotal++;
  if (text.includes('you won') || text.includes('and you won')) {
    stats.cfWins++;
    stats.owo += bet;
    fibIndex = 0;
  } else if (text.includes('you lost') || text.includes('and you lost')) {
    stats.owo -= bet;
    fibIndex = Math.min(fibIndex + 1, FIBONACCI.length - 1);
  }
  emitTracker(stats);

  if (text.includes('heads')) history.push('heads');
  else history.push('tails');
  if (history.length > 10) history.shift();
}

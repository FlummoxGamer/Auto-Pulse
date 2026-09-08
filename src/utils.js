export function getHumanDelay(min, max) {
  const u1 = Math.random();
  const u2 = Math.random();
  const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
  const mean = (min + max) / 2;
  const stdDev = (max - min) / 6;
  const delay = Math.round(mean + randStdNormal * stdDev);
  return Math.min(Math.max(delay, min), max);
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function sendDiscordMessage(text) {
  let retries = 3;
  let chatInput = null;
  while (retries > 0) {
    chatInput = document.querySelector('div[role="textbox"]');
    if (chatInput) break;
    retries--;
    await sleep(1000);
  }
  if (!chatInput) return false;

  chatInput.focus();
  await sleep(getHumanDelay(100, 300));

  const dt = new DataTransfer();
  dt.setData('text/plain', text);
  const pasteEvent = new ClipboardEvent('paste', {
    clipboardData: dt,
    bubbles: true,
    cancelable: true
  });
  chatInput.dispatchEvent(pasteEvent);

  await sleep(getHumanDelay(200, 400));

  const sendBtn = document.querySelector('button[aria-label="Send"]') || 
                  document.querySelector('button[aria-label="Send Message"]') || 
                  document.querySelector('button[class*="send"]') ||
                  document.querySelector('form button[type="submit"]');
  if (sendBtn) sendBtn.click();
  else {
    chatInput.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', code:'Enter', keyCode:13, which:13, bubbles:true, cancelable:true}));
    chatInput.dispatchEvent(new KeyboardEvent('keyup', {key:'Enter', code:'Enter', keyCode:13, which:13, bubbles:true, cancelable:true}));
  }
  console.log(`%c[Auto Pulse] Executed: ${text}`, 'color:#00ff00;font-weight:bold;');
  return true;
}

export function scanChat() {
  const chatContainer = document.querySelector('ol[class*="scroller"]') || document.querySelector('[class*="scrollerInner"]');
  if (!chatContainer) return;
  const messages = chatContainer.querySelectorAll('li[class*="message"]');
  if (!messages.length) return;
  const recent = Array.from(messages).slice(-6);
  for (let msg of recent) {
    const text = msg.innerText.toLowerCase();
    const html = msg.innerHTML.toLowerCase();
    // captcha
    const captchaTriggers = ["captcha","are you a human","verify","link.owo.bot","banned","type the code","security check"];
    if (captchaTriggers.some(t => text.includes(t)) || html.includes("captcha")) {
      return "captcha";
    }
    // cooldown
    if (text.includes("on cooldown") || text.includes("cooldown")) {
      return "cooldown";
    }
  }
  return null;
}

export function parseBalance(text) {
  // extract number from "OwO: 1,234 coins"
  const match = text.replace(/,/g, '').match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

export function triggerAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(1, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.5);
  } catch (e) {}
}

export function triggerNotification(msg) {
  if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
    new Notification("⚠️ Auto Pulse Alert!", { body: msg });
  }
}

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
  // --- METHOD 1: Focus-free contenteditable injection ---
  let chatInput = document.querySelector('div[role="textbox"]');
  if (chatInput) {
    try {
      // Set text without focusing
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      // For contenteditable div, we need to set innerText and dispatch input
      chatInput.innerText = text;
      chatInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
      
      // Click send button
      const sendBtn = document.querySelector('button[aria-label="Send"]') || 
                      document.querySelector('button[aria-label="Send Message"]') || 
                      document.querySelector('button[class*="send"]') ||
                      document.querySelector('form button[type="submit"]');
      if (sendBtn) {
        sendBtn.click();
        console.log(`%c[Auto Pulse] Sent (focus-free): ${text}`, 'color:#00ff00;font-weight:bold;');
        return true;
      }
    } catch (e) {
      console.error('[Auto Pulse] Focus-free failed, trying paste method', e);
    }
  }

  // --- METHOD 2: Paste without focus (fallback) ---
  if (chatInput) {
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      });
      chatInput.dispatchEvent(pasteEvent);
      
      // Click send button
      const sendBtn = document.querySelector('button[aria-label="Send"]') || 
                      document.querySelector('button[aria-label="Send Message"]') || 
                      document.querySelector('button[class*="send"]') ||
                      document.querySelector('form button[type="submit"]');
      if (sendBtn) {
        sendBtn.click();
        console.log(`%c[Auto Pulse] Sent (paste no-focus): ${text}`, 'color:#00ff00;font-weight:bold;');
        return true;
      }
    } catch (e) {
      console.error('[Auto Pulse] Paste fallback failed', e);
    }
  }

  // --- METHOD 3: API (last resort, needs token) ---
  let token = localStorage.getItem('token') || window.localStorage.token;
  if (!token) {
    console.error('[Auto Pulse] All methods failed. No token found.');
    return false;
  }
  const match = window.location.pathname.match(/\/channels\/(?:@me|\d+)\/(\d+)/);
  if (!match) return false;
  const channelId = match[1];
  try {
    const response = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: text })
    });
    if (response.ok) {
      console.log(`%c[Auto Pulse] Sent (API): ${text}`, 'color:#00ff00;font-weight:bold;');
      return true;
    }
  } catch (e) {
    console.error('[Auto Pulse] API failed', e);
  }
  return false;
}

export function scanChat() {
  const chatContainer = document.querySelector('ol[class*="scroller"]') || document.querySelector('[class*="scrollerInner"]');
  if (!chatContainer) return null;
  const messages = chatContainer.querySelectorAll('li[class*="message"]');
  if (!messages.length) return null;
  const recent = Array.from(messages).slice(-6);
  for (let msg of recent) {
    const text = msg.innerText.toLowerCase();
    const html = msg.innerHTML.toLowerCase();
    if (["captcha","are you a human","verify","link.owo.bot","banned","type the code","security check"].some(t => text.includes(t)) || html.includes("captcha")) {
      return "captcha";
    }
    if (text.includes("on cooldown") || text.includes("cooldown")) return "cooldown";
  }
  return null;
}

export function parseBalance(text) {
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

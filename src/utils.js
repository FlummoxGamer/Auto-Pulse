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

export const featureStatus = {};
export function setFeatureStatus(feature, status) {
  featureStatus[feature] = status;
  window.dispatchEvent(new CustomEvent('ap-status-update', { detail: { feature, status } }));
}

export async function sendDiscordMessage(text, feature = 'general') {
  // 1. Get token using unsafeWindow (bypasses sandbox)
  let token = null;
  try {
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow.localStorage) {
      token = unsafeWindow.localStorage.getItem('token') || unsafeWindow.localStorage.token;
    } else if (typeof localStorage !== 'undefined') {
      token = localStorage.getItem('token') || window.localStorage.token;
    }
  } catch (e) {
    console.warn('[Auto Pulse] Token retrieval failed:', e);
  }

  if (token) {
    const match = window.location.pathname.match(/\/channels\/(?:@me|\d+)\/(\d+)/);
    if (match) {
      const channelId = match[1];
      const headers = {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Origin': 'https://discord.com',
        'Referer': window.location.href,
        'X-Super-Properties': btoa(JSON.stringify({
          os: "Android",
          browser: "Chrome",
          device: "",
          system_locale: "en-US",
          browser_user_agent: navigator.userAgent,
          browser_version: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || "0",
          os_version: "Android",
          release_channel: "stable",
          client_build_number: "0"
        }))
      };
      try {
        const response = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ content: text })
        });
        if (response.ok) {
          console.log(`%c[Auto Pulse] API Sent: ${text}`, 'color:#00ff00;font-weight:bold;');
          setFeatureStatus(feature, 'success');
          return true;
        } else {
          console.warn(`[Auto Pulse] API error ${response.status}, trying DOM method`);
        }
      } catch (e) {
        console.warn('[Auto Pulse] API network error, trying DOM method');
      }
    }
  }

  // 2. Fallback: DOM injection (still needs to work without keyboard)
  const chatInput = document.querySelector('div[role="textbox"]');
  if (chatInput) {
    try {
      chatInput.textContent = '';
      chatInput.innerText = text;
      chatInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
      await sleep(150);
      // Try clicking actual send button (if exists)
      const sendBtn = document.querySelector('button[aria-label="Send"]') ||
                      document.querySelector('button[aria-label="Send Message"]') ||
                      document.querySelector('button[class*="send"]') ||
                      document.querySelector('form button[type="submit"]');
      if (sendBtn) {
        sendBtn.click();
        console.log(`%c[Auto Pulse] DOM Sent (button): ${text}`, 'color:#00ff00;font-weight:bold;');
        setFeatureStatus(feature, 'success');
        return true;
      }
      // Fallback: Press Enter on the input
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true });
      chatInput.dispatchEvent(enterEvent);
      console.log(`%c[Auto Pulse] DOM Sent (Enter): ${text}`, 'color:#00ff00;font-weight:bold;');
      setFeatureStatus(feature, 'success');
      return true;
    } catch (e) {
      console.error('[Auto Pulse] DOM injection failed:', e);
    }
  }

  setFeatureStatus(feature, 'fail');
  console.error(`[Auto Pulse] Failed to send: ${text}`);
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
    if (["captcha", "are you a human", "verify", "link.owo.bot", "banned", "type the code", "security check"].some(t => text.includes(t)) || html.includes("captcha")) return "captcha";
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
  try {
    if (typeof GM_notification !== 'undefined') {
      GM_notification({ title: "Auto Pulse", text: msg });
      return;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      navigator.serviceWorker?.ready?.then(reg => reg.showNotification("Auto Pulse", { body: msg })).catch(() => alert(msg));
    } else {
      alert(msg);
    }
  } catch (e) {
    console.warn('[Auto Pulse] Notification failed:', e);
  }
}

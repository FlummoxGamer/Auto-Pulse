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
  // 1. Get Token (multi-fallback)
  let token = localStorage.getItem('token') || window.localStorage.token || sessionStorage.getItem('token');
  if (!token) {
    console.error('[Auto Pulse] Token not found. Please log into Discord Web in this browser.');
    return false;
  }

  // 2. Get Channel ID (handles both Servers and DMs)
  const match = window.location.pathname.match(/\/channels\/(?:@me|\d+)\/(\d+)/);
  if (!match) {
    console.error('[Auto Pulse] Channel ID not found. Open a channel or DM.');
    return false;
  }
  const channelId = match[1];

  // 3. Headers (Crucial to avoid 403 errors)
  const headers = {
    'Authorization': token,
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
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
      referrer: "",
      referring_domain: "",
      referrer_current: "",
      referring_domain_current: "",
      release_channel: "stable",
      client_build_number: "0",
      client_event_source: null
    }))
  };

  // 4. Send via API
  try {
    const response = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ content: text })
    });

    if (response.ok) {
      console.log(`%c[Auto Pulse] API Sent: ${text}`, 'color:#00ff00;font-weight:bold;');
      return true;
    } else {
      console.error(`[Auto Pulse] API Error ${response.status}`);
      return false;
    }
  } catch (e) {
    console.error('[Auto Pulse] Network Error:', e);
    return false;
  }
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

import { CONFIG } from './config.js';

// --- Global hard stop + abort controller ---
export let isHardStopped = false;
let abortController = new AbortController();

export function setHardStop(value) {
  isHardStopped = value;
  if (value) {
    abortController.abort();
    abortController = new AbortController();
  }
}

// --- Command Queue ---
const commandQueue = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  while (commandQueue.length > 0 && !isHardStopped) {
    const { text, feature, resolve } = commandQueue.shift();
    const success = await apiSend(text, feature);
    resolve(success); 
    await new Promise(r => setTimeout(r, getHumanDelay(CONFIG.QUEUE_DELAY_MIN, CONFIG.QUEUE_DELAY_MAX)));
  }
  isProcessingQueue = false;
}

export function enqueueCommand(text, feature = 'general') {
  if (isHardStopped) return Promise.resolve(false);
  return new Promise((resolve) => {
    commandQueue.push({ text, feature, resolve });
    processQueue();
  });
}

// --- Token & Bot ID capture ---
let capturedToken = null;
let capturedBotId = null;

function decodeUserIdFromToken(token) {
  try {
    const part = token.split('.')[0];
    let base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return atob(base64);
  } catch (e) { return null; }
}

function captureTokenFromHeaders(headers) {
  if (headers && headers.Authorization) {
    let token = headers.Authorization;
    if (token.startsWith('Bearer ')) token = token.slice(7);
    if (token && token.length > 20) {
      if (capturedToken !== token) {
        capturedToken = token;
        capturedBotId = decodeUserIdFromToken(token);
        GM_setValue('discord_token', token);
      }
    }
  }
}

const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  const options = args[1] || {};
  if (typeof url === 'string' && url.includes('discord.com/api')) captureTokenFromHeaders(options.headers);
  return originalFetch.apply(this, args);
};

const originalXHR = XMLHttpRequest.prototype.setRequestHeader;
XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
  if (name.toLowerCase() === 'authorization') captureTokenFromHeaders({ Authorization: value });
  return originalXHR.call(this, name, value);
};

async function getToken() {
  if (capturedToken) return capturedToken;
  return await GM_getValue('discord_token', null);
}

// --- Utilities ---
export function getHumanDelay(min, max) {
  const u1 = Math.random();
  const u2 = Math.random();
  const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
  const mean = (min + max) / 2;
  const stdDev = (max - min) / 6;
  const delay = Math.round(mean + randStdNormal * stdDev);
  return Math.min(Math.max(delay, min), max);
}

export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export function sanitizeText(text) {
  return text.replace(/[\u200B-\u200F\u2060\uFEFF]/g, '');
}

export const featureStatus = {};
export function setFeatureStatus(feature, status) {
  featureStatus[feature] = status;
  window.dispatchEvent(new CustomEvent('ap-status-update', { detail: { feature, status } }));
}

async function apiSend(text, feature = 'general') {
  await sleep(getHumanDelay(CONFIG.MESSAGE_JITTER_MIN, CONFIG.MESSAGE_JITTER_MAX));
  if (isHardStopped) return false;

  const token = await getToken();
  if (!token) return false;
  const match = window.location.pathname.match(/\/channels\/(?:@me|\d+)\/(\d+)/);
  if (!match) return false;
  const channelId = match[1];

  const headers = {
    'Authorization': token, 'Content-Type': 'application/json', 'Accept': '*/*',
    'Origin': 'https://discord.com', 'Referer': window.location.href,
    'X-Super-Properties': btoa(JSON.stringify({ os: "Android", browser: "Chrome", device: "", system_locale: "en-US", browser_user_agent: navigator.userAgent, browser_version: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || "0", os_version: "Android", release_channel: "stable", client_build_number: "0" })),
    'X-Discord-Locale': 'en-US', 'X-Discord-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
  };

  try {
    const response = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, {
      method: 'POST', headers, body: JSON.stringify({ content: text }),
      signal: abortController.signal
    });
    if (response.ok) {
      console.log(`%c[Auto Pulse] API Sent: ${text}`, 'color:#00ff00;font-weight:bold;');
      setFeatureStatus(feature, 'success');
      return true;
    }
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('[Auto Pulse] API send error:', e);
  }
  setFeatureStatus(feature, 'fail');
  return false;
}

export async function sendDiscordMessage(text, feature = 'general') {
  if (isHardStopped) return false;
  return enqueueCommand(text, feature);
}

// --- Smart Chat Scan (Returns object with type and trigger phrase) ---
export function scanChat(newNode = null) {
  let messages = [];

  if (newNode) {
    if (newNode.nodeName === 'LI' || newNode.classList.contains('message')) {
      messages = [newNode];
    } else {
      const innerMsg = newNode.querySelector('li[class*="message"]');
      if (innerMsg) messages = [innerMsg];
    }
  } else {
    const chatContainer = document.querySelector('ol[class*="scroller"]') || document.querySelector('[class*="scrollerInner"]');
    if (!chatContainer) return null;
    messages = Array.from(chatContainer.querySelectorAll('li[class*="message"]')).slice(-10);
  }

  for (let msg of messages) {
    const contentEl = msg.querySelector('[id^="message-content-"]');
    const content = contentEl ? contentEl.innerText.toLowerCase() : msg.innerText.toLowerCase();
    const text = sanitizeText(content);
    
    const avatarImg = msg.querySelector('img[class*="avatar"]');
    const avatarSrc = avatarImg ? avatarImg.src : '';
    const idMatch = avatarSrc.match(/\/avatars\/(\d+)\//) || avatarSrc.match(/\/users\/(\d+)\//);
    const authorId = idMatch ? idMatch[1] : 'unknown';

    const isBot = msg.querySelector('[class*="botTag"]') !== null || msg.innerHTML.includes('botTag');
    const isTrackedUser = CONFIG.TRACKED_IDS.includes(authorId) || (capturedBotId && authorId === capturedBotId);
    const isOwO = msg.innerHTML.toLowerCase().includes('owo');

    if (newNode) {
      console.log(`[Chat Scan] Author ID: "${authorId}" | Content: "${text}"`);
      console.log(`[Chat Scan] isBot: ${isBot}, isTrackedUser: ${isTrackedUser}, isOwO: ${isOwO}`);
    }

    if (!isBot && !isTrackedUser && !isOwO) continue;

    // Helper to return clean trigger text
    const makeTrigger = (t) => t.length > 100 ? t.slice(0, 100) + '...' : t;

    const highConfidence = ["human", "captcha", "banned", "security check", "verify", "automated"];
    for (let word of highConfidence) {
      if (text.includes(word)) {
        console.warn(`[Chat Scan] High-confidence trigger: "${word}"`);
        return { type: "captcha", trigger: makeTrigger(text) };
      }
    }

    for (let pattern of CONFIG.TRAINING_PATTERNS) {
      if (text.includes(pattern)) {
        console.warn(`[Chat Scan] Training pattern trigger: "${pattern}"`);
        return { type: "captcha", trigger: makeTrigger(text) };
      }
    }

    if (text.includes('owobot.com')) {
      console.warn('[Chat Scan] Warning link detected');
      return { type: "captcha", trigger: makeTrigger(text) };
    }

    if (text.includes("on cooldown") || text.includes("cooldown")) return { type: "cooldown" };
  }
  return null;
}

export function parseBalance(text) {
  const match = text.replace(/,/g, '').match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.2);
  } catch (e) {}
}

export function triggerNotification(msg) {
  try {
    if (typeof GM_notification !== 'undefined') { GM_notification({ title: "Auto Pulse", text: msg }); return; }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') navigator.serviceWorker?.ready?.then(reg => reg.showNotification("Auto Pulse", { body: msg })).catch(() => alert(msg));
  } catch (e) {}
  }

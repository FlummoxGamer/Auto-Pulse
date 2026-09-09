import { CONFIG } from './config.js';

let capturedToken = null;

function captureTokenFromHeaders(headers) {
  if (headers && headers.Authorization) {
    let token = headers.Authorization;
    if (token.startsWith('Bearer ')) token = token.slice(7);
    if (token && token.length > 20) {
      if (capturedToken !== token) {
        capturedToken = token;
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

export const featureStatus = {};
export function setFeatureStatus(feature, status) {
  featureStatus[feature] = status;
  window.dispatchEvent(new CustomEvent('ap-status-update', { detail: { feature, status } }));
}

export async function sendDiscordMessage(text, feature = 'general') {
  await sleep(getHumanDelay(CONFIG.MESSAGE_JITTER_MIN, CONFIG.MESSAGE_JITTER_MAX));
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
    const response = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, { method: 'POST', headers, body: JSON.stringify({ content: text }) });
    if (response.ok) { console.log(`%c[Auto Pulse] API Sent: ${text}`, 'color:#00ff00;font-weight:bold;'); setFeatureStatus(feature, 'success'); return true; }
  } catch (e) {}
  setFeatureStatus(feature, 'fail'); return false;
}

export function scanChat() {
  const chatContainer = document.querySelector('ol[class*="scroller"]') || document.querySelector('[class*="scrollerInner"]');
  if (!chatContainer) return null;
  const messages = chatContainer.querySelectorAll('li[class*="message"]');
  if (!messages.length) return null;
  const recent = Array.from(messages).slice(-10);
  for (let msg of recent) {
    const text = msg.innerText.toLowerCase();
    const html = msg.innerHTML.toLowerCase();
    if (["captcha", "are you a real human", "please complete", "link below", "type the code", "verify", "human(1/5)", "automated", "security check", "you're doing that too fast", "stop! you're doing that too fast"].some(k => text.includes(k) || html.includes(k))) return "captcha";
    if (text.includes("on cooldown") || text.includes("cooldown")) return "cooldown";
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

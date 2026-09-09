import { CONFIG } from './config.js';

// --- Token auto-capture from network requests ---
let capturedToken = null;

function captureTokenFromHeaders(headers) {
  if (headers && headers.Authorization) {
    let token = headers.Authorization;
    if (token.startsWith('Bearer ')) token = token.slice(7);
    if (token && token.length > 20) {
      capturedToken = token;
      GM_setValue('discord_token', token);
      console.log('[Auto Pulse] Captured live token (length: ' + token.length + ')');
    }
  }
}

// Intercept all fetch calls to Discord
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  const options = args[1] || {};
  if (typeof url === 'string' && url.includes('discord.com/api')) {
    captureTokenFromHeaders(options.headers);
  }
  return originalFetch.apply(this, args);
};

// Also intercept XMLHttpRequest (Discord sometimes uses it)
const originalXHR = XMLHttpRequest.prototype.setRequestHeader;
XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
  if (name.toLowerCase() === 'authorization') {
    captureTokenFromHeaders({ Authorization: value });
  }
  return originalXHR.call(this, name, value);
};

// Get token from GM storage, or use captured token
async function getToken() {
  if (capturedToken) return capturedToken;
  let token = await GM_getValue('discord_token', null);
  if (token) return token;
  // If no token yet, wait for a network request to capture it (will happen quickly)
  console.warn('[Auto Pulse] Waiting for Discord to make a request to capture token...');
  return null;
}

export function getHumanDelay(min, max) { /* same as before */ }
export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
export const featureStatus = {};
export function setFeatureStatus(feature, status) {
  featureStatus[feature] = status;
  window.dispatchEvent(new CustomEvent('ap-status-update', { detail: { feature, status } }));
}

export async function sendDiscordMessage(text, feature = 'general') {
  const token = await getToken();
  if (!token) {
    console.error('[Auto Pulse] Token not captured yet. Wait a few seconds.');
    return false;
  }

  const match = window.location.pathname.match(/\/channels\/(?:@me|\d+)\/(\d+)/);
  if (!match) return false;
  const channelId = match[1];

  const headers = {
    'Authorization': token,
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Origin': 'https://discord.com',
    'Referer': window.location.href,
    'X-Super-Properties': btoa(JSON.stringify({ os: "Android", browser: "Chrome", device: "", system_locale: "en-US", browser_user_agent: navigator.userAgent, browser_version: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || "0", os_version: "Android", release_channel: "stable", client_build_number: "0" })),
    'X-Discord-Locale': 'en-US',
    'X-Discord-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
  };

  try {
    const response = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, {
      method: 'POST', headers, body: JSON.stringify({ content: text })
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

  // Fallback: DOM injection (still no keyboard)
  const chatInput = document.querySelector('div[role="textbox"]');
  if (chatInput) {
    try {
      chatInput.textContent = '';
      chatInput.innerText = text;
      chatInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
      await sleep(150);
      const sendBtn = document.querySelector('button[aria-label="Send"]') || document.querySelector('button[class*="send"]');
      if (sendBtn) sendBtn.click();
      setFeatureStatus(feature, 'success');
      return true;
    } catch (e) {}
  }
  setFeatureStatus(feature, 'fail');
  return false;
}
// rest of functions (scanChat, parseBalance, etc.) remain unchanged

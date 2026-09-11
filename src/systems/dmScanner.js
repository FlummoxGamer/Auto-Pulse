import { CONFIG } from '../core/config.js';
import { sanitizeText, playNotificationSound, triggerNotification } from '../core/utils.js';

let lastProcessedIds = new Set();
let pollInterval = null;
let stopCallback = null;
let websocketHooked = false;
let tokenFn = null;
let isRunningFn = () => false;

// Shared scanner used by both WebSocket and Polling
function scanDMMessage(authorId, content, authorName, isBot, source) {
  if (!isRunningFn()) return;  // Option B: only scan while bot is running
  if (!content) return;
  if (!isBot && !CONFIG.TRACKED_IDS.includes(authorId)) return;

  const text = sanitizeText(content.toLowerCase());
  let trigger = null;

  const highConfidence = ["human", "captcha", "banned", "security check", "verify", "automated"];
  for (const word of highConfidence) {
    if (text.includes(word)) { trigger = text.slice(0, 100); break; }
  }
  if (!trigger) {
    for (const pattern of CONFIG.TRAINING_PATTERNS) {
      if (text.includes(pattern)) { trigger = text.slice(0, 100); break; }
    }
  }
  if (!trigger && text.includes('owobot.com')) trigger = text.slice(0, 100);

  if (trigger) {
    console.warn(`[DM Scan] ${source} warning! Trigger: "${trigger}"`);
    playNotificationSound();
    triggerNotification(`DM warning (${source})! Bot stopped.\nTrigger: "${trigger}"`);
    if (stopCallback) stopCallback();
  }
}

// --- WebSocket hook (real-time) ---
export function initWebSocketHook(getTokenFn, onStop, isRunning) {
  if (websocketHooked) return;
  websocketHooked = true;
  tokenFn = getTokenFn;
  stopCallback = onStop;
  isRunningFn = isRunning || (() => false);

  try {
    const origAdd = WebSocket.prototype.addEventListener;
    WebSocket.prototype.addEventListener = function(type, listener, ...args) {
      if (type === 'message') {
        const wrapped = function(event) {
          try {
            if (typeof event.data === 'string' && event.data.includes('MESSAGE_CREATE')) {
              const packet = JSON.parse(event.data);
              if (packet.t === 'MESSAGE_CREATE' && packet.d && !packet.d.guild_id && packet.d.author) {
                const msg = packet.d;
                if (!lastProcessedIds.has(msg.id)) {
                  lastProcessedIds.add(msg.id);
                  if (lastProcessedIds.size > 200) {
                    lastProcessedIds.delete(lastProcessedIds.values().next().value);
                  }
                  scanDMMessage(
                    msg.author.id,
                    msg.content || '',
                    msg.author.username || '',
                    !!msg.author.bot,
                    'WS'
                  );
                }
              }
            }
          } catch (e) {}
          return listener.call(this, event);
        };
        return origAdd.call(this, type, wrapped, ...args);
      }
      return origAdd.call(this, type, listener, ...args);
    };
    console.log('[DM Scanner] WebSocket hook installed.');
  } catch (e) {
    console.warn('[DM Scanner] WebSocket hook failed:', e);
  }
}

// --- Polling (backup, every 30s) ---
async function pollDMs() {
  if (!isRunningFn()) return;
  try {
    const token = tokenFn ? await tokenFn() : null;
    if (!token) return;

    const res = await fetch('https://discord.com/api/v9/users/@me/channels', {
      headers: { 'Authorization': token }
    });
    if (!res.ok) return;
    const channels = await res.json();

    for (const ch of channels) {
      if (ch.type !== 1 && ch.type !== 3) continue;
      const msgRes = await fetch(`https://discord.com/api/v9/channels/${ch.id}/messages?limit=5`, {
        headers: { 'Authorization': token }
      });
      if (!msgRes.ok) continue;
      const messages = await msgRes.json();
      for (const msg of messages) {
        if (!msg.author || lastProcessedIds.has(msg.id)) continue;
        lastProcessedIds.add(msg.id);
        if (lastProcessedIds.size > 200) {
          lastProcessedIds.delete(lastProcessedIds.values().next().value);
        }
        scanDMMessage(
          msg.author.id,
          msg.content || '',
          msg.author.username || '',
          !!msg.author.bot,
          'Poll'
        );
      }
    }
  } catch (e) {
    console.warn('[DM Scanner] Polling error:', e);
  }
}

export function startPolling(getTokenFn, onStop, isRunning) {
  tokenFn = getTokenFn;
  if (onStop) stopCallback = onStop;
  if (isRunning) isRunningFn = isRunning;
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(pollDMs, CONFIG.DM_POLL_INTERVAL);
  console.log(`[DM Scanner] Polling started (every ${CONFIG.DM_POLL_INTERVAL / 1000}s).`);
}

export function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
            }

import { CONFIG } from './config.js';

// --- 1. Visibility Spoofing ---
function enableVisibilitySpoof() {
  try {
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    window.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
    console.log('[Keep-Alive] Visibility Spoof active.');
  } catch (e) { console.warn('[Keep-Alive] Visibility Spoof failed.'); }
}

// --- 2. Web Worker ---
let keepAliveWorker = null;
let blipTimer = null;

function startWorker() {
  if (keepAliveWorker) return;
  try {
    const workerCode = `setInterval(() => { postMessage('ping'); }, 1000);`;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    keepAliveWorker = new Worker(URL.createObjectURL(blob));
    keepAliveWorker.onmessage = () => {};
    console.log('[Keep-Alive] Web Worker active.');
  } catch (e) { console.warn('[Keep-Alive] Web Worker failed.'); }
}

// --- 3. MediaSession + Blip Method ---
let blipAudio = null;

function createBlipAudio() {
  // Create a 0.1-second silent WAV
  const sampleRate = 44100, duration = 0.1;
  const buffer = new ArrayBuffer(44 + Math.floor(sampleRate * duration * 2));
  const view = new DataView(buffer);
  const writeString = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeString(0, 'RIFF'); view.setUint32(4, 36 + Math.floor(sampleRate * duration * 2), true); writeString(8, 'WAVE');
  writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeString(36, 'data'); view.setUint32(40, Math.floor(sampleRate * duration * 2), true);
  
  const blob = new Blob([buffer], { type: 'audio/wav' });
  return new Audio(URL.createObjectURL(blob));
}

function playBlip() {
  if (!blipAudio) blipAudio = createBlipAudio();
  blipAudio.volume = 0.01;
  blipAudio.currentTime = 0;
  blipAudio.play().catch(() => {});
}

export function startKeepAlive() {
  if (!CONFIG.ENABLE_KEEP_ALIVE) return;
  
  enableVisibilitySpoof();
  startWorker();

  // MediaSession metadata (shows the sticky notification)
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Auto Pulse - Keep-Alive Active',
      artist: 'Bot is running in the background',
      album: 'Bot Engine'
    });
    navigator.mediaSession.playbackState = 'playing';
  }

  // Play first blip immediately
  playBlip();

  // Then repeat every 12 seconds
  if (blipTimer) clearInterval(blipTimer);
  blipTimer = setInterval(() => {
    if (CONFIG.ENABLE_KEEP_ALIVE) playBlip();
  }, 12000);

  console.log('[Keep-Alive] Blip method active (every 12s).');
}

export function stopKeepAlive() {
  if (keepAliveWorker) { keepAliveWorker.terminate(); keepAliveWorker = null; }
  if (blipTimer) { clearInterval(blipTimer); blipTimer = null; }
  if (blipAudio) { blipAudio.pause(); blipAudio = null; }
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  }
  console.log('[Keep-Alive] Stopped.');
                                                         }

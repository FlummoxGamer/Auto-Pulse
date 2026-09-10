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

// --- 3. 1-Second Looping Audio (Ducking Attempt) ---
let keepAliveAudio = null;
let watchdogInterval = null;

function createShortAudio() {
  const sampleRate = 44100;
  const duration = 1; // 1 second loop
  const totalSamples = sampleRate * duration;
  
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);
  const writeString = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  
  // WAV Header
  writeString(0, 'RIFF'); view.setUint32(4, 36 + totalSamples * 2, true); writeString(8, 'WAVE');
  writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeString(36, 'data'); view.setUint32(40, totalSamples * 2, true);
  
  // Fill with a very quiet 440Hz tone
  for (let i = 0; i < totalSamples; i++) {
    const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.01;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }
  
  const blob = new Blob([buffer], { type: 'audio/wav' });
  return new Audio(URL.createObjectURL(blob));
}

export function startKeepAlive() {
  if (!CONFIG.ENABLE_KEEP_ALIVE) return;
  
  enableVisibilitySpoof();
  startWorker();

  if (!keepAliveAudio) {
    try {
      keepAliveAudio = createShortAudio();
      keepAliveAudio.loop = true;
      keepAliveAudio.volume = 0.01; 
      
      // MediaSession Metadata
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Auto Pulse - Keep-Alive Active',
          artist: 'Bot is running in the background',
          album: 'Ducking Engine'
        });
        navigator.mediaSession.playbackState = 'playing';
      }
      
      keepAliveAudio.play().catch(() => console.warn('[Keep-Alive] Audio blocked. Tap screen to activate.'));
      console.log('[Keep-Alive] 1-Second looping audio active.');
      
      // Watchdog: Only resume if paused
      if (watchdogInterval) clearInterval(watchdogInterval);
      watchdogInterval = setInterval(() => {
        if (!CONFIG.ENABLE_KEEP_ALIVE) return;
        if (keepAliveAudio && keepAliveAudio.paused) {
          console.log('[Keep-Alive] Watchdog: Audio paused, attempting resume...');
          keepAliveAudio.play().catch(() => {});
        }
      }, 5000);
      
    } catch (e) { console.warn('[Keep-Alive] Audio setup failed.'); }
  } else {
    keepAliveAudio.play().catch(()=>{});
  }
}

export function stopKeepAlive() {
  if (keepAliveWorker) { keepAliveWorker.terminate(); keepAliveWorker = null; }
  if (watchdogInterval) { clearInterval(watchdogInterval); watchdogInterval = null; }
  if (keepAliveAudio) { keepAliveAudio.pause(); keepAliveAudio = null; }
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  }
  console.log('[Keep-Alive] Stopped.');
        }

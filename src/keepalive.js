import { CONFIG } from './config.js';

// --- 1. Visibility Spoofing ---
// Forces the browser to think the tab is always visible, even when you switch apps.
function enableVisibilitySpoof() {
  try {
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    window.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
    console.log('[Keep-Alive] Visibility Spoof active.');
  } catch (e) { console.warn('[Keep-Alive] Visibility Spoof failed.'); }
}

// --- 2. Web Worker (Prevents Browser Throttling) ---
let keepAliveWorker = null;
function startWorker() {
  if (keepAliveWorker) return;
  try {
    const workerCode = `
      setInterval(() => { postMessage('ping'); }, 1000);
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    keepAliveWorker = new Worker(URL.createObjectURL(blob));
    keepAliveWorker.onmessage = () => { /* Keeps the main thread awake */ };
    console.log('[Keep-Alive] Web Worker active.');
  } catch (e) { console.warn('[Keep-Alive] Web Worker failed.'); }
}

// --- 3. MediaSession API & Silent Audio ---
let keepAliveAudio = null;

export function startKeepAlive() {
  if (!CONFIG.ENABLE_KEEP_ALIVE) return;
  
  enableVisibilitySpoof();
  startWorker();

  if (!keepAliveAudio) {
    try {
      // Generate a 10-second silent WAV
      const sampleRate = 44100, duration = 10;
      const buffer = new ArrayBuffer(44 + sampleRate * duration * 2);
      const view = new DataView(buffer);
      const writeString = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
      writeString(0, 'RIFF'); view.setUint32(4, 36 + sampleRate * duration * 2, true); writeString(8, 'WAVE');
      writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      writeString(36, 'data'); view.setUint32(40, sampleRate * duration * 2, true);
      
      const blob = new Blob([buffer], { type: 'audio/wav' });
      keepAliveAudio = new Audio(URL.createObjectURL(blob));
      keepAliveAudio.loop = true;
      keepAliveAudio.volume = 0.01; // Extremely quiet, but not completely silent to keep Android from killing it
      
      // Auto-resume if Android pauses it
      keepAliveAudio.onpause = () => { 
          setTimeout(() => { 
              if (CONFIG.ENABLE_KEEP_ALIVE && keepAliveAudio) keepAliveAudio.play().catch(()=>{}); 
          }, 1000); 
      };
      
      keepAliveAudio.play().catch(() => console.warn('[Keep-Alive] Audio blocked by browser. User interaction needed.'));
      
      // MediaSession API
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Auto Pulse',
          artist: 'Running in background...',
          album: 'Bot Engine'
        });
        navigator.mediaSession.playbackState = 'playing';
      }
      console.log('[Keep-Alive] MediaSession and Silent Audio active.');
    } catch (e) { console.warn('[Keep-Alive] Audio setup failed.'); }
  } else {
    keepAliveAudio.play().catch(()=>{});
  }
}

export function stopKeepAlive() {
  if (keepAliveWorker) { keepAliveWorker.terminate(); keepAliveWorker = null; }
  if (keepAliveAudio) { keepAliveAudio.pause(); keepAliveAudio = null; }
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  }
  console.log('[Keep-Alive] Stopped.');
      }

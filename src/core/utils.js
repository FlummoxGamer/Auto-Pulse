// src/core/utils.js

/**
 * Utility helper to pause execution for a specified time.
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates a random integer between min and max (inclusive).
 * Useful for human-like delays to avoid rate limits.
 * @param {number} min - Minimum milliseconds.
 * @param {number} max - Maximum milliseconds.
 * @returns {number}
 */
export const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

/**
 * Sends a command to the OwO bot via Discord chat.
 * Simulates typing and pressing Enter to send the message.
 * @param {string} command - The command to send (e.g., 'owo hunt').
 */
export async function apiSend(command) {
  // Find the Discord chat input (works on modern Discord web)
  const chatInput = document.querySelector('div[role="textbox"][data-slate-editor="true"]') || 
                    document.querySelector('div[contenteditable="true"]');
  
  if (!chatInput) {
    console.error('[Auto-Pulse] Chat input not found. Make sure Discord is open and focused.');
    return;
  }

  // Focus the input to ensure it's ready
  chatInput.focus();
  await sleep(50); // Tiny wait for focus

  // Insert the command text
  // execCommand is used to mimic native typing which helps React/Slate detect the change
  document.execCommand('insertText', false, command);
  
  // Dispatch an input event to notify Discord's framework of the change
  chatInput.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(50); 

  // Simulate pressing the Enter key
  const enterEvent = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    keyCode: 13,
    key: 'Enter',
    code: 'Enter'
  });
  chatInput.dispatchEvent(enterEvent);

  // --- FIX 8: Update Cooldown Timestamps ---
  // Update the global timestamps so the UI can track real-time cooldowns
  if (command.includes('hunt')) window.cdTimestamps.hunt = Date.now();
  if (command.includes('battle')) window.cdTimestamps.battle = Date.now();
  if (command.includes('cf') || command.includes('coinflip')) window.cdTimestamps.cf = Date.now();

  // Random human-like delay before the next command to avoid rate limits
  await sleep(randomDelay(800, 1500));
}

/**
 * Parses the log text from Discord to extract OwO bot events.
 * Updates the global stats object and triggers a custom event for the UI.
 * @param {string} text - The text content of a chat message.
 */
export function parseLogs(text) {
  if (!text || typeof text !== 'string') return;

  const lowerText = text.toLowerCase();
  let updated = false;

  // Initialize global stats object if it doesn't exist
  if (!window.apStats) {
    window.apStats = { hunt: 0, battle: 0, cf: 0, cfTotal: 0, owo: 0 };
  }

  // --- Parse Hunt ---
  if (lowerText.includes('hunt') && lowerText.includes('found')) {
    window.apStats.hunt++;
    updated = true;
  }

  // --- Parse Battle ---
  if (lowerText.includes('battle') && lowerText.includes('won')) {
    window.apStats.battle++;
    updated = true;
  }

  // --- Parse Coinflip (CF) ---
  if (lowerText.includes('coinflip')) {
    if (lowerText.includes('won')) {
      window.apStats.cf++;
      updated = true;
    } else if (lowerText.includes('lost')) {
      window.apStats.cfTotal++;
      updated = true;
    }
  }

  // --- Parse OwO Count (General fallback) ---
  // Avoid double counting hunt/battle by checking they aren't in the text
  if (lowerText.includes('owo') && !lowerText.includes('hunt') && !lowerText.includes('battle') && !lowerText.includes('coinflip')) {
    window.apStats.owo++;
    updated = true;
  }

  // Dispatch a custom event with the parsed log and updated stats
  // This allows main.js to update the UI without direct dependencies
  const detail = { 
    text: text, 
    stats: window.apStats, 
    updated: updated 
  };
  
  window.dispatchEvent(new CustomEvent('ap-log', { detail }));
      }

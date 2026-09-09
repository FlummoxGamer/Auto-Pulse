export const CONFIG = {
  // Feature toggles
  ENABLE_HUNT: true,
  ENABLE_BATTLE: true,
  ENABLE_BLACKJACK: true,
  ENABLE_COINFLIP: true,
  ENABLE_PRAY: true,
  ENABLE_AUTO_GEMS: true,
  ENABLE_AUTO_ITEMS: true,
  ENABLE_KEEP_ALIVE: true,
  ENABLE_DM_SCAN: true,

  // Timers (randomized)
  HUNT_BATTLE_INTERVAL_MIN: 12000,   // 12s
  HUNT_BATTLE_INTERVAL_MAX: 16000,   // 16s
  HUNT_BATTLE_GAP_MIN: 2000,
  HUNT_BATTLE_GAP_MAX: 3000,
  BJ_CF_INTERVAL_MIN: 15000,         // 15s (fixed)
  BJ_CF_INTERVAL_MAX: 18000,         // 18s (fixed)
  PRE_COMMAND_PAUSE_MIN: 500,        // 0.5s
  PRE_COMMAND_PAUSE_MAX: 1500,       // 1.5s

  // Queue delays (for single-command queue)
  QUEUE_DELAY_MIN: 800,              // 0.8s
  QUEUE_DELAY_MAX: 1500,             // 1.5s

  // Message jitter (now 2–3 seconds)
  MESSAGE_JITTER_MIN: 2000,          // 2s
  MESSAGE_JITTER_MAX: 3000,          // 3s

  // Startup delays (between startup commands)
  STARTUP_DELAY_MIN: 5000,           // 5s
  STARTUP_DELAY_MAX: 8000,           // 8s

  // Recurring timers
  CASH_INTERVAL: 180000,             // 3 min
  INVENTORY_INTERVAL: 240000,        // 4 min
  ITEMS_INTERVAL: 540000,            // 9 min
  PRAY_INTERVAL: 300000,             // 5 min

  // Gambling
  BJ_BASE_BET: 10,
  BJ_MAX_BET: 320,
  CF_BASE_BET: 10,
  CF_MAX_BET: 320,

  // Bankroll
  BANKROLL_PERCENT: 0.10,
  PROFIT_TARGET_PERCENT: 0.05,
};

export const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
export const GEM_TYPES = {
  HUNTING:    ["057", "056", "055", "054", "053", "052", "051"],
  EMPOWERING: ["064", "063", "062", "061", "060", "059", "058"],
  LUCKY:      ["071", "070", "069", "068", "067", "066", "065"],
  SPECIAL:    ["078", "077", "076", "075", "074", "073", "072"]
};

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

  // Timers
  HUNT_BATTLE_INTERVAL_MIN: 12000,
  HUNT_BATTLE_INTERVAL_MAX: 16000,
  HUNT_BATTLE_GAP_MIN: 2000,
  HUNT_BATTLE_GAP_MAX: 3000,
  BJ_CF_INTERVAL_MIN: 15000,
  BJ_CF_INTERVAL_MAX: 18000,
  PRE_COMMAND_PAUSE_MIN: 500,
  PRE_COMMAND_PAUSE_MAX: 1500,
  QUEUE_DELAY_MIN: 800,
  QUEUE_DELAY_MAX: 1500,
  MESSAGE_JITTER_MIN: 2000,
  MESSAGE_JITTER_MAX: 3000,
  STARTUP_DELAY_MIN: 5000,
  STARTUP_DELAY_MAX: 8000,

  CASH_INTERVAL: 180000,
  INVENTORY_INTERVAL: 600000,
  ITEMS_INTERVAL: 540000,
  PRAY_INTERVAL: 300000,

  BJ_BASE_BET: 10,
  BJ_MAX_BET: 320,
  CF_BASE_BET: 10,
  CF_MAX_BET: 320,

  BANKROLL_PERCENT: 0.10,
  PROFIT_TARGET_PERCENT: 0.05,

  // --- TRACKED IDS (Only for testing from your main account) ---
  // The bot's own ID is automatically detected, no need to put it here!
  TRACKED_IDS: [
    atob("ODc5Nzc2NTg4Nzg5NjA4NTI5")
  ],

  // --- WARNING KEYWORD SET ---
  TRAINING_PATTERNS: [
    "you have been banned for 999999",
    "please refer to the owo bot rules",
    "advertising or involvement in selling",
    "cowoncy has been reset due to",
    "illegal gain of cowoncy",
    "multiple account usage is not allowed",
    "are you a real human",
    "please use the link below",
    "please complete this within 10 minutes",
    "please complete your captcha",
    "verify that you are human",
    "owobot.com/captcha",
    "human(1/5)",
    "you're doing that too fast",
    "stop! you're doing that too fast",
    "suspicious activity",
    "verification required",
    "security check",
    "automated"
  ]
};

export const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
export const GEM_TYPES = {
  HUNTING:    ["057", "056", "055", "054", "053", "052", "051"],
  EMPOWERING: ["064", "063", "062", "061", "060", "059", "058"],
  LUCKY:      ["071", "070", "069", "068", "067", "066", "065"],
  SPECIAL:    ["078", "077", "076", "075", "074", "073", "072"]
};

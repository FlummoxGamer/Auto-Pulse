export const CONFIG = {
  ENABLE_HUNT: true,
  ENABLE_BATTLE: true,
  ENABLE_BLACKJACK: true,
  ENABLE_COINFLIP: true,
  ENABLE_PRAY: true,
  ENABLE_AUTO_GEMS: true,
  ENABLE_AUTO_ITEMS: true,
  ENABLE_KEEP_ALIVE: true,

  // Timers
  HUNT_BATTLE_INTERVAL: 12000,   // 12s for hunt + battle loop
  HUNT_BATTLE_GAP_MIN: 2500,
  HUNT_BATTLE_GAP_MAX: 3000,
  BJ_CF_INTERVAL: 15000,         // 15s for gambling loop (now 15s)
  STEP_DELAY_MIN: 3000,
  STEP_DELAY_MAX: 5000,
  INTERVAL_MIN: 12000,
  INTERVAL_MAX: 15000,

  PRAY_INTERVAL: 300000,         // 5 minutes
  AUTO_GEMS_CHECK_INTERVAL: 20,  // every 20 cycles (4 mins)
  AUTO_ITEMS_INTERVAL: 45,       // every 45 cycles (9 mins)

  BJ_BASE_BET: 10,
  BJ_MAX_BET: 320,
  CF_BASE_BET: 10,
  CF_MAX_BET: 320,

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

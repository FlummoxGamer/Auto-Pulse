export const CONFIG = {
  // Feature toggles (default off – start manually)
  ENABLE_HUNT: false,
  ENABLE_BATTLE: false,
  ENABLE_BLACKJACK: false,
  ENABLE_COINFLIP: false,
  ENABLE_PRAY: false,
  ENABLE_AUTO_GEMS: false,
  ENABLE_AUTO_ITEMS: false,

  // Timers
  HUNT_BATTLE_GAP_MIN: 1500,
  HUNT_BATTLE_GAP_MAX: 2500,
  HUNT_BATTLE_INTERVAL: 10000,
  STEP_DELAY_MIN: 2800,
  STEP_DELAY_MAX: 5200,
  INTERVAL_MIN: 19000,
  INTERVAL_MAX: 26000,

  // Blackjack & Coinflip
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

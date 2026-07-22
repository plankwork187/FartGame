/* ============================================================================
   CHARSTATS.JS — CHARACTER STATS & CATEGORIES
   ============================================================================
   Every playable character has five stats (each scored 1–5) that influence
   real gameplay. Edit the values in CHARACTER_STATS below to tune balance.

   SIZE CATEGORIES (affects how characters look in future art passes):
     petite     — Ariana, Sabrina
     medium     — Olivia, Madelyn
     voluptuous — Beyoncé, Bryce

   THE FIVE STATS (all 1–5 — HIGHER IS ALWAYS HARDER):
   ┌──────────────┬──────────────────────────────────────────────────────────┐
   │ smell        │ 1 = barely pungent · 5 = eye-wateringly strong           │
   │              │ → multiplies effective smellLevel for clouds              │
   ├──────────────┼──────────────────────────────────────────────────────────┤
   │ linger       │ 1 = cloud vanishes fast · 5 = cloud hangs around forever │
   │              │ → multiplies cloud maxAge (lifetime)                      │
   ├──────────────┼──────────────────────────────────────────────────────────┤
   │ accident     │ 1 = near-perfect control · 5 = very accident-prone       │
   │              │ → HIGHER = more likely to accidentally fart               │
   │              │   (threshold drops, accidental gas release increases)     │
   ├──────────────┼──────────────────────────────────────────────────────────┤
   │ frequency    │ 1 = gas builds very slowly · 5 = gas builds very fast    │
   │              │ → multiplies passive gas fill-rate (gasFillRate)          │
   ├──────────────┼──────────────────────────────────────────────────────────┤
   │ volume       │ 1 = bone dry / quiet · 5 = very loud / noisy             │
   │              │ → multiplies effective loudLevel for pulses               │
   └──────────────┴──────────────────────────────────────────────────────────┘

   HOW TO EDIT
   ──────────────────────────────────────────────────────────────────────────
   1. Open this file (js/charstats.js).
   2. Find the character you want to tune inside CHARACTER_STATS below.
   3. Change any stat value from 1 to 5 (decimals like 3.5 are also fine).
   4. Save and reload — no other file needs touching.

   HOW STATS AFFECT GAMEPLAY (the multiplier math)
   ──────────────────────────────────────────────────────────────────────────
   Each stat converts its 1–5 value into a multiplier via statMult():
     statMult(1) = 0.40   (weakest — very noticeably easier)
     statMult(2) = 0.70
     statMult(3) = 1.00   (neutral)
     statMult(4) = 1.40
     statMult(5) = 1.90   (strongest — very noticeably harder)

   The wider range (0.40–1.90 vs old 0.60–1.55) makes stat differences
   much more noticeable between characters.

   ACCIDENT STAT — inverted threshold logic:
     accident 1 → threshold 120 (accidents almost never happen)
     accident 3 → threshold 100 (default game behaviour)
     accident 5 → threshold  70 (accidents happen very often)
   Accidental releases also scale gas output with accident level:
     accident 1 → releases only ~15 gas units
     accident 5 → releases ~40 gas units
   ============================================================================ */

const CHAR_STATS = (() => {

  // ── Master stat table ────────────────────────────────────────────────────
  // All stats 1–5. HIGHER = HARDER for every stat.
  // accident replaces old "control" — higher accident = more prone to accidents.
  // volume replaces old "wetness" — same loudness mechanic, renamed.
  //
  // TO EDIT: change the number next to the stat name for the character.
  //   e.g. to give Sabrina very fast gas build-up, set her frequency to 5.
  //   e.g. to make Ariana's farts linger barely at all, set her linger to 1.
  //
  const STATS = {

    // ── PETITE ──────────────────────────────────────────────────────────────
    ariana: {
      sizeCategory: 'petite',
      smell:     5,   // 1 (faint) → 5 (pungent)
      linger:    4,   // 1 (quick fade) → 5 (long-lasting cloud)
      accident:  1,   // 1 (near-perfect control) → 5 (very accident-prone)
      frequency: 2,   // 1 (slow build) → 5 (fast build)
      volume:    1,   // 1 (quiet/dry) → 5 (loud/wet)
    },

    sabrina: {
      sizeCategory: 'petite',
      smell:     3,
      linger:    2,
      accident:  2,
      frequency: 5,
      volume:    5,
    },

    // ── MEDIUM ───────────────────────────────────────────────────────────────
    olivia: {
      sizeCategory: 'medium',
      smell:     2,
      linger:    5,
      accident:  1,
      frequency: 5,
      volume:    4,
    },

    madelyn: {
      sizeCategory: 'medium',
      smell:     4,
      linger:    4,
      accident:  3,
      frequency: 2,
      volume:    4,
    },

    // ── VOLUPTUOUS ────────────────────────────────────────────────────────────
    'beyoncé': {
      sizeCategory: 'voluptuous',
      smell:     4,
      linger:    2,
      accident:  5,   // very accident-prone
      frequency: 4,
      volume:    5,
    },

    'bryce': {
      sizeCategory: 'voluptuous',
      smell:     3,
      linger:    3,
      accident:  3,
      frequency: 3,
      volume:    3,
    },

    // ── CHARACTERS 7–9 (now playable) ──────────────────────────────────────────
    // TO TUNE: change any stat 1–5. Remember: higher = harder for every stat.
    char7: {
      sizeCategory: 'petite',
      smell:     2,   // subtle but present
      linger:    1,   // clouds vanish quickly
      accident:  4,   // loses control more than she'd like to admit
      frequency: 3,   // steady build-up
      volume:    4,   // louder than expected
    },

    char8: {
      sizeCategory: 'medium',
      smell:     5,   // absolutely pungent
      linger:    3,   // hangs around
      accident:  2,   // decent control
      frequency: 1,   // slow build — rare but powerful
      volume:    2,   // quiet
    },

    char9: {
      sizeCategory: 'voluptuous',
      smell:     3,
      linger:    4,   // social situations make it worse
      accident:  3,
      frequency: 4,   // always in a rush = always gassy
      volume:    3,
    },
  };

  // ── Active session stats ─────────────────────────────────────────────────
  let active = null;
  let activeCharId = null;

  // ── Stat → multiplier ─────────────────────────────────────────────────────
  // Wider range than before: 1→0.40, 3→1.00, 5→1.90
  // This makes differences between stat levels much more noticeable.
  // Level 1 characters are noticeably easier; level 5 characters are noticeably harder.
  //
  // TO CHANGE THE RANGE: adjust the segment endpoints below.
  //   Lower segment (1→3): currently 0.40→1.00 (step of 0.30 per point)
  //   Upper segment (3→5): currently 1.00→1.90 (step of 0.45 per point)
  function statMult(v) {
    const clamped = Math.min(5, Math.max(1, v));
    if (clamped <= 3) return 0.40 + (clamped - 1) * 0.30;  // 1→0.40, 2→0.70, 3→1.00
    return 1.00 + (clamped - 3) * 0.45;                     // 3→1.00, 4→1.45, 5→1.90
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function setActiveCharacter(charId, customOverrides) {
    activeCharId = charId ? charId.toLowerCase() : null;
    const base = (activeCharId && STATS[activeCharId]) ? { ...STATS[activeCharId] } : defaultStats();
    active = customOverrides ? { ...base, ...customOverrides } : base;
  }

  function defaultStats() {
    return { sizeCategory: 'medium', smell: 3, linger: 3, accident: 3, frequency: 3, volume: 3 };
  }

  function getActive() { return active || defaultStats(); }
  function getSizeCategory(charId) {
    const id = (charId || '').toLowerCase();
    return (STATS[id] && STATS[id].sizeCategory) || 'medium';
  }
  function getAllStats() { return STATS; }

  // Convenience multiplier getters
  function getSmellMult()     { return statMult((active || defaultStats()).smell); }
  function getLingerMult()    { return statMult((active || defaultStats()).linger); }
  // Volume replaces wetness — same mechanic, renamed
  function getVolumeMult()    { return statMult((active || defaultStats()).volume); }
  // Keep getWetnessMult as alias so existing calls in game.js/cloud.js still work
  function getWetnessMult()   { return getVolumeMult(); }
  function getFrequencyMult() { return statMult((active || defaultStats()).frequency); }

  /**
   * Returns the gas level at which an involuntary fart fires.
   * Always returns 100 — accidents only fire when the bar is COMPLETELY full.
   * The accident stat instead controls how fast the bar fills near the top
   * (see getAccidentEndAccelMult below).
   */
  function getInvoluntaryThreshold() {
    return 100; // always full bar — no early accidents
  }

  /**
   * Returns a multiplier for how fast the gas bar fills in the 80–100 zone.
   * High accident stat = fills faster near top (accidents fire sooner after 100).
   * Low accident stat = fills slower near top (accidents rarely trigger).
   *   accident 1 → 0.30 (very slow near top — almost never hits 100)
   *   accident 3 → 1.00 (neutral)
   *   accident 5 → 2.50 (rushes to 100 — accidents fire quickly)
   *
   * TO TUNE: adjust the return values below.
   */
  function getAccidentEndAccelMult() {
    const s = (active || defaultStats()).accident;
    // accident 1→0.30, 2→0.60, 3→1.00, 4→1.70, 5→2.50
    const table = [0.30, 0.60, 1.00, 1.70, 2.50];
    return table[Math.min(4, Math.max(0, Math.round(s) - 1))];
  }

  /**
   * Returns how much gas is released in an involuntary fart, scaled to the
   * accident stat. Higher accident = releases more gas per accident.
   *   accident 1 → 15 gas units (barely anything)
   *   accident 3 → 25 gas units (moderate)
   *   accident 5 → 40 gas units (significant)
   *
   * TO CHANGE ACCIDENTAL RELEASE AMOUNT: adjust the return values below.
   */
  function getAccidentGasRelease() {
    const s = (active || defaultStats()).accident;
    // accident 1→15, 2→18, 3→25, 4→32, 5→40
    const table = [15, 18, 25, 32, 40];
    return table[Math.min(4, Math.max(0, Math.round(s) - 1))];
  }

  /**
   * Apply this character's frequency + accident stats to the PLAYER module.
   */
  function applyToPlayer(charId, customOverrides) {
    setActiveCharacter(charId, customOverrides);
    if (typeof PLAYER === 'undefined') return;
    if (typeof PLAYER.setStatFrequencyMult === 'function') {
      PLAYER.setStatFrequencyMult(getFrequencyMult());
    }
    if (typeof PLAYER.setInvoluntaryThreshold === 'function') {
      PLAYER.setInvoluntaryThreshold(getInvoluntaryThreshold()); // always 100
    }
    if (typeof PLAYER.setAccidentGasRelease === 'function') {
      PLAYER.setAccidentGasRelease(getAccidentGasRelease());
    }
    if (typeof PLAYER.setAccidentEndAccelMult === 'function') {
      PLAYER.setAccidentEndAccelMult(getAccidentEndAccelMult());
    }
  }

  return {
    setActiveCharacter,
    getActive,
    getSizeCategory,
    getAllStats,
    getSmellMult,
    getLingerMult,
    getVolumeMult,
    getWetnessMult,
    getFrequencyMult,
    getInvoluntaryThreshold,
    getAccidentGasRelease,
    getAccidentEndAccelMult,
    applyToPlayer,
    statMult,
  };
})();

/* ============================================================================
   MAIN.JS — APP BOOTSTRAP & SCREEN FLOW
   ============================================================================
   This file is the "glue": it owns PROGRESS (persisted save data), wires
   every UI callback to either show another screen or hand off to GAME,
   and is the only place that decides what happens AFTER a level ends
   (go to level-complete, then back to the story map / mode select / a
   freshly generated next level, depending on which mode was played).

   Boot order on DOMContentLoaded:
     1. Load/repair PROGRESS from localStorage.
     2. UI.init(PROGRESS) + GAME.init() wire up all static DOM.
     3. Show the title screen.
   ========================================================================= */

/* ----------------------------------------------------------------------
   PROGRESS — small persisted save-data wrapper (localStorage-backed).
   Shape: { highestLevelCleared, bestScore, totalGasReleased, timesCaught }
   Falls back gracefully (in-memory only) if localStorage is unavailable
   (e.g. private browsing / sandboxed iframe).
------------------------------------------------------------------------- */
const PROGRESS = (() => {
  const STORAGE_KEY = 'holdItIn_progress_v1';
  const DEFAULTS = { highestLevelCleared: 0, bestScore: 0, totalGasReleased: 0, timesCaught: 0 };
  let data = { ...DEFAULTS };
  let storageOk = true;

  function load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) data = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch (e) {
      storageOk = false;
    }
  }

  function save() {
    if (!storageOk) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      storageOk = false;
    }
  }

  function get() { return data; }

  function recordLevelResult(result) {
    if (result.mode === 'story' && result.success) {
      data.highestLevelCleared = Math.max(data.highestLevelCleared, result.levelNumber);
    }
    data.bestScore = Math.max(data.bestScore, result.score);
    data.totalGasReleased = Math.round(data.totalGasReleased + result.gasReleased);
    if (!result.success) data.timesCaught += 1;
    save();
  }

  function reset() {
    data = { ...DEFAULTS };
    save();
  }

  load();
  return { get, recordLevelResult, reset };
})();


/* ----------------------------------------------------------------------
   APP — screen-flow state machine sitting between UI and GAME.
------------------------------------------------------------------------- */
const APP = (() => {
  let selectedMode = null;
  let selectedCharacter = null;
  let storyLevelNumber = 1;
  let customOptions = null;

  // ── Screen history for the Back button ─────────────────────────────────
  // Every call to UI.showScreen() pushes to screenHistory. goBack() pops it.
  // The game screen and title screen are excluded from going "back into" via
  // the history stack (they have their own dedicated exit flows).
  //
  // TO ADD MORE EXCLUDED SCREENS: add them to BACK_EXCLUDED below.
  const BACK_EXCLUDED = new Set(['screen-game', 'screen-title']);
  const screenHistory = [];

  function init() {
    UI.init(PROGRESS);
    GAME.init();
    GAME.setCallbacks({ onLevelEnd: handleLevelEnd });
    UI.setOnModeChosen(handleModeChosen);
    UI.refreshModeSelect();
    // Patch UI.showScreen to record history for the back button
    const _origShowScreen = UI.showScreen.bind(UI);
    UI.showScreen = (id) => {
      const current = document.querySelector('.screen.screen-active');
      if (current && !BACK_EXCLUDED.has(current.id) && current.id !== id) {
        screenHistory.push(current.id);
      }
      _origShowScreen(id);
      updateBackBtn(id);
    };
    UI.showScreen('screen-title');
  }

  // Show/hide the back button. Hidden on title only. Always visible on all other screens.
  // On the game screen, back goes to character select (pausing the game first if running).
  function updateBackBtn(screenId) {
    const btn = document.getElementById('back-btn');
    if (!btn) return;
    if (screenId === 'screen-title') {
      btn.style.display = 'none';
    } else {
      btn.style.display = '';
    }
  }

  // Back button click — works from any non-title screen.
  // On the game screen: pause the game and go to character select.
  function goBack() {
    const current = document.querySelector('.screen.screen-active');
    if (current && current.id === 'screen-game') {
      // Pause first, then go to character select
      GAME.setPausedPublic && GAME.setPausedPublic(true);
      GAME.stop && GAME.stop();
      goToCharacterSelect();
      return;
    }
    if (screenHistory.length > 0) {
      const prev = screenHistory.pop();
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('screen-active'));
      const target = document.getElementById(prev);
      if (target) {
        target.classList.add('screen-active');
        window.scrollTo(0, 0);
      }
      updateBackBtn(prev);
    } else {
      UI.showScreen('screen-mode-select');
    }
  }

  // ── Mode select → character select (every mode needs a character) ────
  function handleModeChosen(modeId) {
    selectedMode = modeId;

    if (modeId === 'story') {
      storyLevelNumber = Math.min(31, PROGRESS.get().highestLevelCleared + 1);
    }

    UI.populateCharacterSelect((characterId) => {
      selectedCharacter = CHARACTERS[characterId];
      // Preload all face/body images for this character so facecam swaps
      // are instant during gameplay — no placeholder flash on first use.
      ASSETS.preloadCharacter(selectedCharacter).then(() => {
        afterCharacterChosen();
      });
    });
  }

  function afterCharacterChosen() {
    if (selectedMode === 'custom') {
      UI.populateCustomSetup((values) => {
        customOptions = values;
        beginCustomLevel();
      });
      return;
    }

    if (selectedMode === 'story' || selectedMode === 'endless') {
      UI.showStoryMap(() => {
        const levelNumber = selectedMode === 'endless'
          ? Math.max(31, PROGRESS.get().highestLevelCleared + 1)
          : storyLevelNumber;
        beginGeneratedLevel(levelNumber, selectedMode === 'endless' ? 'endless' : 'story');
      });
      return;
    }

    // Stealth + Chaos: no intro screen needed, jump straight into a level.
    if (selectedMode === 'stealth') {
      beginGeneratedLevel(randInt(1, 30), 'stealth');
    } else if (selectedMode === 'chaos') {
      beginGeneratedLevel(randInt(1, 30), 'chaos');
    }
  }

  // ── Building + intro-ing a procedurally generated level ────────────────
  function beginGeneratedLevel(levelNumber, mode, isRetry = false) {
    const levelDef = GENERATOR.buildLevel(levelNumber);

    if (mode === 'story' || mode === 'endless') {
      UI.showLevelIntro(levelDef, selectedCharacter, () => {
        GAME.start(levelDef, mode, selectedCharacter);
        UI.showScreen('screen-game');
      }, isRetry);
    } else {
      GAME.start(levelDef, mode, selectedCharacter);
      UI.showScreen('screen-game');
    }
  }

  // ── Custom mode: build a level-shaped object straight from the form ───
  function beginCustomLevel() {
    const v = customOptions;
    const location = LOCATIONS.find(l => l.id === v.locationId) || LOCATIONS[0];
    const time = TIMES_OF_DAY.find(t => t.id === v.timeId) || TIMES_OF_DAY[0];
    const companion = COMPANIONS.find(c => c.id === v.companionId) || COMPANIONS[0];
    const modifier = MODIFIERS.find(m => m.id === v.modifierId) || MODIFIERS[0];

    const levelDef = {
      levelNumber: 0,
      isEndless: false,
      location, time, companion,
      modifiers: [modifier],
      reason: randFrom(location.flavorReasons),
      npcDensity: v.npcDensity,
      environmentNoise: v.environmentNoise,
      gasPressureLevel: v.gasPressureLevel,
      smellLevel: v.smellLevel,
      loudLevel: v.loudLevel,
      targetGas: v.targetGas,
      timeLimitMs: 150000,
      difficultyScore: Math.round(clamp(
        (v.npcDensity * 2.2) + (v.gasPressureLevel * 1.8) +
        (v.smellLevel * 1.2) + (v.loudLevel * 1.2) +
        (1 - v.environmentNoise) * 1.2, 0, 10
      )),
    };

    UI.showLevelIntro(levelDef, selectedCharacter, () => {
      GAME.start(levelDef, 'custom', selectedCharacter);
      UI.showScreen('screen-game');
    });
  }

  // ── After a level ends ──────────────────────────────────────────────────
  function handleLevelEnd(result) {
    GAME.stop();

    if (result.caught) {
      // Suspicion maxed out — show the dedicated caught/failure screen
      // (character's caught facecam + failure line) for ANY suspicion
      // mode (story, stealth, custom, endless), instead of jumping
      // straight back into a VN intro or (worse) the success screen.
      PROGRESS.recordLevelResult(result);
      UI.refreshModeSelect();
      UI.showCaughtScreen(
        result,
        selectedCharacter,
        () => retrySameRun(result),
        () => goToCharacterSelect(),
        () => UI.showScreen('screen-mode-select'),
        result.mode === 'custom' ? () => {
          // "Change Settings" for custom mode — go back to setup form
          UI.populateCustomSetup((values) => {
            customOptions = values;
            beginCustomLevel();
          });
        } : null
      );
      return;
    }

    if (result.exitedToMenu) {
      // Deliberate "Back to Modes" from the pause screen — not a catch,
      // not a win, just record stats and go straight back to mode select.
      PROGRESS.recordLevelResult(result);
      UI.showScreen('screen-mode-select');
      return;
    }

    if (result.success && (result.mode === 'story' || result.mode === 'custom' || result.mode === 'endless')) {
      PROGRESS.recordLevelResult(result);
      UI.refreshModeSelect();
      UI.showLevelComplete(result, selectedCharacter, () => handleCompleteNext(result), () => UI.showScreen('screen-mode-select'));
      return;
    }

    // Stealth / Chaos: still record stats for the story map's lifetime
    // totals, but route straight back to mode select rather than the
    // level-complete screen (those modes have no "next level" concept).
    PROGRESS.recordLevelResult(result);
    UI.showScreen('screen-mode-select');
  }

  // "Try Again" from the caught screen — retry the same run, the way each
  // mode's own "Try Again" already works elsewhere:
  //   story/endless — rebuild + re-intro the SAME level number (so
  //                    difficulty doesn't change), via restartCaughtLevel.
  //   custom        — replay the same form values, no VN intro.
  //   stealth       — no fixed "same level" concept, just start a fresh
  //                    random stealth run.
  function retrySameRun(result) {
    if (result.mode === 'custom') { beginCustomLevel(); return; }
    if (result.mode === 'stealth') { beginGeneratedLevel(randInt(1, 30), 'stealth'); return; }
    restartCaughtLevel(result);
  }

  // "Change Character" from the caught screen — back to character select
  // for the same mode (re-uses the same selection flow as mode select).
  function goToCharacterSelect() {
    UI.populateCharacterSelect((characterId) => {
      selectedCharacter = CHARACTERS[characterId];
      ASSETS.preloadCharacter(selectedCharacter).then(() => {
        afterCharacterChosen();
      });
    });
  }

  // Rebuilds the SAME level number (so difficulty doesn't change) and
  // shows a fresh VN intro before re-starting it. ui.js's showLevelIntro
  // already includes a DIALOGUE.level_failed_suspicion-style framing via
  // its own intro lines; the level number/character stay identical so it
  // reads as "the same situation, here's what happened, try again."
  function restartCaughtLevel(result) {
    const levelNumber = result.levelNumber || storyLevelNumber;
    beginGeneratedLevel(levelNumber, result.mode, true);
  }

  function handleCompleteNext(result) {
    if (result.mode === 'custom') {
      // Custom win: go back to setup so player can create a new level
      UI.populateCustomSetup((values) => {
        customOptions = values;
        beginCustomLevel();
      });
      return;
    }

    const nextLevelNumber = result.levelNumber + 1;
    storyLevelNumber = nextLevelNumber;
    beginGeneratedLevel(nextLevelNumber, result.mode);
  }

  // Expose internals for CUSTOM_PANEL mid-game editing
  function _getCustomOptions() { return customOptions; }
  function _setCustomOptions(v) { customOptions = v; }
  function _getSelectedCharacter() { return selectedCharacter; }
  function _setSelectedCharacter(ch) { selectedCharacter = ch; }

  return { init, goBack, _getCustomOptions, _setCustomOptions, _getSelectedCharacter, _setSelectedCharacter };
})();

/* ----------------------------------------------------------------------
   CUSTOM_PANEL — mid-game settings panel for Custom Mode.
   Allows changing character, stats, and level settings while paused.
   The ⚙️ button in HUD triggers CUSTOM_PANEL.open().
------------------------------------------------------------------------- */
const CUSTOM_PANEL = (() => {
  let panelValues = {};
  let isOpen = false;

  function open() {
    if (!APP._getCustomOptions || !APP._getSelectedCharacter) return;
    const opts = APP._getCustomOptions() || {};
    const panel = document.getElementById('custom-ingame-panel');
    const form = document.getElementById('custom-ingame-form');
    if (!panel || !form) return;

    // Pause the game
    GAME.setPausedPublic(true);

    panelValues = { ...opts };
    form.innerHTML = '';

    // Character select dropdown
    const charWrap = document.createElement('div');
    charWrap.className = 'custom-field';
    charWrap.style.gridColumn = '1 / -1';
    const charLabel = document.createElement('div');
    charLabel.className = 'custom-field-label';
    charLabel.innerHTML = '<span>🧍 Character</span>';
    const charSelect = document.createElement('select');
    charSelect.className = 'custom-select';
    Object.values(CHARACTERS).forEach(ch => {
      const o = document.createElement('option');
      o.value = ch.id;
      o.textContent = ch.name;
      if (panelValues.characterId === ch.id) o.selected = true;
      charSelect.appendChild(o);
    });
    charSelect.onchange = () => { panelValues.characterId = charSelect.value; };
    // Set initial value to current character
    const curChar = APP._getSelectedCharacter();
    if (curChar) charSelect.value = curChar.id;
    panelValues.characterId = charSelect.value;
    charWrap.append(charLabel, charSelect);
    form.appendChild(charWrap);

    // Level sliders
    const fields = [
      { key: 'npcDensity', label: 'NPC Density', min: 0.1, max: 1, step: 0.05 },
      { key: 'environmentNoise', label: 'Env Noise', min: 0.02, max: 1, step: 0.05 },
      { key: 'gasPressureLevel', label: 'Gas Pressure', min: 0.1, max: 1, step: 0.05 },
      { key: 'smellLevel', label: 'Smell Level', min: 0.1, max: 1, step: 0.05 },
      { key: 'loudLevel', label: 'Loudness', min: 0.1, max: 1, step: 0.05 },
      { key: 'targetGas', label: 'Gas Target', min: 30, max: 300, step: 10 },
    ];
    fields.forEach(f => {
      const defaultVal = opts[f.key] != null ? opts[f.key] : ((f.min + f.max) / 2);
      panelValues[f.key] = defaultVal;
      const wrap = document.createElement('div');
      wrap.className = 'custom-field';
      const labelRow = document.createElement('div');
      labelRow.className = 'custom-field-label';
      const valId = 'cip-val-' + f.key;
      labelRow.innerHTML = `<span>${f.label}</span><span class="value" id="${valId}">${defaultVal}</span>`;
      const input = document.createElement('input');
      input.type = 'range'; input.className = 'custom-range';
      input.min = f.min; input.max = f.max; input.step = f.step; input.value = defaultVal;
      input.oninput = () => {
        panelValues[f.key] = parseFloat(input.value);
        const el = document.getElementById(valId);
        if (el) el.textContent = input.value;
      };
      wrap.append(labelRow, input);
      form.appendChild(wrap);
    });

    // Stat override sliders
    const statHeader = document.createElement('div');
    statHeader.className = 'custom-section-header';
    statHeader.textContent = '— Character Stat Overrides —';
    form.appendChild(statHeader);
    const statFields = [
      { key: 'stat_smell', label: '💨 Smell', tip: '1–5' },
      { key: 'stat_linger', label: '⏱ Linger', tip: '1–5' },
      { key: 'stat_accident', label: '💥 Accident', tip: '1–5' },
      { key: 'stat_frequency', label: '⚡ Frequency', tip: '1–5' },
      { key: 'stat_volume', label: '🔊 Volume', tip: '1–5' },
    ];
    statFields.forEach(f => {
      const defaultVal = opts[f.key] != null ? opts[f.key] : 3;
      panelValues[f.key] = defaultVal;
      const wrap = document.createElement('div');
      wrap.className = 'custom-field';
      const valId = 'cip-val-' + f.key;
      const labelRow = document.createElement('div');
      labelRow.className = 'custom-field-label';
      labelRow.innerHTML = `<span>${f.label}</span><span class="value" id="${valId}">${defaultVal}</span>`;
      const input = document.createElement('input');
      input.type = 'range'; input.className = 'custom-range';
      input.min = 1; input.max = 5; input.step = 1; input.value = defaultVal;
      input.oninput = () => {
        panelValues[f.key] = parseFloat(input.value);
        const el = document.getElementById(valId);
        if (el) el.textContent = input.value;
      };
      wrap.append(labelRow, input);
      form.appendChild(wrap);
    });

    panel.style.display = 'flex';
    isOpen = true;
  }

  function close() {
    const panel = document.getElementById('custom-ingame-panel');
    if (panel) panel.style.display = 'none';
    isOpen = false;
    GAME.setPausedPublic(false);
  }

  function apply() {
    // Update the active custom options in APP
    if (APP._setCustomOptions) APP._setCustomOptions(panelValues);

    // Switch character if changed
    const newCharId = panelValues.characterId;
    const selectedChar = APP._getSelectedCharacter();
    if (newCharId && newCharId !== (selectedChar && selectedChar.id)) {
      const newChar = CHARACTERS[newCharId];
      if (newChar) {
        APP._setSelectedCharacter(newChar);
        PLAYER.setCharacter(newChar);
        if (typeof CHAR_STATS !== 'undefined') {
          const overrides = {
            smell: panelValues.stat_smell,
            linger: panelValues.stat_linger,
            accident: panelValues.stat_accident,
            frequency: panelValues.stat_frequency,
            volume: panelValues.stat_volume,
          };
          CHAR_STATS.applyToPlayer(newChar.id, overrides);
        }
      }
    } else {
      // Apply stat overrides to current character
      if (typeof CHAR_STATS !== 'undefined') {
        const overrides = {
          smell: panelValues.stat_smell,
          linger: panelValues.stat_linger,
          accident: panelValues.stat_accident,
          frequency: panelValues.stat_frequency,
          volume: panelValues.stat_volume,
        };
        CHAR_STATS.applyToPlayer(selectedChar ? selectedChar.id : null, overrides);
      }
    }

    close();
  }

  return { open, close, apply };
})();

document.addEventListener('DOMContentLoaded', () => {
  APP.init();
});

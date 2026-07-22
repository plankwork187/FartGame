/* ============================================================================
   UI.JS — SCREEN MANAGEMENT
   ============================================================================
   Handles every non-gameplay screen: title, mode select, character select,
   custom mode setup form, story progress map, level intro (visual novel),
   and level complete. Gameplay itself (the #screen-game contents) is
   driven by game.js, not this file — ui.js just shows/hides that screen
   and wires up the buttons that lead into and out of it.

   All screen DOM is already in index.html; this file only toggles
   visibility and fills in dynamic content (text, images, generated
   lists) using the data from data.js / generator.js.
   ========================================================================= */

const UI = (() => {
  const screens = {};
  let onModeChosen = null;       // callback(modeId) set by main.js
  let onCharacterChosen = null;  // callback(characterId) set by main.js
  let onCustomStart = null;      // callback(customOptions) set by main.js
  let onLevelIntroDone = null;   // callback() set by game.js via main.js
  let onStoryContinue = null;
  let progress = null;           // reference to PROGRESS (set in init)

  function init(progressRef) {
    progress = progressRef;
    document.querySelectorAll('.screen').forEach(s => screens[s.id] = s);
    wireStaticButtons();
  }

  function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.remove('screen-active'));
    screens[id].classList.add('screen-active');
    window.scrollTo(0, 0);
  }

  // ── Static navigation wiring (buttons that always do the same thing) ──
  function wireStaticButtons() {
    byId('btn-go-mode-select').onclick = () => showScreen('screen-mode-select');
    byId('btn-go-howto').onclick = () => showScreen('screen-howto');

    document.querySelectorAll('.mode-card').forEach(card => {
      card.onclick = () => {
        if (card.classList.contains('mode-card-locked')) return;
        const modeId = card.dataset.mode;
        if (onModeChosen) onModeChosen(modeId);
      };
    });
  }

  function byId(id) { return document.getElementById(id); }

  // ── Unlocks: mode select reflects PROGRESS state ───────────────────────
  // Custom mode is always unlocked. Endless unlocks at Story Level 30.
  function refreshModeSelect() {
    const endlessUnlocked = progress.get().highestLevelCleared >= 30;
    const customCard = byId('mode-card-custom');
    const endlessCard = byId('mode-card-endless');
    if (customCard) customCard.classList.remove('mode-card-locked');
    if (endlessCard) endlessCard.classList.toggle('mode-card-locked', !endlessUnlocked);
  }

  // ── Character select ────────────────────────────────────────────────

  // Unique flavor text shown in each character's dropdown panel
  const CHAR_FLAVOR = {
    sabrina:   "She'll have the whole place guessing — and giggling. Nobody suspects the girl who looks this put-together. High gas frequency means she's always loaded and ready to fire, and when she does, it's LOUD. Choose her if you like living dangerously.",
    olivia:    "Once she starts, she doesn't stop. Olivia's clouds linger like an unresolved argument — long after she's moved on, NPCs are still walking through her legacy. Low smell but maximum staying power. Perfect for the patient schemer.",
    ariana:    "Tiny but absolutely lethal. Ariana's top-tier smell will clear a room, and her near-perfect control means she releases only when SHE decides. The most feared silent assassin in the game.",
    'beyoncé': "Cool on the surface, absolute chaos underneath. Great smell and huge volume, but accident-prone — she might just go off at the worst moment. High risk, high reward. For players who like to live dangerously.",
    madelyn:   "A walking natural disaster who somehow owns it every time. Wild card accident rating keeps things interesting. Choose her for maximum unpredictability and big laugh moments.",
    bryce:     "Perfectly balanced across every stat, which means perfectly balanced chaos. The reliable all-rounder. Great for learning the game without extreme penalties.",
    char7:     "Quiet doesn't mean harmless. Barely registers on the smell scale, and clouds vanish fast — in and out before anyone pins it on her. High accident rate is the catch. Stealth mode, but chaotic.",
    char8:     "Maximum pungency, minimum noise. When char8 finally lets one rip (rare — slow build), the smell is absolutely nuclear. Quiet as a library. Deadly as a gas leak. The long game specialist.",
    char9:     "Always surrounded by people, always gassy. Steady gas build-up and lingering clouds make social situations extremely risky. Accident rate is average — which means it'll still happen at the worst possible time.",
  };

  // Descriptive rating labels per stat level
  const STAT_RATINGS = {
    smell:     ['Barely a whiff', 'Mild crop dust', 'Silent but present', 'Rancid SBD territory', '☠️ Biological hazard'],
    linger:    ['Gone in seconds', 'Brief awkwardness', 'Hangs around like a bad decision', "Won't leave the room — pure SBD", 'Eternal crop dust. No escape.'],
    accident:  ['Iron sphincter — zero accidents', 'Solid control, rare slip', 'Occasional involuntary BRAPs', 'Cut the cheese at will — chaos machine', 'Accidental SBDs constantly. You are NOT in charge.'],
    frequency: ['Slow build — rare gassiness', 'Steady crop-dusting pressure', '💨 Constant gassiness — no breaks', 'Relentless BRAPs incoming', 'Maximum gassiness. Release or bust.'],
    volume:    ['Silent but Deadly — whisper quiet', 'Audible SBD — neighbors notice', 'Loud BRAPs — hard to ignore', 'Very loud — wet and rancid', '🔊 Maximum volume — heard across the room'],
  };

  function closeAllDropdowns() {
    document.querySelectorAll('.char-dropdown-panel.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.char-card.selected').forEach(c => c.classList.remove('selected'));
  }

  // Builds the dropdown stats panel DOM for a character
  function buildCharDropdown(ch, dropId) {
    const drop = document.createElement('div');
    drop.className = 'char-dropdown-panel';
    drop.id = dropId;
    drop.addEventListener('click', e => e.stopPropagation());

    const stats = (typeof CHAR_STATS !== 'undefined') ? CHAR_STATS.getAllStats() : {};
    const charKey = ch.id || '';
    const s = stats[charKey] || stats[charKey.toLowerCase()] ||
              Object.entries(stats).find(([k]) => k.toLowerCase() === charKey.toLowerCase())?.[1] || null;

    // Header: name + select button
    const header = document.createElement('div');
    header.className = 'char-dropdown-header';
    const titleWrap = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.className = 'csp-title';
    titleEl.textContent = ch.name;
    const catEl = document.createElement('div');
    catEl.className = 'csp-category';
    catEl.textContent = s ? ('📐 ' + s.sizeCategory.charAt(0).toUpperCase() + s.sizeCategory.slice(1)) : '';
    titleWrap.append(titleEl, catEl);

    const selectBtn = document.createElement('button');
    selectBtn.className = 'char-dropdown-select-btn';
    selectBtn.textContent = '▶ Play as ' + ch.name.split(' ')[0];
    selectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllDropdowns();
      if (onCharacterChosen) onCharacterChosen(ch.id);
    });
    header.append(titleWrap, selectBtn);
    drop.appendChild(header);

    // Flavor text
    const flavorKey = charKey.toLowerCase();
    const flavorText = CHAR_FLAVOR[flavorKey] || CHAR_FLAVOR[ch.id] || ch.personality || ch.tagline || '';
    if (flavorText) {
      const flavor = document.createElement('div');
      flavor.className = 'char-dropdown-flavor';
      flavor.textContent = flavorText;
      drop.appendChild(flavor);
    }

    // Stats
    const stDefs = [
      { key: 'smell',     label: '💨 Smell',     tip: 'Cloud size & detection radius' },
      { key: 'linger',    label: '⏱ Linger',    tip: 'How long clouds hang around' },
      { key: 'accident',  label: '💥 Accident',  tip: 'Chance of involuntary releases' },
      { key: 'frequency', label: '⚡ Frequency', tip: 'How fast gas builds up' },
      { key: 'volume',    label: '🔊 Volume',    tip: 'Loudness & sound detection' },
    ];
    const stEl = document.createElement('div');
    stEl.className = 'csp-stats';
    stDefs.forEach(def => {
      const val = s ? (s[def.key] != null ? Math.round(s[def.key]) : 0) : 0;
      const row = document.createElement('div');
      row.className = 'csp-stat-row';
      const dots = Array.from({length:5}, (_,i) =>
        `<span class="csp-dot${i < val ? ' csp-dot-on' : ''}">${i < val ? '●' : '○'}</span>`).join('');
      const ratingText = val > 0 ? (STAT_RATINGS[def.key][val - 1] || '') : '—';
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="csp-stat-label">${def.label}</span>
          <span class="csp-stat-dots">${dots}</span>
        </div>
        <span class="csp-stat-rating">${ratingText}</span>
        <span class="csp-stat-tip">${def.tip}</span>`;
      stEl.appendChild(row);
    });
    drop.appendChild(stEl);
    return drop;
  }

  function populateCharacterSelect(onChosen) {
    onCharacterChosen = onChosen;
    const grid = byId('char-grid');
    grid.innerHTML = '';

    // Hide legacy panel if it still exists in the DOM
    const oldPanel = byId('char-stats-panel');
    if (oldPanel) oldPanel.style.display = 'none';

    Object.values(CHARACTERS).forEach(ch => {
      const card = document.createElement('div');
      card.className = 'char-card';
      card.tabIndex = 0;
      card.dataset.charId = ch.id;

      const img = document.createElement('img');
      ASSETS.applyTo(img, ch.profile);
      img.alt = ch.name;

      const name = document.createElement('div');
      name.className = 'char-card-name';
      name.textContent = ch.name;

      const tagline = document.createElement('div');
      tagline.className = 'char-card-tagline';
      tagline.textContent = ch.tagline;

      card.append(img, name, tagline);

      // Click toggles the inline dropdown below this card
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropId = 'char-drop-' + ch.id;
        const existingDrop = byId(dropId);

        if (existingDrop && existingDrop.classList.contains('open')) {
          // Same card tapped again — close
          existingDrop.classList.remove('open');
          card.classList.remove('selected');
        } else {
          // Close any currently open dropdown
          closeAllDropdowns();
          if (existingDrop) {
            existingDrop.classList.add('open');
          } else {
            const drop = buildCharDropdown(ch, dropId);
            card.after(drop);
            drop.offsetHeight; // force reflow for CSS animation
            drop.classList.add('open');
          }
          card.classList.add('selected');
        }
      });

      grid.appendChild(card);
    });

    // Tap outside to close all dropdowns
    document.addEventListener('click', closeAllDropdowns);

    showScreen('screen-char-select');
  }

  // Legacy stub — kept so nothing external breaks if called
  function showCharStatPanel(ch) {}

  // ── Custom Mode setup form ──────────────────────────────────────────
  function populateCustomSetup(onStart) {
    onCustomStart = onStart;
    const form = byId('custom-form');
    form.innerHTML = '';

    const fields = [
      { key: 'npcDensity', label: 'NPC Density', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.5 },
      { key: 'environmentNoise', label: 'Environment Noise', type: 'range', min: 0.02, max: 1, step: 0.05, default: 0.4 },
      { key: 'gasPressureLevel', label: 'Gas Pressure Level', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.5 },
      { key: 'smellLevel', label: 'Smell Level', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.5 },
      { key: 'loudLevel', label: 'Loudness Level', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.5 },
      { key: 'targetGas', label: 'Target: 100s of mL of Gas Released', type: 'range', min: 30, max: 300, step: 10, default: 100 },
    ];

    const values = {};
    fields.forEach(f => {
      values[f.key] = f.default;
      const wrap = document.createElement('div');
      wrap.className = 'custom-field';
      const labelRow = document.createElement('div');
      labelRow.className = 'custom-field-label';
      labelRow.innerHTML = `<span>${f.label}</span><span class="value" id="custom-val-${f.key}">${f.default}</span>`;
      const input = document.createElement('input');
      input.type = 'range'; input.className = 'custom-range';
      input.min = f.min; input.max = f.max; input.step = f.step; input.value = f.default;
      input.oninput = () => {
        values[f.key] = parseFloat(input.value);
        byId(`custom-val-${f.key}`).textContent = input.value;
      };
      wrap.append(labelRow, input);
      form.appendChild(wrap);
    });

    // Dropdowns for categorical choices
    const selectDefs = [
      { key: 'locationId', label: 'Location', options: LOCATIONS.map(l => ({ id: l.id, name: l.name })) },
      { key: 'timeId', label: 'Time of Day', options: TIMES_OF_DAY.map(t => ({ id: t.id, name: t.name })) },
      { key: 'companionId', label: 'Companion', options: COMPANIONS.map(c => ({ id: c.id, name: c.name })) },
      { key: 'modifierId', label: 'Special Modifier', options: MODIFIERS.map(m => ({ id: m.id, name: m.name })) },
    ];
    selectDefs.forEach(def => {
      values[def.key] = def.options[0].id;
      const wrap = document.createElement('div');
      wrap.className = 'custom-field';
      const labelRow = document.createElement('div');
      labelRow.className = 'custom-field-label';
      labelRow.innerHTML = `<span>${def.label}</span>`;
      const select = document.createElement('select');
      select.className = 'custom-select';
      def.options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.id; o.textContent = opt.name;
        select.appendChild(o);
      });
      select.onchange = () => { values[def.key] = select.value; };
      wrap.append(labelRow, select);
      form.appendChild(wrap);
    });

    // ── Character stat overrides (Custom Mode) ─────────────────────────
    // These five sliders let you override the active character's stats
    // for this one run. Defaults pull from CHAR_STATS if available,
    // otherwise fall back to 3 (neutral).
    const statFields = [
      { key: 'stat_smell',     label: '💨 Smell Override',     tip: '(1=faint, 5=pungent)'   },
      { key: 'stat_linger',    label: '⏱ Linger Override',    tip: '(1=quick, 5=long-lasting)' },
      { key: 'stat_accident',  label: '💥 Accident Override',  tip: '(1=iron control, 5=accident-prone)' },
      { key: 'stat_frequency', label: '⚡ Frequency Override', tip: '(1=slow build, 5=fast build)' },
      { key: 'stat_volume',    label: '🔊 Volume Override',    tip: '(1=silent/dry, 5=loud/wet)' },
    ];

    const statHeader = document.createElement('div');
    statHeader.className = 'custom-section-header';
    statHeader.textContent = '— Character Stat Overrides —';
    form.appendChild(statHeader);

    statFields.forEach(f => {
      const defaultVal = 3;
      values[f.key] = defaultVal;
      const wrap = document.createElement('div');
      wrap.className = 'custom-field';
      const labelRow = document.createElement('div');
      labelRow.className = 'custom-field-label';
      labelRow.innerHTML = `<span>${f.label} <small style="color:var(--ink-soft,#888)">${f.tip}</small></span><span class="value" id="custom-val-${f.key}">${defaultVal}</span>`;
      const input = document.createElement('input');
      input.type = 'range'; input.className = 'custom-range';
      input.min = 1; input.max = 5; input.step = 1; input.value = defaultVal;
      input.oninput = () => {
        values[f.key] = parseFloat(input.value);
        byId(`custom-val-${f.key}`).textContent = input.value;
      };
      wrap.append(labelRow, input);
      form.appendChild(wrap);
    });

    byId('btn-custom-start').onclick = () => {
      // Bundle stat overrides into a sub-object the game picks up as level.customStatOverrides
      values.customStatOverrides = {
        smell:     values.stat_smell,
        linger:    values.stat_linger,
        accident:  values.stat_accident,
        frequency: values.stat_frequency,
        volume:    values.stat_volume,
      };
      if (onCustomStart) onCustomStart(values);
    };
    showScreen('screen-custom-setup');
  }

  // ── Story progress map ──────────────────────────────────────────────
  function showStoryMap(onContinue) {
    onStoryContinue = onContinue;
    const p = progress.get();
    const nextLevel = Math.min(31, p.highestLevelCleared + 1);
    const pct = clamp((p.highestLevelCleared / 30) * 100, 0, 100);
    byId('story-progress-fill').style.width = pct + '%';
    byId('story-progress-label').textContent = p.highestLevelCleared >= 30
      ? 'Campaign Complete — Endless Unlocked!'
      : `Level ${nextLevel} of 30`;

    const stats = byId('story-stats');
    stats.innerHTML = '';
    const statDefs = [
      { value: p.highestLevelCleared, label: 'Levels Cleared' },
      { value: p.bestScore, label: 'Best Score' },
      { value: p.totalGasReleased, label: 'Total 100s of mL of Gas Released' },
      { value: p.timesCaught, label: 'Times Caught' },
    ];
    statDefs.forEach(s => {
      const card = document.createElement('div');
      card.className = 'story-stat-card';
      card.innerHTML = `<div class="story-stat-value">${s.value}</div><div class="story-stat-label">${s.label}</div>`;
      stats.appendChild(card);
    });

    byId('btn-story-continue').onclick = () => { if (onStoryContinue) onStoryContinue(); };
    showScreen('screen-story-map');
  }

  // ── Level intro (visual novel) ──────────────────────────────────────
  // `level` is a generated level object from generator.js.
  // `character` is the chosen CHARACTERS entry.
  // `onDone` is called once the player taps through all lines.
  function showLevelIntro(level, character, onDone, isRetry = false) {
    onLevelIntroDone = onDone;

    // Backdrop
    const backdrop = byId('vn-backdrop');
    ASSETS.applyBackground(backdrop, level.location.bg);
    byId('vn-tint').style.background = level.time.tint;

    // Info chips summarizing the level's variables
    const chips = byId('vn-info-chips');
    chips.innerHTML = '';
    const chipDefs = [
      { text: level.location.name },
      { text: level.time.name },
      { text: `NPC Density: ${Math.round(level.npcDensity * 100)}%` },
      { text: `Noise: ${Math.round(level.environmentNoise * 100)}%` },
      { text: `Smell: ${Math.round(level.smellLevel * 100)}%`, cls: level.smellLevel > 0.65 ? 'chip-danger' : level.smellLevel > 0.4 ? 'chip-caution' : 'chip-green' },
      { text: `Loud: ${Math.round(level.loudLevel * 100)}%`, cls: level.loudLevel > 0.65 ? 'chip-danger' : level.loudLevel > 0.4 ? 'chip-caution' : 'chip-green' },
    ];
    if (level.companion.id !== 'none') chipDefs.push({ text: `With: ${level.companion.name}` });
    level.modifiers.filter(m => m.id !== 'none').forEach(m => chipDefs.push({ text: m.name, cls: 'chip-caution' }));
    chipDefs.forEach(c => {
      const chip = document.createElement('div');
      chip.className = 'vn-chip' + (c.cls ? ' ' + c.cls : '');
      chip.textContent = c.text;
      chips.appendChild(chip);
    });

    // Portraits
    const playerPortrait = byId('vn-portrait-player');
    ASSETS.applyTo(playerPortrait, character.vn || character.profile);
    const companionPortrait = byId('vn-portrait-companion');
    if (level.companion.portrait) {
      companionPortrait.hidden = false;
      ASSETS.applyTo(companionPortrait, level.companion.portrait);
    } else {
      companionPortrait.hidden = true;
    }

    // Build the dialogue line sequence from DIALOGUE templates
    const templateData = {
      character: character.name,
      location: level.location.name,
      reason: level.reason,
      time: level.time.name.toLowerCase(),
      companionName: level.companion.name,
      targetGas: level.targetGas,
      modifierName: level.modifiers[0] ? level.modifiers[0].name : '',
      modifierDescription: level.modifiers[0] ? level.modifiers[0].description : '',
    };

    const lines = [];
    lines.push({ speaker: character.name, text: randLine(isRetry ? DIALOGUE.vn_intro_opening_retry : DIALOGUE.vn_intro_opening, templateData) });
    if (level.companion.id === 'none') {
      lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_companion_none, templateData) });
    } else {
      lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_companion_present, templateData) });
      const companionLines = DIALOGUE.companions[level.companion.rule];
      if (companionLines) lines.push({ speaker: level.companion.name, text: randLine(companionLines, templateData) });
    }
    if (level.gasPressureLevel > 0.7) lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_pressure_high, templateData) });
    else if (level.gasPressureLevel > 0.4) lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_pressure_mid, templateData) });
    else lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_pressure_low, templateData) });
    if (level.smellLevel > 0.6) lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_smell_warning, templateData) });
    if (level.loudLevel > 0.6) lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_loud_warning, templateData) });
    level.modifiers.filter(m => m.id !== 'none').forEach(m => {
      lines.push({ speaker: character.name, text: fillTemplate(randFrom(DIALOGUE.vn_intro_modifier), { modifierName: m.name, modifierDescription: m.description }) });
    });
    lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_closing, templateData) });

    let idx = 0;
    function renderLine() {
      const l = lines[idx];
      byId('vn-speaker').textContent = l.speaker;
      byId('vn-line').textContent = l.text;
      byId('vn-next-btn').textContent = (idx === lines.length - 1) ? 'Start ▶' : 'Next ▶';
    }
    renderLine();
    byId('vn-next-btn').onclick = () => {
      idx++;
      if (idx >= lines.length) {
        if (onLevelIntroDone) onLevelIntroDone();
      } else {
        renderLine();
      }
    };

    showScreen('screen-level-intro');
  }

  // ── Level complete screen ───────────────────────────────────────────
  function showLevelComplete(result, character, onNext, onMenu) {
    byId('complete-title').textContent = result.success ? 'Level Complete!' : 'Busted!';
    byId('complete-sub').textContent = result.success
      ? randLine(DIALOGUE.level_complete, { character: result.characterName })
      : randLine(DIALOGUE.level_failed_suspicion, { character: result.characterName });

    // Fix 4: show a success facecam (success1 or success2) on level complete.
    const facecamWrap = byId('complete-facecam-wrap');
    const facecamImg = byId('complete-facecam');
    if (result.success && character && character.faces) {
      const successKey = Math.random() < 0.5 ? 'success1' : 'success2';
      const successSrc = character.faces[successKey];
      if (successSrc) {
        ASSETS.applyTo(facecamImg, successSrc);
        if (facecamWrap) facecamWrap.style.display = '';
      } else {
        if (facecamWrap) facecamWrap.style.display = 'none';
      }
    } else {
      if (facecamWrap) facecamWrap.style.display = 'none';
    }

    const stats = byId('complete-stats');
    stats.innerHTML = '';
    const statDefs = [
      { value: result.score, label: 'Score' },
      { value: Math.round(result.gasReleased), label: '100s of mL of Gas Released' },
      { value: result.difficultyScore + '/10', label: 'Difficulty' },
    ];
    statDefs.forEach(s => {
      const card = document.createElement('div');
      card.className = 'complete-stat';
      card.innerHTML = `<div class="complete-stat-value">${s.value}</div><div class="complete-stat-label">${s.label}</div>`;
      stats.appendChild(card);
    });

    // Custom mode gets its own action buttons (make new level / menu)
    const customActions = byId('complete-custom-actions');
    const normalActions = byId('complete-normal-actions');
    if (result.mode === 'custom') {
      if (customActions) customActions.style.display = 'flex';
      if (normalActions) normalActions.style.display = 'none';
      const newLevelBtn = byId('btn-complete-custom-newlevel');
      const menuBtn = byId('btn-complete-custom-menu');
      if (newLevelBtn) newLevelBtn.onclick = onNext; // onNext for custom = go back to setup
      if (menuBtn) menuBtn.onclick = onMenu;
    } else {
      if (customActions) customActions.style.display = 'none';
      if (normalActions) normalActions.style.display = 'flex';
      byId('btn-complete-next').textContent = result.success ? 'Next Level' : 'Try Again';
      byId('btn-complete-next').onclick = onNext;
      byId('btn-complete-menu').onclick = onMenu;
    }

    // Inject fart log summary if available
    const fartLogWrap = byId('complete-fart-log');
    if (fartLogWrap && result.fartSummary) {
      fartLogWrap.innerHTML = RELEASE_TRACKER.buildSummaryHTML(result.fartSummary);
      fartLogWrap.style.display = '';
    } else if (fartLogWrap) {
      fartLogWrap.style.display = 'none';
    }

    showScreen('screen-level-complete');
  }

  // ── Caught / failure screen ─────────────────────────────────────────
  // Shown for ANY suspicion-meter mode (story, stealth, custom, endless)
  // the instant suspicion hits 100 and the player is caught. Distinct
  // from showLevelComplete: this is specifically the "you got caught"
  // failure state, with the character's caught facecam and three
  // separate exits (Retry same level/run, Character Select, Main Menu)
  // rather than auto-restarting anything.
  // `character` is the active CHARACTERS entry (for its caught facecam
  // assets — character.faces.caught1/caught2, same images PLAYER.setFace
  // already uses in-scene). `onRetry`/`onCharacterSelect`/`onMainMenu`
  // are callbacks wired by main.js.
  function showCaughtScreen(result, character, onRetry, onCharacterSelect, onMainMenu, onChangeSettings) {
    byId('caught-title').textContent = 'Failed! Try Again';
    byId('caught-sub').textContent = randLine(DIALOGUE.level_failed_suspicion, { character: result.characterName });

    // Use the same caught facecam pool the in-scene face already uses
    // (character.faces.caught1 / caught2) — pick one at random so a
    // retry can show either expression.
    const facecamImg = byId('caught-facecam');
    const caughtKey = Math.random() < 0.5 ? 'caught1' : 'caught2';
    ASSETS.applyTo(facecamImg, character.faces[caughtKey]);

    const stats = byId('caught-stats');
    stats.innerHTML = '';
    const statDefs = [
      { value: result.score, label: 'Score' },
      { value: Math.round(result.gasReleased), label: '100s of mL of Gas Released' },
    ];
    statDefs.forEach(s => {
      const card = document.createElement('div');
      card.className = 'complete-stat';
      card.innerHTML = `<div class="complete-stat-value">${s.value}</div><div class="complete-stat-label">${s.label}</div>`;
      stats.appendChild(card);
    });

    byId('btn-caught-retry').onclick = onRetry;
    byId('btn-caught-charselect').onclick = onCharacterSelect;
    byId('btn-caught-mainmenu').onclick = onMainMenu;

    // Custom mode: show Change Settings button
    const changeSettingsBtn = byId('btn-caught-changesettings');
    if (changeSettingsBtn) {
      if (result.mode === 'custom' && onChangeSettings) {
        changeSettingsBtn.style.display = '';
        changeSettingsBtn.onclick = onChangeSettings;
      } else {
        changeSettingsBtn.style.display = 'none';
      }
    }

    // Inject fart log summary if available
    const caughtFartLogWrap = byId('caught-fart-log');
    if (caughtFartLogWrap && result.fartSummary) {
      caughtFartLogWrap.innerHTML = RELEASE_TRACKER.buildSummaryHTML(result.fartSummary);
      caughtFartLogWrap.style.display = '';
    } else if (caughtFartLogWrap) {
      caughtFartLogWrap.style.display = 'none';
    }

    showScreen('screen-caught');
  }

  return {
    init, showScreen, refreshModeSelect, populateCharacterSelect,
    populateCustomSetup, showStoryMap, showLevelIntro, showLevelComplete,
    showCaughtScreen,
    setOnModeChosen(fn) { onModeChosen = fn; },
  };
})();

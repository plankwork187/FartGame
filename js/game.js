/* ============================================================================
   GAME.JS — CORE GAMEPLAY LOOP
   ============================================================================
   Owns everything inside #screen-game: wiring up DOM refs once, starting a
   level (given a level definition from generator.js + a chosen character +
   a game mode), running the per-frame loop (NPC spawning/movement, cloud
   updates, player updates, suspicion/score bookkeeping, companion hooks),
   and handling win/lose/pause.

   game.js does NOT know about the title screen, mode select, story map,
   or level-complete screen — it only knows how to run ONE level and report
   back what happened via the `onLevelEnd` callback (set via setCallbacks).
   main.js is responsible for stringing levels together, persistence, and
   screen flow.

   GAME MODES this file understands (level.mode):
     'story'   — suspicion + target gas, generated level, ends on target hit
                 or suspicion maxed; level intro/complete screens used by
                 main.js around this.
     'stealth' — classic free-play: suspicion + gas, no target, survive as
                 long as possible (ends only on getting caught).
     'chaos'   — infinite gas, no suspicion meter at all, just go wild.
     'custom'  — same numeric shape as story (suspicion + target), but the
                 level object comes from the custom setup form instead of
                 the procedural generator.
     'endless' — same as story but levelNumber keeps climbing past 30 and
                 difficultyScore is used for a running high-score feel.
   ========================================================================= */

const GAME = (() => {
  let els = {};
  let level = null;
  let mode = 'stealth';
  let character = null;

  let suspicion = 0;
  let score = 0;
  let gasReleased = 0;
  let running = false;
  let paused = false;
  let rafId = null;
  let lastT = 0;
  let spawnTimer = 0;
  let statusTimer = 0;
  let statusCooldown = 0; // minimum time before status can change again

  let onLevelEnd = null; // callback(result) — set by main.js

  // Context object shared with companion.js rule handlers.
  const ctx = {
    state: {},
    companionName: '',
    setStatus,
  };

  // ── DOM wiring (called once on boot) ──────────────────────────────────
  function init() {
    els = {
      scene: byId('scene'),
      sceneBg: byId('scene-bg'),
      sceneSeat: byId('scene-seat'),
      sceneTint: byId('scene-tint'),
      sky: byId('sky'), ground: byId('ground'), path: byId('path'),
      hudLevelTag: byId('hud-level-tag'),
      companionWrap: byId('companion-wrap'),
      companionImg: byId('companion-img'),
      companionName: byId('companion-name'),
      playerWrap: byId('player-wrap'),
      playerImg: byId('player-img'),
      powerRing: byId('power-ring'),
      powerArc: byId('power-arc'),
      powerLabel: byId('power-label'),
      faceImg: byId('face-img'),
      faceLabel: byId('face-label'),
      overlay: byId('overlay'),
      overlayTitle: byId('overlay-title'),
      overlaySub: byId('overlay-sub'),
      overlayScore: byId('overlay-score'),
      overlayBtn: byId('overlay-btn'),
      overlayBtnMenu: byId('overlay-btn-menu'),
      suspBar: byId('susp-bar'),
      gasCard: byId('gas-card'),
      gasBar: byId('gas-bar'),
      scoreVal: byId('score-val'),
      targetCard: byId('target-card'),
      targetBar: byId('target-bar'),
      targetText: byId('target-text'),
      extraHudCard: byId('extra-hud-card'),
      extraHudLabel: byId('extra-hud-label'),
      extraHudBar: byId('extra-hud-bar'),
      btnLeft: byId('btn-left'),
      btnRight: byId('btn-right'),
      btnSpecial: byId('btn-special'),
      btnPause: byId('btn-pause'),
      statusMsg: byId('status-msg'),
    };

    NPC_SYSTEM.init(els.scene);
    CLOUD_SYSTEM.init(els.scene, els.playerWrap);
    CLOUD_SYSTEM.setDetectionCallback(handleNpcDetected);

    relocatePowerMeterToHud();

    PLAYER.init({
      playerWrap: els.playerWrap, playerImg: els.playerImg,
      powerRing: els.powerRing, powerArc: els.powerArc, powerLabel: els.powerLabel,
      faceImg: els.faceImg, faceLabel: els.faceLabel,
    });
    PLAYER.setCallbacks({ onRelease: handlePlayerRelease, onInvoluntary: handleInvoluntary });

    wireControls();
    wireSpecialButton();

    els.btnPause.onclick = () => { if (running) setPaused(!paused); };
    els.overlayBtnMenu.onclick = () => { if (onLevelEnd) finish(lastResultForMenu()); };
  }

  // ── Move the circular charge/power meter off the character and into a
  // fixed HUD corner ──────────────────────────────────────────────────
  // Previously #power-ring was positioned by CSS relative to the player
  // sprite (it visually surrounded the character while leaning). Since
  // there's no separate stylesheet change being made here, this re-homes
  // the element directly: re-parents it into the scene root and applies
  // explicit corner-anchored inline positioning so it always renders as
  // a standalone HUD element in the bottom-right of the game screen,
  // independent of wherever the player sprite is or moves to. All of
  // player.js's existing opacity/stroke/text updates to this element
  // keep working unchanged — only its position in the DOM/layout moves.
  // NOTE: ids/classes are unchanged, so if a real stylesheet rule for
  // #power-ring already exists in index.html's CSS, these inline styles
  // intentionally override it (inline style has higher specificity) —
  // the corner position below is authoritative.
  function relocatePowerMeterToHud() {
    if (!els.powerRing || !els.scene) return;
    // Defensive: absolute-positioned children anchor to the nearest
    // positioned ancestor. If #scene's stylesheet doesn't already set
    // position:relative/absolute/fixed, force it here so the corner
    // anchoring below is reliable regardless of the existing CSS.
    const sceneComputedPosition = window.getComputedStyle(els.scene).position;
    if (sceneComputedPosition === 'static') {
      els.scene.style.position = 'relative';
    }
    els.scene.appendChild(els.powerRing); // re-parent: no longer nested under player-wrap
    Object.assign(els.powerRing.style, {
      position: 'absolute',
      right: '14px',
      bottom: '14px',
      left: 'auto',
      top: 'auto',
      transform: 'none',
      zIndex: '40', // above scene art/NPCs, alongside other HUD chrome
      pointerEvents: 'none',
    });
  }

  function byId(id) { return document.getElementById(id); }

  function setCallbacks(cbs) {
    onLevelEnd = cbs.onLevelEnd || null;
  }

  // ── Input wiring: mouse + touch + keyboard, both directions ───────────
  function wireControls() {
    bindHoldButton(els.btnLeft, -1);
    bindHoldButton(els.btnRight, 1);
    wireKeyboard();
  }

  function bindHoldButton(btn, dir) {
    const start = (e) => { e.preventDefault(); if (!running || paused) return; btn.classList.add('held'); PLAYER.startHold(dir); };
    const end = (e) => { if (e) e.preventDefault(); btn.classList.remove('held'); PLAYER.stopHold(); };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
    btn.addEventListener('touchend', end);
    btn.addEventListener('touchcancel', end);
    return { start, end };
  }

  // Keyboard: A / ArrowLeft = lean left, D / ArrowRight = lean right.
  // Mirrors on-screen button behavior exactly (same startHold/stopHold
  // calls, same 'held' visual state on the corresponding button) so
  // keyboard and touch/mouse controls are interchangeable. Guards against
  // the OS's key-repeat (holding a key fires repeated keydown events)
  // re-triggering startHold every repeat tick — only the first keydown
  // for a given direction starts the hold; it continues until keyup.
  function wireKeyboard() {
    const leftKeys = ['a', 'arrowleft'];
    const rightKeys = ['d', 'arrowright'];
    const keyHeld = { left: false, right: false };

    document.addEventListener('keydown', (e) => {
      if (!running || paused) return;
      const key = e.key.toLowerCase();
      if (leftKeys.includes(key)) {
        if (keyHeld.left) return; // ignore key-repeat
        keyHeld.left = true;
        els.btnLeft.classList.add('held');
        PLAYER.startHold(-1);
      } else if (rightKeys.includes(key)) {
        if (keyHeld.right) return; // ignore key-repeat
        keyHeld.right = true;
        els.btnRight.classList.add('held');
        PLAYER.startHold(1);
      }
    });

    document.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (leftKeys.includes(key)) {
        keyHeld.left = false;
        els.btnLeft.classList.remove('held');
        PLAYER.stopHold();
      } else if (rightKeys.includes(key)) {
        keyHeld.right = false;
        els.btnRight.classList.remove('held');
        PLAYER.stopHold();
      }
    });

    // Safety net: if the window/tab loses focus while a key is held down,
    // no keyup event will ever fire (same risk mouseleave guards against
    // for the on-screen buttons). Release any active keyboard hold so it
    // can't get stuck on indefinitely.
    window.addEventListener('blur', () => {
      if (keyHeld.left) { keyHeld.left = false; els.btnLeft.classList.remove('held'); PLAYER.stopHold(); }
      if (keyHeld.right) { keyHeld.right = false; els.btnRight.classList.remove('held'); PLAYER.stopHold(); }
    });
  }

  // ── Starting a level ───────────────────────────────────────────────────
  // `levelDef` is a generator.js level object (or an equivalent shape built
  // by main.js for custom mode). `gameMode` picks which ruleset above
  // applies. `charDef` is a CHARACTERS entry.
  function start(levelDef, gameMode, charDef) {
    level = levelDef;
    mode = gameMode;
    character = charDef;

    suspicion = 0;
    score = 0;
    gasReleased = 0;
    paused = false;
    spawnTimer = 0;
    statusTimer = 0;
    statusCooldown = 0;
    ctx.state = {};

    NPC_SYSTEM.clear();
    CLOUD_SYSTEM.clear();
    CLOUD_SYSTEM.setModifiers(level.modifiers || []);

    PLAYER.setCharacter(character);
    PLAYER.setChaosMode(mode === 'chaos');
    PLAYER.setGasPressureLevel(mode === 'chaos' ? 1 : level.gasPressureLevel);
    // Apply character stats (frequency + control) to the player module.
    // customStatOverrides is set by custom mode (see main.js/ui.js).
    if (typeof CHAR_STATS !== 'undefined') {
      CHAR_STATS.applyToPlayer(character ? character.id : null, level.customStatOverrides || null);
    }
    PLAYER.reset(mode === 'chaos' ? 100 : 40);

    setLocationBackground(level.location);
    els.sceneTint.style.background = level.time ? level.time.tint : 'rgba(0,0,0,0)';
    els.hudLevelTag.textContent = levelTagText();

    setupCompanion();
    setupSpecialButton();
    setupHudVisibility();
    // Show custom settings ⚙️ button only in custom mode
    const customIngameBtn = document.getElementById('btn-custom-ingame');
    if (customIngameBtn) customIngameBtn.style.display = (mode === 'custom') ? '' : 'none';
    // Reset game-paused state at game start; back button stays visible
    document.body.classList.remove('game-paused');
    const backBtn = document.getElementById('back-btn');
    if (backBtn) backBtn.style.display = '';
    updateSuspicionBar(0);
    updateGasBar();
    updateScore(0);
    updateTargetBar();

    els.overlay.classList.remove('show');
    els.statusMsg.textContent = '';

    // Start fart tracker for this level
    RELEASE_TRACKER.startLevel();

    running = true;
    lastT = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function levelTagText() {
    if (mode === 'chaos') return 'Chaos Mode';
    if (mode === 'stealth') return 'Stealth Mode';
    if (mode === 'custom') return 'Custom Level';
    if (level.isEndless) return `Endless · Lvl ${level.levelNumber}`;
    return `Level ${level.levelNumber} / 30`;
  }

  function setLocationBackground(location) {
    if (!location) { els.scene.classList.add('no-bg-art'); return; }
    els.scene.classList.remove('no-bg-art');
    ASSETS.applyBackground(els.sceneBg, location.bg);
    // Seat/bench layer — loads location.seat if present; hides element when absent.
    // CHAIR SCALING: each location in data.js can include a `seatScale` property
    // (e.g. seatScale: 1.2) to make that chair larger or smaller relative to the
    // 200px base size defined in style.css #scene-seat. 1.0 = reference (office chair).
    // To adjust an individual chair: open js/data.js, find the location entry, and
    // add/change its seatScale value. To adjust all chairs at once: change the base
    // width in css/style.css → #scene-seat.
    if (location.seat) {
      ASSETS.applyTo(els.sceneSeat, location.seat);
      els.sceneSeat.style.display = '';
      const BASE_CHAIR_WIDTH = 200; // px — matches #scene-seat width in style.css
      const scale = (location.seatScale != null) ? location.seatScale : 1.0;
      els.sceneSeat.style.width = Math.round(BASE_CHAIR_WIDTH * scale) + 'px';
      // SEAT VERTICAL OFFSET: each location can define seatOffsetY (px) to nudge
      // its seat image up or down. Positive = lower on screen (further from top).
      // Edit seatOffsetY in js/data.js for the specific location you want to adjust.
      // TO MOVE A SEAT UP:   set seatOffsetY to a negative number (e.g. -30)
      // TO MOVE A SEAT DOWN: set seatOffsetY to a positive number (e.g.  30)
      const offsetY = (location.seatOffsetY != null) ? location.seatOffsetY : 0;
      els.sceneSeat.style.bottom = offsetY + 'px';
    } else {
      els.sceneSeat.removeAttribute('src');
      els.sceneSeat.style.display = 'none';
    }
  }

  function setupCompanion() {
    const companion = level.companion;
    if (!companion || companion.id === 'none') {
      els.companionWrap.style.display = 'none';
      COMPANION_SYSTEM.init({ id: 'none', name: '', rule: 'none' }, ctx);
      return;
    }
    els.companionWrap.style.display = 'block';
    ASSETS.applyTo(els.companionImg, companion.body || companion.portrait);
    els.companionName.textContent = companion.name;
    COMPANION_SYSTEM.init(companion, ctx);
  }

  // Thematic label for the story/target progress bar — was generic
  // "Target"/numeric-only before; now consistently shown everywhere this
  // bar's purpose is described (HUD card label, target text, overlay
  // summary, custom-setup form, level-complete stats). Change this one
  // string to retheme the whole progress bar's wording everywhere.
  const PROGRESS_LABEL = '100s of mL of Gas Released';

  function setupHudVisibility() {
    // Suspicion bar: hidden entirely in Chaos Mode (no suspicion concept).
    els.suspBar.parentElement.parentElement.style.display = (mode === 'chaos') ? 'none' : '';

    // Gas bar: hidden in Chaos Mode (infinite gas, no pressure concept).
    if (mode === 'chaos') {
      els.gasCard.style.display = 'none';
    } else {
      els.gasCard.style.display = '';
      els.gasCard.querySelector('.hud-label').textContent = 'Gas Pressure';
    }

    // Target progress: only shown when this level has a real target.
    const hasTarget = (mode === 'story' || mode === 'custom' || mode === 'endless');
    els.targetCard.style.display = hasTarget ? 'block' : 'none';
    if (hasTarget) {
      const targetLabelEl = els.targetCard.querySelector('.hud-label');
      if (targetLabelEl) targetLabelEl.textContent = PROGRESS_LABEL;
    }

    // Extra HUD (e.g. Romance Meter) driven by companion rule, if any.
    refreshExtraHud();
  }

  function refreshExtraHud() {
    const extra = COMPANION_SYSTEM.getExtraHud();
    if (extra) {
      els.extraHudCard.style.display = 'block';
      els.extraHudLabel.textContent = extra.label;
      els.extraHudBar.style.width = clamp((extra.value / extra.max) * 100, 0, 100) + '%';
    } else {
      els.extraHudCard.style.display = 'none';
    }
  }

  // ── Main loop ───────────────────────────────────────────────────────────
  function loop(now) {
    if (!running) return;
    const dt = Math.min(64, now - lastT);
    lastT = now;

    if (!paused) {
      update(dt);
    }

    rafId = requestAnimationFrame(loop);
  }

  function update(dt) {
    // Spawn NPCs at a rate driven by density (more density = more frequent).
    spawnTimer += dt;
    const density = level.npcDensity !== undefined ? level.npcDensity : 0.5;
    const spawnInterval = lerp(1900, 550, clamp(density, 0, 1));
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      NPC_SYSTEM.spawn(density, mode === 'chaos' ? 1.3 : 1);
    }

    NPC_SYSTEM.update(dt);
    CLOUD_SYSTEM.update(dt);
    PLAYER.update(dt);
    COMPANION_SYSTEM.tick(dt);
    refreshExtraHud();

    // Tick fart tracker with live hold power
    RELEASE_TRACKER.tick(dt, { power: PLAYER.getHoldPower ? PLAYER.getHoldPower() : 0 });

    PLAYER.updateIdleFace(mode === 'chaos' ? 0 : suspicion);
    updateGasBar();

    if (statusTimer > 0) {
      statusTimer -= dt;
      if (statusTimer <= 0) els.statusMsg.textContent = '';
    }
    if (statusCooldown > 0) statusCooldown -= dt;

    if (mode !== 'chaos') {
      // Passive suspicion decay so a clean stretch slowly cools down.
      // Decay never fires once suspicion is already maxed — otherwise a
      // single frame of decay right after a detection could yank the bar
      // back under 100 in the same tick and the catch would never trigger.
      if (suspicion < 100) {
        const decayMult = CLOUD_SYSTEM.modEffect('suspicionDecayMult');
        suspicion = clamp(suspicion - dt * 0.008 * decayMult, 0, 100);
      }
      updateSuspicionBar(suspicion);

      if (suspicion >= 100) {
        triggerCaught();
        return;
      }
    }

    if ((mode === 'story' || mode === 'custom' || mode === 'endless') && level.targetGas) {
      updateTargetBar();
      if (gasReleased >= level.targetGas) {
        triggerWin();
        return;
      }
    }
  }

  // ── Player release → cloud + loudness pulse + scoring ─────────────────
  // `power` is 0..1 hold power. `isPuff` marks a mid-hold puff vs a full
  // release on button-up (both still emit smell/loudness, full release
  // additionally adds to gasReleased/score).
  // Cloud direction vs. lean direction (REVERSED — see mechanics note):
  // cloud.js's spawnSmellCloud() internally flips whatever `dir` it's
  // given (spawn offset uses -dir*50, drift uses -dir), so passing the
  // raw lean direction here actually makes the cloud travel in the SAME
  // direction the player leaned. To get "lean left -> fart travels
  // right" / "lean right -> fart travels left" (cross directions), we
  // must pass leanDir straight through (NOT inverted) so cloud.js's
  // internal flip produces the opposite-of-lean travel. Lean
  // animations/controls are untouched — only this direction value.
  function handlePlayerRelease(power, isPuff) {
    const baseSmell = mode === 'chaos' ? 0.7 : level.smellLevel;
    const baseLoud  = mode === 'chaos' ? 0.7 : level.loudLevel;
    // Apply character stat multipliers: smell boosts cloud pungency,
    // wetness boosts loudness (noisier release).
    const smellMult = (typeof CHAR_STATS !== 'undefined') ? CHAR_STATS.getSmellMult()   : 1;
    const wetMult   = (typeof CHAR_STATS !== 'undefined') ? CHAR_STATS.getWetnessMult() : 1;
    const smellLevel = Math.min(1, baseSmell * smellMult);
    const loudLevel  = Math.min(1, baseLoud  * wetMult);
    const envNoise = level.environmentNoise !== undefined ? level.environmentNoise : 0.3;

    // Fart tracker: only finalize fart on true button-up release, not mid-hold puffs.
    // Puffs fire handlePlayerRelease with isPuff=true while the button is still held —
    // calling onFartEnd there was the bug that capped recorded fart length at the
    // first puff interval (~380 ms). Duration is measured from onFartStart to the
    // actual button-up here.
    if (!isPuff) {
      RELEASE_TRACKER.onFartEnd({ power, isPuff, smellLevel, loudLevel });
    }

    const leanDir = PLAYER.getHoldDir();
    // leanDir itself (not -leanDir) so the cloud ends up traveling
    // opposite to the lean direction once cloud.js's internal flip
    // is applied. Random fallback (idle/involuntary release) unchanged.
    const cloudDir = leanDir !== 0 ? leanDir : (Math.random() < 0.5 ? -1 : 1);
    CLOUD_SYSTEM.spawnSmellCloud(cloudDir, power, smellLevel);
    const { hits, effectiveLoud } = CLOUD_SYSTEM.emitLoudnessPulse(power, loudLevel, envNoise);

    COMPANION_SYSTEM.onPlayerRelease({ power, smellLevel, loudLevel });

    // SMALL FART (click/tap, power < TAP_THRESHOLD): distinct suspicion pathway.
    // Small farts are short and sharp — they produce a noticeable noise burst that
    // nearby NPCs can't easily ignore, even though the release itself is small.
    // Unlike a prolonged hold fart (whose suspicion flows through reactNpc from
    // the loudness pulse above), small farts bypass the regular loudness-scaled
    // path and instead apply a flat suspicion hit directly — making spam-clicking
    // risky. The hit is applied per nearby NPC (same detection as loud pulse) so
    // distance still matters, but the base amount is meaningfully higher than what
    // the normal low-power path would produce.
    const TAP_THRESHOLD = 0.22; // must match player.js stopHold()
    const isSmallFart = !isPuff && power < TAP_THRESHOLD;
    if (isSmallFart && mode !== 'chaos') {
      // Flat suspicion per detecting NPC — tuned so a single tap near one NPC
      // is noticeable but survivable; spam-clicking near several NPCs will
      // escalate the bar quickly. Uses the same hits list from the loudness
      // pulse above so range/positioning still factors in.
      const SMALL_FART_SUSPICION_PER_NPC = 4; // TUNABLE: suspicion per detecting NPC for small taps (was 7, lowered)
      const SMALL_FART_MIN_SUSPICION = 2;      // TUNABLE: minimum suspicion even with no NPC hits (was 3, lowered)
      let smallFartSuspicionGain = SMALL_FART_MIN_SUSPICION + hits.length * SMALL_FART_SUSPICION_PER_NPC;
      smallFartSuspicionGain = COMPANION_SYSTEM.modifySuspicionGain(smallFartSuspicionGain, { source: 'loud', power });
      suspicion = clamp(suspicion + smallFartSuspicionGain, 0, 100);
      updateSuspicionBar(suspicion);
      if (suspicion >= 100 && running) triggerCaught();
    } else {
      hits.forEach(h => reactNpc(h.npc, 'loud', power, h.closeness));
      if (effectiveLoud > 0.55 && hits.length === 0) {
        // Loud but nobody in range — still flavor text, no penalty.
      }
    }

    // Progress ("gas released") contribution per release — now tied
    // DIRECTLY to the fart meter (`power`, 0..1 hold charge) using true
    // EXPONENTIAL scaling rather than a polynomial curve, so the value
    // grows much faster near the top of the meter than a power^n curve
    // would. normalizedExp(power) = (e^(EXP_K*power) - 1) / (e^EXP_K - 1)
    // is 0 at power=0, 1 at power=1, and curves upward increasingly
    // steeply as EXP_K grows — i.e. a fully-charged fart is worth
    // dramatically more than a half-charged one, which is worth only
    // slightly more than a quick tap. PROGRESS_CAP raised substantially
    // from before so a big charged fart visibly devours a huge chunk of
    // the bar in one release; PROGRESS_FLOOR keeps a bare tap from being
    // worth literally nothing. Mid-hold "puffs" (and by extension rapid
    // spam-clicking, which mostly produces taps/puffs rather than a full
    // charge) stay scaled down hard so they can't substitute for an
    // actual sustained charge.
    // SMALL FART FLOOR: click/taps guaranteed at least 1.0 units (100 mL)
    // so they have real progress value when used at the right moment.
    const PROGRESS_FLOOR = isSmallFart ? 1.0 : 0.3;
    const PROGRESS_CAP = 14;        // maximum credit a single fully-charged release can award
    const EXP_K = 5.5;              // higher = steeper exponential curve = big farts matter even more
    const p = clamp(power, 0, 1);
    const normalizedExp = (Math.exp(EXP_K * p) - 1) / (Math.exp(EXP_K) - 1);
    const fullReleaseAmount = PROGRESS_FLOOR + normalizedExp * (PROGRESS_CAP - PROGRESS_FLOOR);
    const amount = isPuff ? fullReleaseAmount * 0.1 : fullReleaseAmount;
    gasReleased += amount;
    if (mode !== 'chaos') {
      score += Math.round(amount * 8);
      updateScore(score);
    } else {
      score += Math.round(amount * 5);
      updateScore(score);
    }

    if (!isPuff) {
      const pool = power > 0.7 ? DIALOGUE.chaos : DIALOGUE.release;
      setStatus(randFrom(mode === 'chaos' ? DIALOGUE.chaos : pool), 1800, true);
    }
  }

  function handleInvoluntary() {
    setStatus(randFrom(DIALOGUE.involuntary), 1800, true);
    AUDIO.playInvoluntaryFart();
    const envNoise = level.environmentNoise !== undefined ? level.environmentNoise : 0.3;
    // FIX: accidental farts go in a RANDOM direction (not always right).
    // Also use a randomized power between 0.3–0.6 so accidental farts don't
    // always produce maximum clouds. Higher accident stat = more gas released.
    const accidentDir = Math.random() < 0.5 ? -1 : 1;
    const accidentPower = 0.3 + Math.random() * 0.3; // 0.3–0.6 range
    const accidentSmell = mode === 'chaos' ? 0.7 : level.smellLevel;
    CLOUD_SYSTEM.spawnSmellCloud(accidentDir, accidentPower, accidentSmell);
    const { hits } = CLOUD_SYSTEM.emitLoudnessPulse(accidentPower, mode === 'chaos' ? 0.7 : level.loudLevel, envNoise);
    hits.forEach(h => reactNpc(h.npc, 'loud', accidentPower, h.closeness));
    // Suspicion from accidental farts — scales with accident power but stays reasonable.
    // Accidental farts should be noticeably risky but not instantly game-ending.
    if (mode !== 'chaos') {
      // FIX: accidental farts now cause meaningful suspicion (was causing too little)
      const accidentSusp = 8 + accidentPower * 12; // 8–15 suspicion
      suspicion = clamp(suspicion + accidentSusp, 0, 100);
      updateSuspicionBar(suspicion);
      if (suspicion >= 100 && running) triggerCaught();
    }
    // Gas released: scales with character's accident stat via CHAR_STATS
    const accidentGas = (typeof CHAR_STATS !== 'undefined') ? CHAR_STATS.getAccidentGasRelease() : 25;
    gasReleased += accidentGas * 0.12; // small progress contribution
  }

  // ── NPC detection / reaction ────────────────────────────────────────────
  function handleNpcDetected(npc, info) {
    reactNpc(npc, info.source, info.power, info.closeness);
  }

  // `power` = fart size/intensity (0..1, from hold charge or involuntary
  // release). `closeness` = how close the detecting NPC was within the
  // detection radius (1 = right on top of it, 0 = at the very edge) —
  // now supplied for BOTH loud and smell detections (see cloud.js).
  // Defaults to 1 (no falloff) for chaos-mode flavor hits that don't
  // pass it.
  function reactNpc(npc, source, power, closeness = 1) {
    if (npc.reacted && source === 'smell') return; // smell already tagged this npc once
    npc.reacted = true;

    // Fart tracker: record this NPC detection
    RELEASE_TRACKER.onNpcDetected(npc.id || 'npc', source);

    const intensity = clamp(power, 0, 1);
    const pool = intensity > 0.75 ? DIALOGUE.npc_chaos
      : intensity > 0.5 ? DIALOGUE.npc_strong
      : intensity > 0.25 ? DIALOGUE.npc_medium
      : DIALOGUE.npc_mild;

    showNpcSpeech(npc, randFrom(pool));

    const reactEl = npc.el.querySelector('.npc-react');
    if (reactEl) reactEl.textContent = intensity > 0.6 ? '😡' : intensity > 0.3 ? '😟' : '🤔';

    if (mode === 'chaos') {
      score += Math.round(intensity * 12);
      updateScore(score);
      setStatus(randFrom(DIALOGUE.hit), 1300);
      return;
    }

    // SUSPICION SCALING (size dampened, distance falloff strengthened):
    // - sizeFactor: previously suspicion scaled linearly with `intensity`
    //   (bigger fart = proportionally more suspicion). Now a "largeness
    //   penalty" shrinks the multiplier as intensity grows, so a fully
    //   charged release (intensity=1) generates noticeably LESS total
    //   suspicion than the old linear formula gave it, while quick/small
    //   farts (low intensity) are barely changed. SIZE_PENALTY controls
    //   how much big farts get discounted (0 = no discount/old behavior,
    //   higher = bigger farts generate progressively less suspicion).
    // - distanceFactor raises closeness to a power > 1, which pushes the
    //   falloff curve down hard for anything not very close — i.e.
    //   distance now reduces suspicion much more aggressively than the
    //   old direct multiply did.
    const SIZE_PENALTY = 0.55;
    const sizeFactor = intensity * (1 - SIZE_PENALTY * intensity);
    const distanceFactor = Math.pow(clamp(closeness, 0, 1), 2.4);

    let baseGain = sizeFactor * distanceFactor * (10 + npc.depthMeta.detectionMult * 8)
      * (CLOUD_SYSTEM.modEffect('suspicionFromSoundMult') || 1);
    if (source === 'loud') baseGain *= 1.15;

    const finalGain = COMPANION_SYSTEM.modifySuspicionGain(baseGain, { source, power: intensity });
    suspicion = clamp(suspicion + finalGain, 0, 100);
    updateSuspicionBar(suspicion);

    if (finalGain > 0 && intensity > 0.4) {
      setStatus(randFrom(DIALOGUE.suspicious), 1600);
    }

    if (suspicion >= 100 && running) {
      triggerCaught();
    }
  }

  const NPC_SPEECH_COOLDOWN = 4000; // ms — NPC won't change dialogue more often than this
  function showNpcSpeech(npc, text) {
    const bubble = npc.el.querySelector('.npc-speech');
    if (!bubble) return;
    const now = performance.now();
    // Don't update speech bubble if NPC already said something recently
    if (npc.lastSpeechTime && (now - npc.lastSpeechTime) < NPC_SPEECH_COOLDOWN) return;
    npc.lastSpeechTime = now;
    bubble.textContent = text;
    bubble.classList.add('visible');
    clearTimeout(npc.speechTimeout);
    npc.speechTimeout = setTimeout(() => bubble.classList.remove('visible'), 2500);
  }

  // ── Status line helper (also used by companion.js via ctx.setStatus) ──
  // STATUS_MIN_GAP: minimum ms before the status line can change again.
  // This prevents rapid cycling when NPCs detect clouds during a hold.
  // Set to 0 for force=true calls (caught, release, involuntary) so
  // important moments always show. NPC reactions and suspicion lines
  // respect the cooldown so they don't flash by too fast to read.
  const STATUS_MIN_GAP = 3500; // ms — dialogue stays readable between changes
  function setStatus(text, durationMs = 1500, force = false) {
    if (!force && statusCooldown > 0) return; // respect cooldown
    els.statusMsg.textContent = text;
    statusTimer = durationMs;
    statusCooldown = STATUS_MIN_GAP;
  }

  // ── HUD updates ─────────────────────────────────────────────────────────
  function updateSuspicionBar(value) {
    els.suspBar.style.width = clamp(value, 0, 100) + '%';
    els.suspBar.style.background = value > 70 ? '#cc3b3b' : value > 40 ? '#e8a020' : '#3a9e3a';
  }

  function updateGasBar() {
    const g = mode === 'chaos' ? 100 : PLAYER.getGas();
    els.gasBar.style.width = clamp(g, 0, 100) + '%';
    els.gasBar.style.background = g > 85 ? '#cc3b3b' : g > 55 ? '#e8a020' : '#5b8def';
  }

  function updateScore(value) {
    els.scoreVal.textContent = String(Math.round(value));
  }

  function updateTargetBar() {
    if (!level || !level.targetGas) return;
    const pct = clamp((gasReleased / level.targetGas) * 100, 0, 100);
    els.targetBar.style.width = pct + '%';
    els.targetText.textContent = `${Math.round(gasReleased)} / ${level.targetGas} (${PROGRESS_LABEL})`;
  }

  // ── End states ──────────────────────────────────────────────────────────
  // Called the instant suspicion maxes out (from update()'s passive check
  // or immediately from reactNpc() on a big detection). Guarded by
  // `running` so it can only ever fire once per level. This now pauses
  // the run and reports a `caught: true` result through onLevelEnd —
  // main.js/ui.js are responsible for showing the dedicated caught/
  // failure screen (character facecam + Retry/Character Select/Main
  // Menu) instead of this file silently restarting anything itself.
  function triggerCaught() {
    if (!running) return;
    running = false;
    PLAYER.stopHold();
    PLAYER.setFace(Math.random() < 0.5 ? 'caught1' : 'caught2', true);
    setStatus(randFrom(DIALOGUE.caught), 1200, true);
    const fartSummary = RELEASE_TRACKER.endLevel(false);
    setTimeout(() => finish(buildResult(false, { caught: true, fartSummary })), 700);
  }

  function triggerWin() {
    if (!running) return;
    running = false;
    PLAYER.stopHold();
    const fartSummary = RELEASE_TRACKER.endLevel(true);
    // Skip the in-game overlay; go directly to the level-complete screen.
    setTimeout(() => finish(buildResult(true, { fartSummary })), 400);
  }

  function showOverlay(title, sub, success) {
    els.overlayTitle.textContent = title;
    els.overlaySub.textContent = sub;
    els.overlayScore.textContent = `Score: ${Math.round(score)}  ·  ${PROGRESS_LABEL}: ${Math.round(gasReleased)}`;
    els.overlayBtn.textContent = success ? 'Continue' : 'Try Again';
    els.overlayBtn.onclick = () => finish(buildResult(success));
    els.overlay.classList.add('show');
  }

  // `extra` lets specific call sites attach result flags beyond plain
  // success/failure — currently:
  //   caught: true        — suspicion hit 100, player was actually caught
  //   exitedToMenu: true  — player chose "Back to Modes" from the pause
  //                         screen; NOT a catch, must not be treated as one
  function buildResult(success, extra = {}) {
    return {
      success,
      score: Math.round(score),
      gasReleased,
      difficultyScore: level.difficultyScore || 0,
      characterName: character ? character.name : '',
      character,
      levelNumber: level ? level.levelNumber : 0,
      mode,
      caught: false,
      exitedToMenu: false,
      ...extra,
    };
  }

  function lastResultForMenu() {
    // "Back to Modes" from the pause/overlay screen. This is a deliberate
    // menu exit, NOT a catch — exitedToMenu:true lets main.js tell the
    // difference from triggerCaught()'s result and route straight to
    // screen-mode-select instead of misreading this as a failed/caught
    // run that needs the caught screen or a same-level restart.
    return buildResult(false, { exitedToMenu: true });
  }

  function finish(result) {
    running = false;
    els.overlay.classList.remove('show');
    if (rafId) cancelAnimationFrame(rafId);
    if (onLevelEnd) onLevelEnd(result);
  }

  // ── Pause ───────────────────────────────────────────────────────────────
  function setPaused(p) {
    paused = p;
    if (paused) {
      document.body.classList.add('game-paused');
      // Back button is always visible — no change needed here
      PLAYER.stopHold();
      showOverlay('Paused', 'Take a breather. The pressure will still be here.', null);
      els.overlayBtn.textContent = 'Resume';
      els.overlayBtn.onclick = () => { els.overlay.classList.remove('show'); setPaused(false); };
    } else {
      document.body.classList.remove('game-paused');
      // Back button stays visible during gameplay
      els.overlay.classList.remove('show');
      lastT = performance.now();
    }
  }

  // Called by APP.goBack() when paused during gameplay — exits to mode select
  function exitToMenu() {
    if (onLevelEnd) finish(lastResultForMenu());
  }

  function stop() {
    running = false;
    PLAYER.stopHold();
    if (rafId) cancelAnimationFrame(rafId);
    NPC_SYSTEM.clear();
    CLOUD_SYSTEM.clear();
    els.overlay.classList.remove('show');
    RELEASE_TRACKER.setVisible(false);
  }

  // ── Special Move System ─────────────────────────────────────────────────
  // Infrastructure for per-character special moves. The ⚡ button in-game
  // (index.html #btn-special) fires this when pressed. The actual move is
  // defined in CHARACTER_SPECIALS (data.js) for each character.
  //
  // TO ENABLE A SPECIAL FOR A CHARACTER:
  //   Open js/data.js → find CHARACTER_SPECIALS → set enabled: true and
  //   define cooldownMs and fn(game) for that character. The button
  //   appears automatically during gameplay for that character.
  //
  // The `game` object passed to fn() exposes:
  //   game.getSuspicion()        — current suspicion 0-100
  //   game.setSuspicion(v)       — set suspicion to a value
  //   game.setStatus(text, ms)   — show status message
  //   game.addGas(amount)        — add/remove gas from player tank
  let specialCooldownTimer = 0;
  let specialEnabled = false;

  function wireSpecialButton() {
    if (!els.btnSpecial) return;
    els.btnSpecial.addEventListener('click', handleSpecialMove);
    els.btnSpecial.addEventListener('touchstart', (e) => { e.preventDefault(); handleSpecialMove(); }, { passive: false });
  }

  function handleSpecialMove() {
    if (!running || paused || !specialEnabled || specialCooldownTimer > 0) return;
    const charId = character ? (character.id || '').toLowerCase() : '';
    const spec = (typeof CHARACTER_SPECIALS !== 'undefined') ? CHARACTER_SPECIALS[charId] : null;
    if (!spec || !spec.enabled || !spec.fn) return;
    // Build a safe game API object for the special move function
    const gameApi = {
      getSuspicion: () => suspicion,
      setSuspicion: (v) => { suspicion = clamp(v, 0, 100); updateSuspicionBar(suspicion); },
      setStatus: (text, ms) => setStatus(text, ms),
      addGas: (amt) => PLAYER.reset ? null : null, // placeholder — extend as needed
    };
    try { spec.fn(gameApi); } catch(e) { console.warn('Special move error:', e); }
    specialCooldownTimer = spec.cooldownMs || 15000;
    els.btnSpecial.disabled = true;
    els.btnSpecial.style.opacity = '0.5';
    const cooldownInterval = setInterval(() => {
      if (!running) { clearInterval(cooldownInterval); return; }
      specialCooldownTimer -= 100;
      if (specialCooldownTimer <= 0) {
        specialCooldownTimer = 0;
        els.btnSpecial.disabled = false;
        els.btnSpecial.style.opacity = '1';
        clearInterval(cooldownInterval);
      }
    }, 100);
  }

  function setupSpecialButton() {
    if (!els.btnSpecial) return;
    const charId = character ? (character.id || '').toLowerCase() : '';
    const spec = (typeof CHARACTER_SPECIALS !== 'undefined') ? CHARACTER_SPECIALS[charId] : null;
    specialEnabled = !!(spec && spec.enabled && spec.fn);
    specialCooldownTimer = 0;
    els.btnSpecial.style.display = specialEnabled ? '' : 'none';
    els.btnSpecial.disabled = false;
    els.btnSpecial.style.opacity = '1';
    if (spec && spec.label) els.btnSpecial.title = spec.label;
  }


  function setPausedPublic(p) { if (running) setPaused(p); }

  return { init, setCallbacks, start, stop, exitToMenu, setPausedPublic };
})();

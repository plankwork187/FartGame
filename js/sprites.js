/* ============================================================================
   SPRITES.JS — Fart animation system (renamed from fartsprites.js)
   ============================================================================

   ANIMATION STYLES
   ----------------
   Three modes selectable in-game via FART_ANIM_STYLE:
     'original' — plain green circles (the original look)
     'better'   — enhanced CSS keyframe clouds that travel further (default)
     'sprite'   — frame-by-frame sprite sheet (requires art asset)

   HOW TO ADD YOUR OWN ART
   ----------------------------------------
   Create a sprite sheet WebP (all frames side by side), save as
   images/fart_sheet.webp, update SPRITE_SHEET_PATH below, then select
   'Sprite' in the in-game animation style control.

   ── CONFIG ── (edit these values) ──────────────────────────────────────── */

/* Global animation style — changed by the in-game control.
   Values: 'original' | 'better' | 'sprite'                               */
let FART_ANIM_STYLE = 'better';

const FART_SPRITE_CONFIG = {

  /* Path to your sprite sheet WebP, relative to index.html.             */
  SPRITE_SHEET_PATH: 'images/fart_sheet.webp',

  /* How many animation frames are on the sheet (left to right).         */
  FRAME_COUNT: 8,

  /* Width of ONE frame in pixels (sheet total width / frame count).     */
  FRAME_WIDTH: 128,

  /* Height of ONE frame (= height of the whole sheet).                  */
  FRAME_HEIGHT: 128,

  /* How many milliseconds to show each frame.  Try 60–120 ms.          */
  FRAME_DURATION_MS: 80,

  /* Display size in the game scene (pixels).                            */
  DISPLAY_SIZE: 80,

  /* Opacity of the cloud div (0–1).                                     */
  OPACITY: 0.85,

};

/* ============================================================================
   IMPLEMENTATION — you do not need to edit anything below this line
   ============================================================================ */

const FART_SPRITES = (() => {

  // ── CSS keyframe injection (runs once on load) ────────────────────────────
  // Injects the fart-puff keyframe animation into the page's <style> so it's
  // available immediately for any cloud element that requests it.
  function injectCSS() {
    if (document.getElementById('fart-sprite-styles')) return; // already injected
    const style = document.createElement('style');
    style.id = 'fart-sprite-styles';
    style.textContent = `
      /* ── Puff keyframe: grows, drifts FAR upward, fades ── */
      @keyframes fartPuff {
        0%   { transform: scale(0.2) translateY(0px);    opacity: 0;    border-radius: 50%; }
        12%  { transform: scale(0.65) translateY(-14px); opacity: 0.9;  border-radius: 44%; }
        35%  { transform: scale(1.05) translateY(-45px); opacity: 0.78; border-radius: 52% 48% 44% 56%; }
        65%  { transform: scale(1.3) translateY(-90px);  opacity: 0.45; border-radius: 60% 40% 55% 45%; }
        100% { transform: scale(1.5) translateY(-140px); opacity: 0;    border-radius: 50%; }
      }

      /* ── Bubble keyframe: rises far upward like gas bubbles ── */
      @keyframes fartBubble {
        0%   { transform: scale(0.3) translateY(0)      translateX(0);    opacity: 0; }
        20%  { transform: scale(0.8) translateY(-20px)  translateX(5px);  opacity: 0.85; }
        60%  { transform: scale(1.1) translateY(-70px)  translateX(-8px); opacity: 0.5; }
        100% { transform: scale(0.5) translateY(-130px) translateX(4px);  opacity: 0; }
      }

      /* ── Wisp keyframe: thin horizontal streak ── */
      @keyframes fartWisp {
        0%   { transform: scaleX(0.1) scaleY(0.5) translateX(0);   opacity: 0; }
        20%  { transform: scaleX(1.0) scaleY(0.8) translateX(10px); opacity: 0.7; }
        60%  { transform: scaleX(1.8) scaleY(0.9) translateX(30px); opacity: 0.35; }
        100% { transform: scaleX(2.8) scaleY(0.5) translateX(60px); opacity: 0; }
      }

      /* ── Sprite-sheet animation (only used when SPRITE_MODE:true) ── */
      @keyframes fartSpritePlay {
        /* This is overridden dynamically per-cloud via JS steps() */
        to { background-position-x: 100%; }
      }

      /* Base cloud element overrides for CSS-animation mode */
      .cloud-animated {
        border-radius: 50% !important;
        border: none !important;
        background: radial-gradient(circle at 40% 35%,
          rgba(220, 240, 140, 0.95) 0%,
          rgba(170, 210, 80, 0.75) 40%,
          rgba(120, 170, 50, 0.3) 70%,
          transparent 100%
        ) !important;
        box-shadow: 0 0 12px rgba(160, 200, 60, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: visible;
        pointer-events: none;
      }

      .cloud-puff {
        animation: fartPuff var(--puff-dur, 1.4s) ease-out forwards;
      }

      .cloud-bubble-wrap {
        position: absolute;
        bottom: 50%;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 5px;
        pointer-events: none;
      }
      .cloud-bubble {
        width: 10px; height: 10px;
        border-radius: 50%;
        background: rgba(180, 230, 100, 0.7);
        animation: fartBubble var(--bub-dur, 1.1s) ease-out infinite;
        animation-delay: var(--bub-delay, 0s);
      }

      .cloud-wisp {
        position: absolute;
        top: 35%;
        left: -10%;
        width: 120%;
        height: 30%;
        border-radius: 50%;
        background: rgba(200, 230, 120, 0.35);
        transform-origin: left center;
        animation: fartWisp var(--wisp-dur, 1.0s) ease-out infinite;
        animation-delay: var(--wisp-delay, 0s);
        pointer-events: none;
      }

      /* Sprite-sheet cloud */
      .cloud-sprite {
        background-repeat: no-repeat;
        background-size: auto 100%;
        image-rendering: pixelated; /* keeps pixel art crisp; remove for painted art */
        animation: none !important; /* JS drives frame stepping */
        border-radius: 0 !important;
        border: none !important;
        background-color: transparent !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Cloud element builder ─────────────────────────────────────────────────
  // Creates a cloud <div> enhanced with CSS animation or sprite-sheet logic,
  // matching the same API that cloud.js's spawnSmellCloud() expects.
  function buildCloudElement(effectiveSmell, radius, dir) {
    const el = document.createElement('div');
    el.className = 'cloud';

    const cfg = FART_SPRITE_CONFIG;
    const style = FART_ANIM_STYLE || 'better';

    if (style === 'sprite' && cfg.SPRITE_SHEET_PATH) {
      // ── SPRITE SHEET MODE ──────────────────────────────────────────────
      el.classList.add('cloud-sprite');
      const displaySize = Math.round(cfg.DISPLAY_SIZE * (0.5 + effectiveSmell * 0.5));
      el.style.width  = displaySize + 'px';
      el.style.height = displaySize + 'px';
      el.style.backgroundImage = `url('${cfg.SPRITE_SHEET_PATH}')`;
      el.style.backgroundSize = `${cfg.FRAME_COUNT * 100}% 100%`;
      el.style.backgroundPositionX = '0%';

      // Advance frames via JS interval (no CSS animation needed)
      let currentFrame = 0;
      const interval = setInterval(() => {
        currentFrame = (currentFrame + 1) % cfg.FRAME_COUNT;
        el.style.backgroundPositionX = `${(currentFrame / (cfg.FRAME_COUNT - 1)) * 100}%`;
      }, cfg.FRAME_DURATION_MS);
      // Store cleanup function on element so cloud.js can call it on remove
      el._stopSprite = () => clearInterval(interval);

    } else if (style === 'better') {
      // ── ENHANCED CSS ANIMATION MODE — clouds travel further ───────────
      el.classList.add('cloud-animated', 'cloud-puff');

      const size = Math.round(radius * 2);
      el.style.width  = size + 'px';
      el.style.height = size + 'px';

      // Longer duration so clouds get further before fading
      const dur = (1.6 + effectiveSmell * 1.2 + Math.random() * 0.5).toFixed(2) + 's';
      el.style.setProperty('--puff-dur', dur);

      // Add floating bubble child elements for a more organic look
      const bubbleWrap = document.createElement('div');
      bubbleWrap.className = 'cloud-bubble-wrap';
      const bubbleCount = Math.round(1 + effectiveSmell * 3); // 1–4 bubbles
      for (let i = 0; i < bubbleCount; i++) {
        const b = document.createElement('div');
        b.className = 'cloud-bubble';
        const bubDur = (1.2 + Math.random() * 0.9).toFixed(2) + 's';
        const bubDelay = (Math.random() * 0.5).toFixed(2) + 's';
        b.style.setProperty('--bub-dur', bubDur);
        b.style.setProperty('--bub-delay', bubDelay);
        const bs = Math.round(6 + Math.random() * 8);
        b.style.width = bs + 'px';
        b.style.height = bs + 'px';
        bubbleWrap.appendChild(b);
      }
      el.appendChild(bubbleWrap);

      // Add a wisp streak for larger clouds
      if (effectiveSmell > 0.3) {
        const wisp = document.createElement('div');
        wisp.className = 'cloud-wisp';
        wisp.style.setProperty('--wisp-dur', (1.2 + Math.random() * 0.7).toFixed(2) + 's');
        wisp.style.setProperty('--wisp-delay', (Math.random() * 0.3).toFixed(2) + 's');
        wisp.style.transform = dir < 0 ? 'scaleX(-1)' : 'scaleX(1)';
        el.appendChild(wisp);
      }

      // Emoji still shows for very stinky releases
      if (effectiveSmell > 0.7) {
        const emoji = document.createElement('span');
        emoji.textContent = '💨';
        emoji.style.cssText = 'position:absolute;font-size:' + Math.round(10 + effectiveSmell * 8) + 'px;pointer-events:none;z-index:1;';
        el.appendChild(emoji);
      }

    } else {
      // ── ORIGINAL CIRCLE MODE ──────────────────────────────────────────
      el.style.width = el.style.height = Math.round(radius * 2) + 'px';
      el.style.background = effectiveSmell > 0.6
        ? 'rgba(180,220,80,0.55)'
        : 'rgba(200,230,120,0.38)';
      el.style.border = '1px solid rgba(140,180,40,0.4)';
      el.style.fontSize = Math.round(10 + effectiveSmell * 8) + 'px';
      el.textContent = effectiveSmell > 0.7 ? '💨' : '';
    }

    return el;
  }

  // ── Sprite cleanup ────────────────────────────────────────────────────────
  // Call this when a cloud element is removed from the DOM (cloud.js does
  // this automatically — we just need to clear the sprite interval if set).
  function onCloudRemoved(el) {
    if (el && typeof el._stopSprite === 'function') {
      el._stopSprite();
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    injectCSS();
  }

  function setAnimStyle(s) {
    if (['original', 'better', 'sprite'].includes(s)) FART_ANIM_STYLE = s;
  }
  function getAnimStyle() { return FART_ANIM_STYLE; }

  return { init, buildCloudElement, onCloudRemoved, setAnimStyle, getAnimStyle };
})();

// Auto-initialise when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', FART_SPRITES.init);
} else {
  FART_SPRITES.init();
}

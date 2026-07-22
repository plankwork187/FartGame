/* ============================================================================
   SEATCONFIG.JS — Per-character seat size and vertical position overrides
   ============================================================================

   WHY THIS FILE EXISTS
   --------------------
   Each location already has a `seatScale` and `seatOffsetY` in data.js that
   set the default seat appearance. But different character art is drawn at
   different scales, so one character might look perfectly seated while
   another looks like they're floating or buried.

   This file lets you fine-tune EACH character's seat scale and Y position
   PER LOCATION without touching data.js or game.js.

   HOW THE NUMBERS WORK
   --------------------
   • seatScale  — multiplied ON TOP of the location's own seatScale.
                  1.0 = no change from the location default.
                  1.1 = 10% bigger.   0.9 = 10% smaller.

   • seatOffsetY — ADDED to the location's own seatOffsetY (pixels).
                  0   = no vertical change.
                  20  = seat moves 20 px DOWN (lower on screen).
                 -20  = seat moves 20 px UP  (higher on screen).

   HOW TO USE THIS FILE
   --------------------
   1. Play through any location and notice which character looks wrong.
   2. Find that character's block below (e.g. `sabrina`).
   3. Find that location's id inside it (e.g. `library`).
   4. Adjust seatScale and/or seatOffsetY until it looks right.
   5. Save and refresh — no build step needed.

   QUICK WORKFLOW
   --------------
   Pick ONE character whose art looks good at the DEFAULT seat sizes and
   call that your "reference character." Leave all her values at 1.0 / 0.
   For every other character, adjust their values relative to how much
   bigger or smaller their art is compared to the reference.

   Currently sabrina is set as the reference (all 1.0 / 0).
   Adjust everyone else relative to her.

   LOCATION IDs (copy/paste as needed)
   ------------------------------------
   library, movie_theater, park, restaurant, campus, backstage,
   waiting_room, music_video_set, office, hotel, airport, wedding,
   gym, museum, aquarium, zoo, stadium, movie_set
   ============================================================================ */

const SEAT_CONFIG = {

  /* ── SABRINA (reference character — all values 1.0 / 0) ─────────────── */
  sabrina: {
    library:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_theater:   { seatScale: 1.0, seatOffsetY: 0 },
    park:            { seatScale: 1.0, seatOffsetY: 0 },
    restaurant:      { seatScale: 1.0, seatOffsetY: 0 },
    campus:          { seatScale: 1.0, seatOffsetY: 0 },
    backstage:       { seatScale: 1.0, seatOffsetY: 0 },
    waiting_room:    { seatScale: 1.0, seatOffsetY: 0 },
    music_video_set: { seatScale: 1.0, seatOffsetY: 0 },
    office:          { seatScale: 1.0, seatOffsetY: 0 },
    hotel:           { seatScale: 1.0, seatOffsetY: 0 },
    airport:         { seatScale: 1.0, seatOffsetY: 0 },
    wedding:         { seatScale: 1.0, seatOffsetY: 0 },
    gym:             { seatScale: 1.0, seatOffsetY: 0 },
    museum:          { seatScale: 1.0, seatOffsetY: 0 },
    aquarium:        { seatScale: 1.0, seatOffsetY: 0 },
    zoo:             { seatScale: 1.0, seatOffsetY: 0 },
    stadium:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_set:       { seatScale: 1.0, seatOffsetY: 0 },
  },

  /* ── OLIVIA ─────────────────────────────────────────────────────────── */
  olivia: {
    library:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_theater:   { seatScale: 1.0, seatOffsetY: 0 },
    park:            { seatScale: 1.0, seatOffsetY: 0 },
    restaurant:      { seatScale: 1.0, seatOffsetY: 0 },
    campus:          { seatScale: 1.0, seatOffsetY: 0 },
    backstage:       { seatScale: 1.0, seatOffsetY: 0 },
    waiting_room:    { seatScale: 1.0, seatOffsetY: 0 },
    music_video_set: { seatScale: 1.0, seatOffsetY: 0 },
    office:          { seatScale: 1.0, seatOffsetY: 0 },
    hotel:           { seatScale: 1.0, seatOffsetY: 0 },
    airport:         { seatScale: 1.0, seatOffsetY: 0 },
    wedding:         { seatScale: 1.0, seatOffsetY: 0 },
    gym:             { seatScale: 1.0, seatOffsetY: 0 },
    museum:          { seatScale: 1.0, seatOffsetY: 0 },
    aquarium:        { seatScale: 1.0, seatOffsetY: 0 },
    zoo:             { seatScale: 1.0, seatOffsetY: 0 },
    stadium:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_set:       { seatScale: 1.0, seatOffsetY: 0 },
  },

  /* ── ARIANA ─────────────────────────────────────────────────────────── */
  ariana: {
    library:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_theater:   { seatScale: 1.0, seatOffsetY: 0 },
    park:            { seatScale: 1.0, seatOffsetY: 0 },
    restaurant:      { seatScale: 1.0, seatOffsetY: 0 },
    campus:          { seatScale: 1.0, seatOffsetY: 0 },
    backstage:       { seatScale: 1.0, seatOffsetY: 0 },
    waiting_room:    { seatScale: 1.0, seatOffsetY: 0 },
    music_video_set: { seatScale: 1.0, seatOffsetY: 0 },
    office:          { seatScale: 1.0, seatOffsetY: 0 },
    hotel:           { seatScale: 1.0, seatOffsetY: 0 },
    airport:         { seatScale: 1.0, seatOffsetY: 0 },
    wedding:         { seatScale: 1.0, seatOffsetY: 0 },
    gym:             { seatScale: 1.0, seatOffsetY: 0 },
    museum:          { seatScale: 1.0, seatOffsetY: 0 },
    aquarium:        { seatScale: 1.0, seatOffsetY: 0 },
    zoo:             { seatScale: 1.0, seatOffsetY: 0 },
    stadium:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_set:       { seatScale: 1.0, seatOffsetY: 0 },
  },

  /* ── BEYONCÉ ─────────────────────────────────────────────────────────── */
  'beyoncé': {
    library:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_theater:   { seatScale: 1.0, seatOffsetY: 0 },
    park:            { seatScale: 1.0, seatOffsetY: 0 },
    restaurant:      { seatScale: 1.0, seatOffsetY: 0 },
    campus:          { seatScale: 1.0, seatOffsetY: 0 },
    backstage:       { seatScale: 1.0, seatOffsetY: 0 },
    waiting_room:    { seatScale: 1.0, seatOffsetY: 0 },
    music_video_set: { seatScale: 1.0, seatOffsetY: 0 },
    office:          { seatScale: 1.0, seatOffsetY: 0 },
    hotel:           { seatScale: 1.0, seatOffsetY: 0 },
    airport:         { seatScale: 1.0, seatOffsetY: 0 },
    wedding:         { seatScale: 1.0, seatOffsetY: 0 },
    gym:             { seatScale: 1.0, seatOffsetY: 0 },
    museum:          { seatScale: 1.0, seatOffsetY: 0 },
    aquarium:        { seatScale: 1.0, seatOffsetY: 0 },
    zoo:             { seatScale: 1.0, seatOffsetY: 0 },
    stadium:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_set:       { seatScale: 1.0, seatOffsetY: 0 },
  },

  /* ── MADELYN ─────────────────────────────────────────────────────────── */
  madelyn: {
    library:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_theater:   { seatScale: 1.0, seatOffsetY: 0 },
    park:            { seatScale: 1.0, seatOffsetY: 0 },
    restaurant:      { seatScale: 1.0, seatOffsetY: 0 },
    campus:          { seatScale: 1.0, seatOffsetY: 0 },
    backstage:       { seatScale: 1.0, seatOffsetY: 0 },
    waiting_room:    { seatScale: 1.0, seatOffsetY: 0 },
    music_video_set: { seatScale: 1.0, seatOffsetY: 0 },
    office:          { seatScale: 1.0, seatOffsetY: 0 },
    hotel:           { seatScale: 1.0, seatOffsetY: 0 },
    airport:         { seatScale: 1.0, seatOffsetY: 0 },
    wedding:         { seatScale: 1.0, seatOffsetY: 0 },
    gym:             { seatScale: 1.0, seatOffsetY: 0 },
    museum:          { seatScale: 1.0, seatOffsetY: 0 },
    aquarium:        { seatScale: 1.0, seatOffsetY: 0 },
    zoo:             { seatScale: 1.0, seatOffsetY: 0 },
    stadium:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_set:       { seatScale: 1.0, seatOffsetY: 0 },
  },

  /* ── BRYCE ───────────────────────────────────────────────────────────── */
  bryce: {
    library:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_theater:   { seatScale: 1.0, seatOffsetY: 0 },
    park:            { seatScale: 1.0, seatOffsetY: 0 },
    restaurant:      { seatScale: 1.0, seatOffsetY: 0 },
    campus:          { seatScale: 1.0, seatOffsetY: 0 },
    backstage:       { seatScale: 1.0, seatOffsetY: 0 },
    waiting_room:    { seatScale: 1.0, seatOffsetY: 0 },
    music_video_set: { seatScale: 1.0, seatOffsetY: 0 },
    office:          { seatScale: 1.0, seatOffsetY: 0 },
    hotel:           { seatScale: 1.0, seatOffsetY: 0 },
    airport:         { seatScale: 1.0, seatOffsetY: 0 },
    wedding:         { seatScale: 1.0, seatOffsetY: 0 },
    gym:             { seatScale: 1.0, seatOffsetY: 0 },
    museum:          { seatScale: 1.0, seatOffsetY: 0 },
    aquarium:        { seatScale: 1.0, seatOffsetY: 0 },
    zoo:             { seatScale: 1.0, seatOffsetY: 0 },
    stadium:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_set:       { seatScale: 1.0, seatOffsetY: 0 },
  },

  /* ── CHARACTER 7 ─────────────────────────────────────────────────────── */
  char7: {
    library:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_theater:   { seatScale: 1.0, seatOffsetY: 0 },
    park:            { seatScale: 1.0, seatOffsetY: 0 },
    restaurant:      { seatScale: 1.0, seatOffsetY: 0 },
    campus:          { seatScale: 1.0, seatOffsetY: 0 },
    backstage:       { seatScale: 1.0, seatOffsetY: 0 },
    waiting_room:    { seatScale: 1.0, seatOffsetY: 0 },
    music_video_set: { seatScale: 1.0, seatOffsetY: 0 },
    office:          { seatScale: 1.0, seatOffsetY: 0 },
    hotel:           { seatScale: 1.0, seatOffsetY: 0 },
    airport:         { seatScale: 1.0, seatOffsetY: 0 },
    wedding:         { seatScale: 1.0, seatOffsetY: 0 },
    gym:             { seatScale: 1.0, seatOffsetY: 0 },
    museum:          { seatScale: 1.0, seatOffsetY: 0 },
    aquarium:        { seatScale: 1.0, seatOffsetY: 0 },
    zoo:             { seatScale: 1.0, seatOffsetY: 0 },
    stadium:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_set:       { seatScale: 1.0, seatOffsetY: 0 },
  },

  /* ── CHARACTER 8 ─────────────────────────────────────────────────────── */
  char8: {
    library:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_theater:   { seatScale: 1.0, seatOffsetY: 0 },
    park:            { seatScale: 1.0, seatOffsetY: 0 },
    restaurant:      { seatScale: 1.0, seatOffsetY: 0 },
    campus:          { seatScale: 1.0, seatOffsetY: 0 },
    backstage:       { seatScale: 1.0, seatOffsetY: 0 },
    waiting_room:    { seatScale: 1.0, seatOffsetY: 0 },
    music_video_set: { seatScale: 1.0, seatOffsetY: 0 },
    office:          { seatScale: 1.0, seatOffsetY: 0 },
    hotel:           { seatScale: 1.0, seatOffsetY: 0 },
    airport:         { seatScale: 1.0, seatOffsetY: 0 },
    wedding:         { seatScale: 1.0, seatOffsetY: 0 },
    gym:             { seatScale: 1.0, seatOffsetY: 0 },
    museum:          { seatScale: 1.0, seatOffsetY: 0 },
    aquarium:        { seatScale: 1.0, seatOffsetY: 0 },
    zoo:             { seatScale: 1.0, seatOffsetY: 0 },
    stadium:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_set:       { seatScale: 1.0, seatOffsetY: 0 },
  },

  /* ── CHARACTER 9 ─────────────────────────────────────────────────────── */
  char9: {
    library:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_theater:   { seatScale: 1.0, seatOffsetY: 0 },
    park:            { seatScale: 1.0, seatOffsetY: 0 },
    restaurant:      { seatScale: 1.0, seatOffsetY: 0 },
    campus:          { seatScale: 1.0, seatOffsetY: 0 },
    backstage:       { seatScale: 1.0, seatOffsetY: 0 },
    waiting_room:    { seatScale: 1.0, seatOffsetY: 0 },
    music_video_set: { seatScale: 1.0, seatOffsetY: 0 },
    office:          { seatScale: 1.0, seatOffsetY: 0 },
    hotel:           { seatScale: 1.0, seatOffsetY: 0 },
    airport:         { seatScale: 1.0, seatOffsetY: 0 },
    wedding:         { seatScale: 1.0, seatOffsetY: 0 },
    gym:             { seatScale: 1.0, seatOffsetY: 0 },
    museum:          { seatScale: 1.0, seatOffsetY: 0 },
    aquarium:        { seatScale: 1.0, seatOffsetY: 0 },
    zoo:             { seatScale: 1.0, seatOffsetY: 0 },
    stadium:         { seatScale: 1.0, seatOffsetY: 0 },
    movie_set:       { seatScale: 1.0, seatOffsetY: 0 },
  },

};

/* ── Public API ──────────────────────────────────────────────────────────────
   Called by game.js to get the final seat scale and offset for the current
   character + location combo. Returns multipliers to STACK on top of the
   location's own defaults (from data.js). You never need to touch this. */
function getSeatOverride(characterId, locationId) {
  const charBlock = SEAT_CONFIG[characterId];
  if (!charBlock) return { seatScale: 1.0, seatOffsetY: 0 };
  const override = charBlock[locationId];
  if (!override) return { seatScale: 1.0, seatOffsetY: 0 };
  return {
    seatScale:   (override.seatScale   != null) ? override.seatScale   : 1.0,
    seatOffsetY: (override.seatOffsetY != null) ? override.seatOffsetY : 0,
  };
}

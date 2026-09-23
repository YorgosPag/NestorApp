'use strict';
/**
 * =============================================================================
 * Χ — ΤΟ ΔΕΣΙΜΟ ΤΩΝ GOLDEN IDS ΣΤΙΣ ΔΙΑΔΡΟΜΕΣ (ADR-875 §10)
 * =============================================================================
 *
 * Ο σπορέας γράφει στο manifest **ποιο id** πήρε κάθε οντότητα· ο κατάλογος
 * (`golden-catalog.js`) λέει **σε ποιο τμήμα** μπαίνει. Εδώ ενώνονται — fail-closed.
 *
 * 🔑 ΔΥΟ URL ΑΝΑ ΔΙΑΔΡΟΜΗ, ΠΟΤΕ ΕΝΑ:
 *   • `url`      — η **ταυτότητα** ratchet: `…/rfqs/golden-rfq`. ΣΤΑΘΕΡΗ ανά run.
 *   • `fetchUrl` — το **αίτημα**: `…/rfqs/rfq_8f…`. Οι γραφείς της εικόνας κόβουν
 *                  ΤΥΧΑΙΑ ids και τα tokens λήγουν ⇒ αλλάζει σε κάθε run.
 *   Αν το id έμπαινε στην ταυτότητα, κάθε run θα έβγαζε «ΝΕΑ ΔΙΑΔΡΟΜΗ» και η
 *   baseline δεν θα σταθεροποιούνταν ποτέ. Για τον ίδιο λόγο το `maskGoldenIds`
 *   σβήνει τα ids και από τα `detail` (π.χ. στόχος ανακατεύθυνσης `?projectId=…`).
 *
 * ⚠️ ΚΑΜΙΑ npm ΕΞΑΡΤΗΣΗ (ADR-788).
 * =============================================================================
 */

const { SYNTHETIC_SEGMENT } = require('./states');
const { GOLDEN_ENTITIES, GOLDEN_TEMPLATES, GOLDEN_TIERS, goldenSegment } = require('./golden-catalog');

function fail(message) {
  throw new Error(`CHECK 3.51 Χ (ADR-875 §10): ${message}`);
}

/** Ό,τι μπαίνει αυτούσιο σε τμήμα URL: ids (`proj_…`), base64url tokens, τιμές `snake_case`. */
const GOLDEN_ID = /^[A-Za-z0-9._~-]{1,4096}$/;

/**
 * `manifest.golden.entities` — ΑΚΡΙΒΩΣ οι οντότητες του καταλόγου. Μία που λείπει
 * θα άφηνε σιωπηλά `ssr-probe`· μία παραπάνω σημαίνει κατάλογο και σπορέα που αποκλίνουν.
 */
function parseGolden(golden) {
  if (!golden || typeof golden !== 'object' || !golden.entities || typeof golden.entities !== 'object') {
    fail('manifest χωρίς golden.entities');
  }
  const entities = golden.entities;
  const expected = Object.keys(GOLDEN_ENTITIES).sort();
  const actual = Object.keys(entities).sort();
  const missing = expected.filter((key) => !actual.includes(key));
  const unknown = actual.filter((key) => !expected.includes(key));
  if (missing.length > 0) fail(`golden χωρίς οντότητα: ${missing.join(', ')}`);
  if (unknown.length > 0) fail(`golden με άγνωστη οντότητα: ${unknown.join(', ')}`);
  for (const key of expected) {
    const id = entities[key];
    if (typeof id !== 'string' || !GOLDEN_ID.test(id)) fail(`golden.entities.${key}: μη έγκυρο id`);
    const prefix = GOLDEN_ENTITIES[key].prefix;
    if (prefix && !id.startsWith(`${prefix}_`)) fail(`golden.entities.${key}: το id δεν έχει το πρόθεμα «${prefix}_»`);
  }
  return Object.freeze({ ...entities });
}

/** Ο κατάλογος πρέπει να αντιστοιχεί σε υπαρκτά πρότυπα — αλλιώς είναι μπαγιάτικος. */
function assertCatalogMatchesRoutes(routes) {
  const templates = new Set(routes.map((route) => route.template));
  const stale = Object.keys(GOLDEN_TEMPLATES).filter((template) => !templates.has(template));
  if (stale.length > 0) fail(`μπαγιάτικος κατάλογος golden — πρότυπα που δεν υπάρχουν πια: ${stale.join(', ')}`);
}

/**
 * Γεμίζει ΚΑΘΕ δυναμικό τμήμα από τον κατάλογο — το `[workspace]` από τον χώρο του persona,
 * τα υπόλοιπα από τα golden ids. Πρότυπο εκτός καταλόγου ⇒ τα τμήματά του μένουν
 * `ssr-probe` και η διαδρομή μένει 🔶 — **φαίνεται** (ratchet + ταβάνι), δεν κρύβεται.
 *
 * `persona === null` ⇒ **δημόσια πόρτα** (ADR-876): δένεται ανώνυμα. Αν το πρότυπο έχει
 * `[workspace]` χωρίς persona, είναι σφάλμα του καλούντος — fail-closed, ποτέ κενό τμήμα.
 */
function bindRoute(route, persona, golden) {
  const segments = route.template.split('/');
  // Χωρίς golden (τοπικά, ή manifest μόνο ταυτότητας σε τεστ): μόνο το `[workspace]` γεμίζει.
  const bound = golden ? GOLDEN_TEMPLATES[route.template] || null : null;
  let next = 0;
  const identity = [];
  const request = [];
  for (const segment of segments) {
    if (segment === '[workspace]') {
      if (!persona) fail(`${route.template}: \`[workspace]\` χωρίς persona — δημόσια πόρτα δεν ζει σε χώρο`);
      identity.push(persona.workspaceSegment);
      request.push(persona.workspaceSegment);
    } else if (segment.startsWith('[')) {
      const entity = bound ? bound[next] : undefined;
      next += 1;
      identity.push(entity ? goldenSegment(entity) : SYNTHETIC_SEGMENT);
      request.push(entity ? encodeURIComponent(golden[entity]) : SYNTHETIC_SEGMENT);
    } else {
      identity.push(segment);
      request.push(segment);
    }
  }
  const catalogued = GOLDEN_TEMPLATES[route.template];
  if (catalogued && catalogued.length !== next) {
    fail(`${route.template}: ο κατάλογος δίνει ${catalogued.length} οντότητες για ${next} δυναμικά τμήματα`);
  }
  const url = identity.join('/');
  return { url, fetchUrl: request.join('/'), dynamic: url.split('/').includes(SYNTHETIC_SEGMENT) };
}

/** Τα πραγματικά ids → η σταθερή τους ταυτότητα, ώστε κανένα `detail` να μην αλλάζει ανά run. */
function maskGoldenIds(text, golden) {
  if (typeof text !== 'string' || !golden) return text;
  let masked = text;
  for (const [entity, id] of Object.entries(golden)) {
    if (GOLDEN_ENTITIES[entity].tier === GOLDEN_TIERS.VALUE) continue; // τιμή, όχι id: σταθερή
    for (const form of new Set([id, encodeURIComponent(id)])) masked = masked.split(form).join(goldenSegment(entity));
  }
  return masked;
}

module.exports = {
  parseGolden,
  assertCatalogMatchesRoutes,
  bindRoute,
  maskGoldenIds,
};

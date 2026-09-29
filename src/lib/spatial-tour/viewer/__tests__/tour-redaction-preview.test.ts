/**
 * @fileoverview **Η ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΘΟΛΩΜΑΤΟΣ ΓΙΑ ΤΗ GPU** (ADR-884 Φ2ζ ζ3 · §4.15).
 *
 * 🔑 Ο shader δεν εκτελείται σε jsdom· η άγκυρα εκτελεί τον ΙΔΙΟ συσκευαστή/αποσυσκευαστή και απαιτεί οι σταθερές του ψήστη
 * (άκρη, βήμα κατάστασης, όριο) να είναι **γραμμένες μέσα** στο GLSL — όχι αντίγραφα που θα αποκλίνουν.
 *
 * - **Σ** — συσκευασία: κατεύθυνση = `yawPitchToDirection`, `w` αποσυσκευάζεται ακριβώς, προτεραιότητα στην αποκοπή.
 * - **Κ** — κελί = του ψήστη (`redactionProxyWidth`).
 * - **G** — οι σταθερές ζουν στο κείμενο GLSL βάσης **και** πλακιδίων.
 */

import {
  glslFloat, TOUR_PANORAMA_FRAGMENT_SHADER, TOUR_TILE_FRAGMENT_SHADER, TOUR_TILE_VERTEX_SHADER,
} from '@/components/spatial-tour/viewer/tour-panorama-shader';
import { TOUR_REDACTION_MAX_RADIUS_RAD, TOUR_REDACTION_MIN_RADIUS_RAD } from '@/constants/spatial-tour-vocabulary';

import { TOUR_REDACTION_FEATHER, redactionProxyWidth } from '../../tileset/tour-redaction-mask';
import { faceSizeForEquirect } from '../../tileset/tour-tileset-layout';
import type { TourRedactionPreview } from '../../tour-redaction-draft';
import { yawPitchToDirection } from '../tour-cube-faces';
import {
  packRedactionPreview, redactionCellRad, TOUR_REDACTION_PREVIEW_MAX, TOUR_REDACTION_PREVIEW_STATE,
  TOUR_REDACTION_PREVIEW_STRIDE, TOUR_REDACTION_RING_PX, unpackRedactionW,
} from '../tour-redaction-preview';

const preview = (state: TourRedactionPreview['state'], yawRad = 0.3, radiusRad = 0.2): TourRedactionPreview =>
  ({ yawRad, pitchRad: -0.2, radiusRad, state });

describe('Σ — συσκευασία', () => {
  it('xyz = κατεύθυνση του κέντρου, w αποσυσκευάζεται ΑΚΡΙΒΩΣ σε κάθε κατάσταση και στα άκρα της ακτίνας', () => {
    for (const state of ['applied', 'draft', 'selected', 'removing'] as const) {
      for (const radiusRad of [TOUR_REDACTION_MIN_RADIUS_RAD, 0.3, TOUR_REDACTION_MAX_RADIUS_RAD]) {
        const { data, count } = packRedactionPreview([preview(state, 1.2, radiusRad)]);
        const d = yawPitchToDirection(1.2, -0.2);
        expect(count).toBe(1);
        expect([...data.slice(0, 3)].map((v) => Number(v.toFixed(5)))).toEqual([d.x, d.y, d.z].map((v) => Number(v.toFixed(5))));
        const unpacked = unpackRedactionW(data[3] ?? NaN);
        expect(unpacked.state).toBe(TOUR_REDACTION_PREVIEW_STATE[state]);
        expect(unpacked.radiusRad).toBeCloseTo(radiusRad, 5);
      }
    }
  });

  it('το βήμα ξεπερνά τη μέγιστη ακτίνα (αλλιώς η κατάσταση «διαρρέει» στην ακτίνα)', () => {
    expect(TOUR_REDACTION_PREVIEW_STRIDE).toBeGreaterThan(TOUR_REDACTION_MAX_RADIUS_RAD);
  });

  it('πάνω από το όριο κόβονται ΠΡΩΤΑ οι «υπό αφαίρεση» — ποτέ πρόχειρος/επιλεγμένος', () => {
    const many = [
      ...Array.from({ length: TOUR_REDACTION_PREVIEW_MAX }, () => preview('removing')),
      preview('draft'), preview('selected'),
    ];
    const { data, count } = packRedactionPreview(many);
    expect(count).toBe(TOUR_REDACTION_PREVIEW_MAX);
    expect(unpackRedactionW(data[3] ?? NaN).state).toBe(TOUR_REDACTION_PREVIEW_STATE.selected);
    expect(unpackRedactionW(data[7] ?? NaN).state).toBe(TOUR_REDACTION_PREVIEW_STATE.draft);
  });

  it('κενή ⇒ count 0', () => {
    expect(packRedactionPreview([]).count).toBe(0);
  });
});

describe('Κ — το κελί είναι του ψήστη', () => {
  const ratio = (width: number) => redactionCellRad(faceSizeForEquirect(width)) / ((2 * Math.PI) / redactionProxyWidth(width));

  it.each([6144, 8192, 11000])('equirect %i (συνήθης κάμερα 360°) ⇒ ίδια γωνία κελιού με τον ψήστη (±5%)', (width) => {
    expect(ratio(width)).toBeGreaterThan(0.95);
    expect(ratio(width)).toBeLessThan(1.05);
  });

  // ⚠️ ΜΕΤΡΗΜΕΝΟ ΟΡΙΟ, όχι σφάλμα: η λήψη δεν κρατά το πλάτος του πρωτοτύπου, και η όψη στρογγυλεύεται στο πλακίδιο / κόβεται στο
  // ταβάνι ⇒ στα άκρα το κελί της ΠΡΟΕΠΙΣΚΟΠΗΣΗΣ αποκλίνει (το ψήσιμο μένει ακριβές). Αν αυτό κοκκινίσει, κάποιος άλλαξε τη διάταξη.
  it.each([[4096, 0.8], [16384, 0.75]])('equirect %i ⇒ απόκλιση μέσα στο δηλωμένο όριο (≥ %s)', (width, floor) => {
    expect(ratio(width)).toBeGreaterThan(floor);
    expect(ratio(width)).toBeLessThan(1 / floor);
  });
});

describe('G — οι σταθερές ζουν στο GLSL', () => {
  it.each([['βάση', TOUR_PANORAMA_FRAGMENT_SHADER], ['πλακίδιο', TOUR_TILE_FRAGMENT_SHADER]])('%s: άκρη · βήμα · όριο · κάλυψη', (_, glsl) => {
    expect(glsl).toContain(`radius * ${glslFloat(TOUR_REDACTION_FEATHER)}`);
    expect(glsl).toContain(`r.w / ${glslFloat(TOUR_REDACTION_PREVIEW_STRIDE)}`);
    expect(glsl).toContain(`uniform vec4 redactions[${TOUR_REDACTION_PREVIEW_MAX}]`);
    expect(glsl).toContain('redactionCover(vDirection)');
  });

  it('η βάση ψηφιδώνει στα κελιά (`redactionCellRad`)· το πλακίδιο ανοίγει για να φανεί η βάση', () => {
    expect(TOUR_PANORAMA_FRAGMENT_SHADER).toContain('mix(rgb, cellBlur(vDirection), cover.x)');
    expect(TOUR_TILE_FRAGMENT_SHADER).toContain('opacity * max(1.0 - cover.x, max(cover.y, cover.z))');
  });

  it('το περίγραμμα μετριέται σε pixel ΟΘΟΝΗΣ με τα πάχη της σταθεράς (πυρήνας + άλως)', () => {
    for (const glsl of [TOUR_PANORAMA_FRAGMENT_SHADER, TOUR_TILE_FRAGMENT_SHADER]) {
      expect(glsl).toContain('abs(d - radius) / pixelAngle');
      // Η παράγωγος ΕΞΩ από τον βρόχο (μέσα σε βρόχο με `break` = ακαθόριστη· ANGLE/D3D ⇒ 0 ⇒ αόρατο περίγραμμα, ζωντανά).
      const loop = glsl.indexOf('for (int i = 0;');
      expect(glsl.indexOf('fwidth(')).toBeGreaterThan(-1);
      expect(glsl.indexOf('fwidth(')).toBeLessThan(loop);
      expect(glsl.slice(loop).includes('fwidth(')).toBe(false);
      expect(glsl).toContain(glslFloat(TOUR_REDACTION_RING_PX.selected / 2));
      expect(glsl).toContain(glslFloat(TOUR_REDACTION_RING_PX.normal / 2));
      expect(glsl).toContain('withRedactionRing(');
    }
    expect(TOUR_TILE_VERTEX_SHADER).toContain('vDirection = position');
  });

  it('η GLSL είναι ΜΟΝΟ ASCII — τα σχόλια ζουν στο TypeScript, όχι στο κείμενο που φτάνει στον οδηγό της κάρτας', () => {
    for (const glsl of [TOUR_PANORAMA_FRAGMENT_SHADER, TOUR_TILE_FRAGMENT_SHADER, TOUR_TILE_VERTEX_SHADER]) {
      expect([...glsl].filter((c) => c.charCodeAt(0) > 127)).toEqual([]);
    }
  });

  it('glslFloat: ακέραιος ⇒ «.0»', () => {
    expect(glslFloat(4)).toBe('4.0');
    expect(glslFloat(0.2)).toBe('0.2');
  });
});

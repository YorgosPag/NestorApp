/**
 * ADR-507 — **CONTRACT TEST** του HATCH render-field passthrough (anti-drift).
 *
 * Ο σκοπός δεν είναι να ελέγξει «λειτουργεί ο mapper;» — είναι να κάνει **αδύνατο** να
 * ξαναχαθεί σιωπηλά μια ιδιότητα γραμμοσκίασης στον δρόμο προς τον καμβά. Έξι ιδιότητες
 * χάθηκαν έτσι στο παρελθόν (backgroundColor / patternSpace / gradient / imageFill /
 * lineweightMm / inlinePattern) γιατί κάθε προβολή κρατούσε δική της χειρόγραφη λίστα.
 *
 * Αν κάποιος προσθέσει πεδίο στο {@link HATCH_RENDER_FIELDS} χωρίς να το μεταφέρουν ΟΛΕΣ οι
 * προβολές, **αυτό το αρχείο κοκκινίζει**.
 *
 * @see bim/hatch/hatch-render-fields.ts
 * @see bim/text/text-render-fields.ts — ο αδελφός SSoT (ADR-557)
 */

import { HATCH_RENDER_FIELDS, pickHatchRenderFields } from '../hatch-render-fields';
import { TO_DXF_HANDLERS } from '../../../hooks/canvas/dxf-scene-entity-handlers';
import { buildEntityModelFromDxf } from '../../../canvas-v2/dxf-canvas/dxf-renderer-entity-model';
import type { HatchEntity } from '../../../types/entities';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

/**
 * Μια γραμμοσκίαση με **ΚΑΘΕ** πεδίο του συμβολαίου γεμάτο με ξεχωριστή, αναγνωρίσιμη τιμή.
 * Αν προστεθεί πεδίο στο `HATCH_RENDER_FIELDS` και ξεχαστεί εδώ, το πρώτο test το πιάνει.
 */
const FULL_HATCH = {
  id: 'h_contract', type: 'hatch', layerId: 'L', visible: true,
  boundaryPaths: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]],
  fillType: 'predefined',
  fillColor: '#123456',
  patternType: 'pattern',
  patternName: 'ANSI31',
  patternScale: 3.5,
  patternAngle: 42,
  patternOrigin: { x: 7, y: 9 },
  lineAngle: 17,
  lineSpacing: 55,
  doubleCrossHatch: true,
  patternSpace: 'screen',
  islandStyle: 'outer',
  gradient: { type: 'linear', color1: '#ff0000' },
  imageFill: { assetId: 'asset_x', tileWidth: 100, tileHeight: 50 },
  backgroundColor: '#ffffff',
  drawOrder: 2,
  lineweightMm: 0.35,
  inlinePattern: {
    name: 'ANSI31', labelKey: 'k', category: 'special',
    lines: [{ angle: 45, origin: [0, 0], delta: [0, 250], dashes: [] }],
  },
} as unknown as HatchEntity;

describe('HATCH_RENDER_FIELDS — το συμβόλαιο', () => {
  it('το δείγμα ελέγχου γεμίζει ΚΑΘΕ πεδίο της λίστας (αλλιώς ο έλεγχος είναι ψεύτικος)', () => {
    const missing = HATCH_RENDER_FIELDS.filter(
      (f) => (FULL_HATCH as unknown as Record<string, unknown>)[f] === undefined,
    );
    expect(missing).toEqual([]);
  });

  it('περιλαμβάνει το `inlinePattern` — το πεδίο που έκρυβε τις εισαγόμενες γραμμοσκιάσεις', () => {
    expect(HATCH_RENDER_FIELDS).toContain('inlinePattern');
  });

  it('pickHatchRenderFields ΠΑΡΑΛΕΙΠΕΙ τα απόντα optionals (ποτέ κλειδί με undefined)', () => {
    const picked = pickHatchRenderFields({ boundaryPaths: [], patternName: 'X' } as Partial<HatchEntity>);
    expect(Object.keys(picked).sort()).toEqual(['boundaryPaths', 'patternName']);
    expect('gradient' in picked).toBe(false);
  });
});

describe('🔴 ΚΑΜΙΑ προβολή δεν ρίχνει πεδίο του συμβολαίου', () => {
  const base = { id: FULL_HATCH.id, layerId: 'L', visible: true };
  const dxf = TO_DXF_HANDLERS.hatch!(FULL_HATCH, base as never) as unknown as Record<string, unknown>;

  it('προβολή 1/2 — scene HatchEntity → DxfHatch', () => {
    expect(dxf).not.toBeNull();
    const dropped = HATCH_RENDER_FIELDS.filter((f) => dxf[f] === undefined);
    expect(dropped).toEqual([]);
  });

  it('προβολή 2/2 — DxfHatch → render EntityModel', () => {
    const model = buildEntityModelFromDxf(
      dxf as unknown as DxfEntityUnion, false,
      { colorHex: '#fff', lineWidthPx: 1, alpha: 1 },
    ) as unknown as Record<string, unknown>;
    const dropped = HATCH_RENDER_FIELDS.filter((f) => model[f] === undefined);
    expect(dropped).toEqual([]);
  });

  it('🔴 end-to-end: το inlinePattern φτάνει ΑΥΤΟΥΣΙΟ στο μοντέλο που βλέπει ο HatchRenderer', () => {
    const model = buildEntityModelFromDxf(
      dxf as unknown as DxfEntityUnion, false,
      { colorHex: '#fff', lineWidthPx: 1, alpha: 1 },
    ) as unknown as { inlinePattern?: { lines: Array<{ delta: [number, number] }> } };
    // Αυτό ΑΚΡΙΒΩΣ έσπαγε: ο renderer έβλεπε inlinePattern:undefined ⇒ ο resolver έπεφτε στον
    // catalog ⇒ βήμα από `3.175 × suggested × patternScale` (6–63 m) αντί για τα 250 mm του AutoCAD.
    expect(model.inlinePattern).toBeDefined();
    expect(model.inlinePattern!.lines[0].delta).toEqual([0, 250]);
  });
});

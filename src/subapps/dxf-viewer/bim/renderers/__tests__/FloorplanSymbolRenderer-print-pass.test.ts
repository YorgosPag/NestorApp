/**
 * ADR-909 Γ2.4 — ο `FloorplanSymbolRenderer` (ο «πράσινος νεροχύτης») ρωτά την πολιτική εκτύπωσης.
 *
 * Πριν: `ctx.fillStyle = symbolFill` · `ctx.strokeStyle = symbolStroke` · `ctx.lineWidth = NORMAL`, ωμά. Στη
 * δημόσια κάτοψη «Ασπρόμαυρο» ο νεροχύτης έβγαινε `#047857` 2 px (πύλη pixels: `K1/K3:*:floorplan-symbol`).
 *
 * Φ0 🔴 η παγίδα, μετρημένη: το κοινό στρώμα γεμίσματος ΘΑ άλλαζε την οθόνη ⇒ γι' αυτό `paintLiveSymbolBody`
 * και όχι `paintLiveBody` · Φ1 οθόνη όπως πριν (γέμισμα, χρώμα, πάχος αυτούσια — και στις γραμμές του συμβόλου) ·
 * Φ2 «Ασπρόμαυρο» ⇒ μαύρο στο δάπεδο πάχους, γέμισμα άχρωμο με την ίδια διαφάνεια · Φ3 «Έγχρωμο» ⇒ το χρώμα της
 * κατηγορίας στο δάπεδο πάχους · Φ4 «Γκρι» ⇒ άχρωμο και ≥ 3:1 · Φ5 το PDF του μηχανικού χωρίς δάπεδο πάχους ·
 * Φ6 `save` / `restore` ζευγαρώνουν.
 */

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

import { FloorplanSymbolRenderer } from '../FloorplanSymbolRenderer';
import { adaptFillTintForCanvas } from '../../../config/adaptive-entity-color';
import { parseColor, parseHex, saturation } from '../../../config/color-math';
import { MIN_ENTITY_CONTRAST } from '../../../config/contrast-adaptation';
import { clearPrintColorPolicy, setPrintColorPolicy } from '../../../config/print-color-policy';
import { RENDER_LINE_WIDTHS } from '../../../config/text-rendering-config';
import {
  buildDefaultFloorplanSymbolParams,
  buildFloorplanSymbolEntity,
} from '../../../hooks/drawing/floorplan-symbol-completion';
import { FLOORPLAN_SYMBOL_CATALOG } from '../../floorplan-symbols/floorplan-symbol-catalog';
import { resolveSymbolCategoryConfig } from '../../floorplan-symbols/floorplan-symbol-categories';
import type { FloorplanSymbolCategory } from '../../types/floorplan-symbol-types';
import type { EntityModel } from '../../../rendering/types/Types';
import { ENGINEER_PDF, FLOOR_PX, isGrey, onPaper, publicImage } from './print-pass-policies';
import { recordingContext, type Painted } from './recording-canvas';

const CATEGORIES: readonly FloorplanSymbolCategory[] = ['sanitary', 'kitchen', 'furniture'];
const NORMAL = RENDER_LINE_WIDTHS.NORMAL;

/** Πραγματικό σύμβολο από το εργοστάσιο της παραγωγής — το πρώτο του καταλόγου για την κατηγορία. */
function symbolOf(category: FloorplanSymbolCategory): EntityModel {
  const preset = FLOORPLAN_SYMBOL_CATALOG.find((p) => p.category === category);
  if (!preset) throw new Error(`κανένα σύμβολο καταλόγου για «${category}»`);
  const built = buildFloorplanSymbolEntity(buildDefaultFloorplanSymbolParams({ x: 0, y: 0 }, { assetId: preset.id }), 'layer-0');
  if (!built.ok) throw new Error(`το εργοστάσιο αρνήθηκε το «${preset.id}»`);
  return built.entity as unknown as EntityModel;
}

function paint(category: FloorplanSymbolCategory): Painted {
  const { ctx, painted } = recordingContext();
  const renderer = new FloorplanSymbolRenderer(ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  renderer.render(symbolOf(category), {});
  return painted;
}

const alphaOf = (color: string): number => parseColor(color)!.a;

afterEach(clearPrintColorPolicy);

describe.each(CATEGORIES)('FloorplanSymbolRenderer — «%s» (ADR-909 Γ2.4)', (category) => {
  const cfg = resolveSymbolCategoryConfig(category);

  it('Φ0 🔴 η παγίδα: το κοινό στρώμα γεμίσματος θα ΑΛΛΑΖΕ την οθόνη — γι’ αυτό δεν το ζητά ο ζωγράφος', () => {
    expect(adaptFillTintForCanvas(cfg.fill)).not.toBe(cfg.fill);
  });

  it('Φ1 οθόνη όπως πριν: γέμισμα, χρώμα και πάχος αυτούσια — και οι γραμμές του συμβόλου με το ίδιο πενάκι', () => {
    const { fills, strokes } = paint(category);
    expect(fills).toStrictEqual([cfg.fill]);
    expect(strokes.length).toBeGreaterThan(1);
    for (const s of strokes) expect(s).toStrictEqual({ ink: cfg.stroke, width: NORMAL, dash: [] });
  });

  it('Φ2 🔴 «Ασπρόμαυρο»: κάθε γραμμή μαύρη στο δάπεδο πάχους, γέμισμα άχρωμο με την ίδια διαφάνεια', () => {
    setPrintColorPolicy(publicImage('monochrome'));
    const { fills, strokes } = paint(category);
    expect(strokes.length).toBeGreaterThan(1);
    for (const s of strokes) expect(s).toStrictEqual({ ink: '#000000', width: FLOOR_PX, dash: [] });
    expect(fills).toHaveLength(1);
    expect(isGrey(fills[0])).toBe(true);
    expect(alphaOf(fills[0])).toBe(alphaOf(cfg.fill));
  });

  it('Φ3 «Έγχρωμο»: το χρώμα της κατηγορίας, στο δάπεδο πάχους, ≥ 3:1 προς το χαρτί', () => {
    setPrintColorPolicy(publicImage('colour'));
    for (const s of paint(category).strokes) {
      expect(s.ink).toBe(cfg.stroke);
      expect(s.width).toBe(FLOOR_PX);
      expect(onPaper(s.ink)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
    }
  });

  it('Φ4 «Γκρι»: γραμμές άχρωμες και ≥ 3:1, γέμισμα άχρωμο', () => {
    setPrintColorPolicy(publicImage('grayscale'));
    const { fills, strokes } = paint(category);
    for (const s of strokes) {
      expect(saturation(parseHex(s.ink)!)).toBe(0);
      expect(onPaper(s.ink)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
    }
    expect(isGrey(fills[0])).toBe(true);
  });

  it('Φ5 PDF του μηχανικού (χωρίς δάπεδα): άχρωμο σε «Ασπρόμαυρο», το πάχος του όπως το ζήτησε', () => {
    setPrintColorPolicy(ENGINEER_PDF);
    for (const s of paint(category).strokes) expect(s).toStrictEqual({ ink: '#000000', width: NORMAL, dash: [] });
  });

  it('Φ6 `save` και `restore` ζευγαρώνουν', () => {
    const { saves, restores } = paint(category);
    expect(saves).toBeGreaterThan(0);
    expect(restores).toBe(saves);
  });
});

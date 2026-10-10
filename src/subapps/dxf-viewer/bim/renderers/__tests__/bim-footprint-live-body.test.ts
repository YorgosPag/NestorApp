/**
 * ADR-909 Γ2.3 — το κοινό σώμα των ζωγράφων Η/Μ: `beginPhasedBodyRender` → `paintLiveBody` → `endPhasedBodyRender`.
 *
 * Οι επτά ζωγράφοι Η/Μ (λέβητας · σώμα · θερμοσίφωνας · συλλέκτης · σωλήνας · εξάρτημα · ενδοδαπέδια) αντέγραφαν
 * το ίδιο προοίμιο και το ίδιο «γέμισμα + περίγραμμα». Τώρα το ζητούν από τη βάση· εδώ φυλάγεται ότι η βάση
 * κάνει ό,τι έκαναν εκείνοι.
 *
 * Π1 οθόνη όπως πριν (γέμισμα από το κοινό στρώμα, χρώμα και πάχος αυτούσια, συμπαγές) · Π2 με παύλα, η παύλα
 * ισχύει στο περίγραμμα · Π3 🔴 «Ασπρόμαυρο» ⇒ μαύρο στο δάπεδο πάχους · Π4 το προοίμιο καθαρίζει την παύλα
 * που βάζει η φάση προεπισκόπησης (σωλήνας / εξάρτημα / ενδοδαπέδια δεν το έκαναν μόνοι τους· ανάμεσα στο `save`
 * και τη δική τους παύλα υπάρχει μόνο γέμισμα, που αγνοεί την παύλα — άρα η οθόνη τους δεν αλλάζει) ·
 * Π5 `save` και `restore` ζευγαρώνουν.
 */

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

import { BimFootprintRenderer } from '../bim-footprint-renderer';
import { adaptFillTintForCanvas } from '../../../config/adaptive-entity-color';
import { MIN_ENTITY_CONTRAST } from '../../../config/contrast-adaptation';
import { clearPrintColorPolicy, setPrintColorPolicy } from '../../../config/print-color-policy';
import type { EntityModel, GripInfo, RenderOptions } from '../../../rendering/types/Types';
import { recordingContext, type Painted } from './recording-canvas';

const SQUARE = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
const TINT = 'rgba(29, 78, 216, 0.14)';
const BLUE = '#1d4ed8';
const DASH: readonly number[] = [8, 4];
const FLOOR_PX = 4;

/** Ο πιο λιτός ζωγράφος Η/Μ: ακριβώς οι τρεις κλήσεις που κάνουν και οι επτά πραγματικοί. */
class ProbeRenderer extends BimFootprintRenderer {
  dash: readonly number[] | undefined;
  render(entity: EntityModel, options: RenderOptions = {}): void {
    this.beginPhasedBodyRender(entity, SQUARE, options);
    this.paintLiveBody(SQUARE, TINT, BLUE, 2, this.dash);
    this.endPhasedBodyRender(entity, options);
  }
  getGrips(): GripInfo[] { return []; }
  hitTest(): boolean { return false; }
}

/** Προεπισκόπηση εργαλείου: εδώ το στυλ φάσης ΒΑΖΕΙ παύλα — το μόνο σημείο όπου μετρά ο καθαρισμός του προοιμίου. */
const OVERLAY_PREVIEW = { preview: true, isOverlayPreview: true };

function paint(dash?: readonly number[], entityFlags: Record<string, boolean> = {}): Painted {
  const { ctx, painted } = recordingContext();
  const renderer = new ProbeRenderer(ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  renderer.dash = dash;
  renderer.render({ id: 'probe', type: 'mep-water-heater', ...entityFlags } as unknown as EntityModel, {});
  return painted;
}

afterEach(clearPrintColorPolicy);

describe('BimFootprintRenderer — κοινό σώμα Η/Μ (ADR-909 Γ2.3)', () => {
  it('Π1 οθόνη όπως πριν: γέμισμα από το κοινό στρώμα, χρώμα και πάχος αυτούσια, συμπαγές', () => {
    const { fills, strokes } = paint();
    expect(fills).toStrictEqual([adaptFillTintForCanvas(TINT)]);
    expect(strokes).toStrictEqual([{ ink: BLUE, width: 2, dash: [] }]);
  });

  it('Π2 με παύλα: η παύλα ισχύει στο περίγραμμα και τίποτε άλλο δεν αλλάζει', () => {
    expect(paint(DASH).strokes).toStrictEqual([{ ink: BLUE, width: 2, dash: [...DASH] }]);
  });

  it('Π3 🔴 «Ασπρόμαυρο» δημόσιας κάτοψης: μαύρο και στο δάπεδο πάχους — και η παύλα μένει', () => {
    setPrintColorPolicy({ style: 'monochrome', dpi: 694, minLineWidthPx: FLOOR_PX, minInkContrast: MIN_ENTITY_CONTRAST });
    expect(paint().strokes).toStrictEqual([{ ink: '#000000', width: FLOOR_PX, dash: [] }]);
    expect(paint(DASH).strokes).toStrictEqual([{ ink: '#000000', width: FLOOR_PX, dash: [...DASH] }]);
  });

  it('Π4 το προοίμιο καθαρίζει την παύλα της φάσης: συμπαγές σώμα μένει συμπαγές και σε προεπισκόπηση', () => {
    expect(paint(undefined, OVERLAY_PREVIEW).strokes[0].dash).toStrictEqual([]);
    expect(paint(DASH, OVERLAY_PREVIEW).strokes[0].dash).toStrictEqual([...DASH]);
  });

  it('Π5 `save` και `restore` ζευγαρώνουν — η κατάσταση του σώματος δεν διαρρέει στον επόμενο', () => {
    const { saves, restores } = paint(DASH);
    expect(saves).toBeGreaterThan(0);
    expect(restores).toBe(saves);
  });
});

/**
 * convertDxfEntityToEntityModel capability coverage (ADR-587 Φ10 — seam B, **ο σιωπηλός δολοφόνος**).
 *
 * Αυτό το seam ΔΕΝ γύριζε καν `null` όταν ξεχνούσε έναν τύπο: γύριζε το base model **πετώντας
 * αθόρυβα όλα τα γεωμετρικά πεδία**. Το επόμενο στάδιο (`BoundsCalculator`) διάβαζε τότε
 * `undefined.position` → `null` → το entity δεν έμπαινε ΠΟΤΕ στο spatial index. Καμία ένδειξη,
 * πουθενά. Έτσι χάθηκαν image (ADR-654), railing (ADR-407) και wall-covering (ADR-511).
 *
 * Το test δένει τρία πράγματα:
 *  1. **Domain equality** — τα κλειδιά του μητρώου == το ζωντανό `DxfEntityUnion` variant set
 *     (`TO_ENTITY_MODEL_SUPPORTED_TYPES`). Το ίδιο domain, δύο seams: αν αποκλίνουν, ένα
 *     variant μπορεί να μπει στη σκηνή χωρίς converter.
 *  2. **Off-path partition** — ποιοι renderable τύποι ΔΕΝ έχουν handler και **γιατί** (ρητό
 *     golden με αιτιολογία ανά εγγραφή — δεν είναι κενά, είναι νόμιμες απουσίες).
 *  3. **Cross-seam behavioral pin** — scene entity → convert → `BoundsCalculator` → κουτί **με
 *     έκταση**. *Αυτό το ένα test θα είχε πιάσει και τα τρία bugs από μόνο του.*
 *     ⚠️ Ρωτούσε «non-null;» μέχρι τις 2026-09-07 — και έμεινε πράσινο ενώ ο πίνακας έμπαινε
 *     στο ευρετήριο ως **σημείο** (ADR-833: το seam ζητούσε ακόμη `model`, όχι `worksheets`).
 *     Ένας τύπος που ανέχεται εκφυλισμένο κουτί αντί για `null` κάνει το «non-null» τυφλό.
 */

// Firebase auth mock — τα type barrels αγγίζουν auth στο import path.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import {
  convertDxfEntityToEntityModel,
  HIT_TEST_MODEL_SUPPORTED_TYPES,
} from '../hit-test-entity-model';
import { TO_ENTITY_MODEL_SUPPORTED_TYPES } from '../../canvas-v2/dxf-canvas/dxf-renderer-entity-model';
import { RENDERABLE_ENTITY_TYPES } from '../../rendering/contract/renderable-entity-type';
import { BoundsCalculator } from '../../rendering/hitTesting/Bounds';
import { makeSceneEntity } from '../../rendering/hitTesting/__tests__/renderable-entity-fixtures';
import { HIT_TEST_MODEL_DXF_HANDLERS } from '../hit-test-model-dxf';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();
const supportedSet = new Set<string>(HIT_TEST_MODEL_SUPPORTED_TYPES);

describe('hit-test entity-model coverage — ζωντανό seam ↔ DxfEntityUnion (ADR-587 Φ10)', () => {
  it('domain equality: τα κλειδιά του μητρώου == το DxfEntityUnion variant set', () => {
    // Τα δύο seams (render entity-model / hit-test entity-model) μοιράζονται ΤΟ ΙΔΙΟ domain.
    // Απόκλιση ⇒ variant που μπαίνει στη σκηνή χωρίς hit-test converter (= άκλικο entity).
    expect(asSorted(HIT_TEST_MODEL_SUPPORTED_TYPES)).toEqual(
      asSorted([...TO_ENTITY_MODEL_SUPPORTED_TYPES]),
    );
  });

  it('renderable τύποι ΧΩΡΙΣ handler = ρητό off-path set (νόμιμες απουσίες, ΟΧΙ κενά)', () => {
    const noHandler = RENDERABLE_ENTITY_TYPES.filter((t) => !supportedSet.has(t));
    expect(asSorted(noHandler)).toEqual(
      asSorted([
        // Δεν είναι `DxfEntityUnion` variants — αποδίδονται από το raw-DXF render path και
        // δεν φτάνουν ΠΟΤΕ σε αυτόν τον converter (ίδιο off-path set με το toDxf seam).
        'ellipse', 'spline', 'point', 'rect',
        // Κανονικοποιούνται upstream στο `convertEntity` (lwpolyline→polyline, rectangle→
        // polyline, mtext→text) → δεν φτάνουν ΠΟΤΕ ως variant αυτού του ονόματος.
        'lwpolyline', 'rectangle', 'mtext',
      ]),
    );
  });

  it('κάθε handler αντιστοιχεί σε renderable τύπο (κανένα ορφανό variant)', () => {
    const renderable = new Set<string>(RENDERABLE_ENTITY_TYPES);
    expect(HIT_TEST_MODEL_SUPPORTED_TYPES.filter((t) => !renderable.has(t))).toEqual([]);
  });

  it.each(HIT_TEST_MODEL_SUPPORTED_TYPES)(
    'cross-seam pin: "%s" → convert → BoundsCalculator → κουτί ΜΕ ΕΚΤΑΣΗ (η γεωμετρία ΕΠΙΒΙΩΝΕΙ της μετατροπής)',
    (type) => {
      // Αυτή ΑΚΡΙΒΩΣ είναι η αλυσίδα που έσπαγε: ο converter ξεγύμνωνε τα πεδία και ο
      // calculator γύριζε null — δύο βήματα, μηδέν σήματα.
      const model = convertDxfEntityToEntityModel(makeSceneEntity(type));
      expect(model.type).toBe(type);
      const bounds = BoundsCalculator.calculateEntityBounds(model, 0);
      expect(bounds).not.toBeNull();
      // 🔴 ΕΚΤΑΣΗ, ΟΧΙ ΥΠΑΡΞΗ (ADR-833, 2026-09-07) — το «non-null» από μόνο του ήταν
      // **πράσινο πάνω σε ζωντανό σφάλμα**: ο πίνακας έφτανε εδώ ξεγυμνωμένος από τα φύλλα
      // του, και το `calculateTableBounds` επιστρέφει — επίτηδες — εκφυλισμένο κουτί στην
      // άγκυρα αντί για `null` (οντότητα χωρίς κελιά οφείλει να παραμένει επιλέξιμη). Η
      // νόμιμη ανοχή του ενός στρώματος έκρυβε την απώλεια του άλλου. Κάθε δείγμα εδώ έχει
      // πραγματικές διαστάσεις, άρα **κουτί χωρίς έκταση = πεδία που χάθηκαν στη μετατροπή**.
      expect(bounds!.width).toBeGreaterThan(0);
      expect(bounds!.height).toBeGreaterThan(0);
    },
  );

  it.each(['railing', 'wall-covering'] as const)(
    'Φ10 gap fix: το "%s" κρατά το geometry του (έπεφτε στο default → ξεγυμνωνόταν → άκλικο)',
    (type) => {
      const model = convertDxfEntityToEntityModel(makeSceneEntity(type)) as unknown as {
        geometry?: { bbox?: unknown };
      };
      expect(model.geometry?.bbox).toBeDefined();
    },
  );

  it('defensive guard: άγνωστος τύπος → warn + base model (ποτέ ξανά σιωπηλή απώλεια)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const rogue = { id: 'x', type: 'totally-unknown', visible: true } as unknown as DxfEntityUnion;
    const model = convertDxfEntityToEntityModel(rogue);
    expect(model.id).toBe('x');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});


/**
 * 🔴 **Η ΑΓΚΥΡΑ ΤΗΣ ΚΛΑΣΗΣ (2026-09-07)** — «η μετατροπή δεν επιτρέπεται να **ΑΛΛΑΞΕΙ** το κουτί».
 *
 * Τα παραπάνω ρωτούν *«βγήκε κουτί;»*. Δύο μετρημένα σφάλματα της **ίδιας μέρας** έδειξαν ότι η
 * ερώτηση είναι λάθος: και τα δύο έβγαζαν κουτί — απλώς **λάθος κουτί**, επειδή ο flat converter
 * κρατούσε χειρόγραφη λίστα πεδίων που είχε μείνει πίσω από το σχήμα του τύπου.
 *
 * ```
 *   πίνακας (ADR-833):  ζητούσε `model` αντί για `worksheets`  ⇒ 6000×1600 → 0×0 (σημείο)
 *   κείμενο (ADR-737):  δεν ζητούσε καθόλου `textNode`         ⇒ 30×25 → 3×2,5 (10×)
 * ```
 *
 * Η μόνη διατύπωση που πιάνει την κλάση αντί για τα δείγματά της: **το κουτί μέσα από το seam
 * είναι ΤΟ ΙΔΙΟ με το κουτί της ίδιας της οντότητας.** Ένα seam που ξεγυμνώνει πεδία δεν μπορεί
 * να την ικανοποιήσει, όσο «non-null» κι αν είναι το αποτέλεσμά του.
 */
describe('🔴 flat seam: η μετατροπή ΔΕΝ αλλάζει το κουτί (ADR-833 / ADR-737)', () => {
  /**
   * Οι **wrapped** τύποι — η γεωμετρία τους ζει μέσα σε `dimensionEntity`/`xlineEntity`/
   * `rayEntity`, οπότε η οντότητα σκηνής **δεν έχει** κουτί πριν το ξετύλιγμα (`null`). Ρητό
   * golden με αιτιολογία: η εξαίρεση είναι το ξετύλιγμα, ΟΧΙ άδεια να αλλάζει το κουτί.
   */
  const WRAPPED = ['dimension', 'xline', 'ray'] as const;
  const flatTypes = Object.keys(HIT_TEST_MODEL_DXF_HANDLERS)
    .filter((t) => !(WRAPPED as readonly string[]).includes(t));

  it.each(flatTypes)('"%s" — ίδιο κουτί πριν και μετά τη μετατροπή', (type) => {
    const scene = makeSceneEntity(type);
    const before = BoundsCalculator.calculateEntityBounds(scene as never, 0);
    const after = BoundsCalculator.calculateEntityBounds(convertDxfEntityToEntityModel(scene), 0);
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(after!.width).toBeCloseTo(before!.width, 9);
    expect(after!.height).toBeCloseTo(before!.height, 9);
    expect(after!.minX).toBeCloseTo(before!.minX, 9);
    expect(after!.minY).toBeCloseTo(before!.minY, 9);
  });

  it.each(WRAPPED)('"%s" — ΝΟΜΙΜΗ εξαίρεση: το κουτί υπάρχει μόνο ΜΕΤΑ το ξετύλιγμα', (type) => {
    const scene = makeSceneEntity(type);
    expect(BoundsCalculator.calculateEntityBounds(scene as never, 0)).toBeNull();
    expect(BoundsCalculator.calculateEntityBounds(convertDxfEntityToEntityModel(scene), 0))
      .not.toBeNull();
  });

  it('🔴 κείμενο με `textNode`: το ΖΩΝΤΑΝΟ ύψος ζει στο run, όχι στο flat πεδίο', () => {
    // Το δείγμα του `makeSceneEntity('text')` δεν έχει AST, άρα η ισότητα παραπάνω δεν θα είχε
    // πιάσει το σφάλμα: το flat `height` συμφωνούσε με τον εαυτό του. Εδώ τα δύο **διαφωνούν**
    // επίτηδες (run 25 vs flat 2,5) — ακριβώς το σχήμα ενός πολυ-run MTEXT.
    const withNode = {
      id: 'txt_ast', type: 'text', layerId: 'L', visible: true,
      position: { x: 0, y: 0 }, text: 'AB', height: 2.5, rotation: 0,
      textNode: { paragraphs: [{ runs: [{ text: 'AB', style: { height: 25 } }] }] },
    } as unknown as DxfEntityUnion;
    const before = BoundsCalculator.calculateEntityBounds(withNode as never, 0);
    const after = BoundsCalculator.calculateEntityBounds(
      convertDxfEntityToEntityModel(withNode), 0,
    );
    expect(before!.height).toBeCloseTo(25, 9);
    expect(after!.height).toBeCloseTo(before!.height, 9);
    expect(after!.width).toBeCloseTo(before!.width, 9);
  });
});

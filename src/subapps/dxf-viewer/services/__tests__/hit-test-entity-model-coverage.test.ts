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
 *  3. **Cross-seam behavioral pin** — scene entity → convert → `BoundsCalculator` → **non-null**.
 *     *Αυτό το ένα test θα είχε πιάσει και τα τρία bugs από μόνο του.*
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
    'cross-seam pin: "%s" → convert → BoundsCalculator → non-null (η γεωμετρία ΕΠΙΒΙΩΝΕΙ της μετατροπής)',
    (type) => {
      // Αυτή ΑΚΡΙΒΩΣ είναι η αλυσίδα που έσπαγε: ο converter ξεγύμνωνε τα πεδία και ο
      // calculator γύριζε null — δύο βήματα, μηδέν σήματα.
      const model = convertDxfEntityToEntityModel(makeSceneEntity(type));
      expect(model.type).toBe(type);
      expect(BoundsCalculator.calculateEntityBounds(model, 0)).not.toBeNull();
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

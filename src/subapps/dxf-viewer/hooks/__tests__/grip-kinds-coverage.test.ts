/**
 * Grip discriminator SSoT coverage (ADR-602 / ADR-587 Φ6, Stage 1).
 *
 * Δένει το δηλωτικό `GripKindByEntity` map + το runtime mirror `GRIP_KIND_ENTITIES`
 * + τον accessor `gripKindOf` στο grip-discriminator domain, ακριβώς όπως τα
 * `entity-descriptor-coverage.test.ts` / `resolve-contextual-trigger-coverage.test.ts`
 * δένουν τον descriptor με τα render/selection SSoT:
 *
 *  1. Compile-time bridge — `keyof GripKindByEntity` === `(typeof GRIP_KIND_ENTITIES)[number]`
 *     ΑΜΦΙΔΡΟΜΑ. Νέος entity type στο map χωρίς entry στο const (ή αντίστροφα) → σπάει
 *     το tsc εδώ (δεν φτάνει σιωπηλά στο runtime). Το `satisfies` στο const καλύπτει τη
 *     forward φορά· αυτό το test προσθέτει τη backward.
 *  2. Runtime completeness — 31 grip-producer entities, μηδέν διπλότυπα.
 *  3. Behavioral pin — `gripKindOf` επιστρέφει το kind ΜΟΝΟ στο σωστό `on` tag, αλλιώς
 *     `undefined` (mismatched tag ή απών `gripKind`). Καλύπτει και template-literal kind.
 *
 * ⚠️ Domain anchor = οι **31 grip-producer entities** (περιλαμβάνει editor-only `group`),
 * ΟΧΙ το `RENDERABLE_ENTITY_TYPES` (ADR-602 §1.1 / handoff). Το module που ελέγχεται είναι
 * ΚΑΘΑΡΟ (μόνο types + 1 const + 1 pure function) — μηδέν React/store.
 */

// Defensive: κάποιο transitive type-barrel μπορεί να αγγίξει firebase auth στο import path
// (ίδιος λόγος με το entity-descriptor-coverage.test.ts / resolve-contextual-trigger-coverage.test.ts).
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
  GRIP_KIND_ENTITIES,
  gripKindOf,
  type GripKindByEntity,
  type EntityGripKind,
} from '../grip-kinds';

// ── 1. Compile-time bridge (bidirectional) ───────────────────────────────────
// `[A] extends [B]` (tuple-wrapped → no union distribution) και οι δύο φορές: ίσα σετ.
type MapKey = keyof GripKindByEntity;
type ConstKey = (typeof GRIP_KIND_ENTITIES)[number];
type AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
// Αν αποκλίνουν, ο τύπος γίνεται `never` και το `true` δεν ανατίθεται → tsc error εδώ.
const _mapMirrorsConst: AssertEqual<MapKey, ConstKey> = true;

describe('ADR-602 grip discriminator SSoT — coverage', () => {
  it('compile-time: GRIP_KIND_ENTITIES ≡ keyof GripKindByEntity (bidirectional)', () => {
    expect(_mapMirrorsConst).toBe(true);
  });

  // ── 2. Runtime completeness ────────────────────────────────────────────────
  it('runtime: 32 grip-producer entities, μηδέν διπλότυπα', () => {
    expect(GRIP_KIND_ENTITIES).toHaveLength(32);
    expect(new Set(GRIP_KIND_ENTITIES).size).toBe(32);
  });

  it('runtime: περιλαμβάνει το editor-only `group` (domain ≠ RENDERABLE)', () => {
    expect(GRIP_KIND_ENTITIES).toContain('group');
  });

  // ── 3. Behavioral pin — `gripKindOf` ───────────────────────────────────────
  it('returns the kind ΜΟΝΟ όταν το `on` tag ταιριάζει', () => {
    const wallGrip: { readonly gripKind?: EntityGripKind } = {
      gripKind: { on: 'wall', kind: 'wall-start' },
    };
    expect(gripKindOf(wallGrip, 'wall')).toBe('wall-start');
    // mismatched tag → undefined (δεν κάνει leak σε λάθος entity)
    expect(gripKindOf(wallGrip, 'stair')).toBeUndefined();
  });

  it('returns undefined όταν λείπει το `gripKind`', () => {
    const bare: { readonly gripKind?: EntityGripKind } = {};
    expect(gripKindOf(bare, 'wall')).toBeUndefined();
  });

  it('καλύπτει template-literal kind (π.χ. slab-vertex-N)', () => {
    const slabGrip: { readonly gripKind?: EntityGripKind } = {
      gripKind: { on: 'slab', kind: 'slab-vertex-3' },
    };
    expect(gripKindOf(slabGrip, 'slab')).toBe('slab-vertex-3');
    expect(gripKindOf(slabGrip, 'roof')).toBeUndefined();
  });
});

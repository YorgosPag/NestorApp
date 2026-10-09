/**
 * ADR-909 Β2.1 — ΑΓΚΥΡΕΣ του προφίλ **«Δημόσια κάτοψη»**.
 *
 *   Π1  κάθε κατηγορία του `BIM_CATEGORIES` έχει απάντηση
 *   Π2  κάθε τύπος του `DXF_RENDERABLE_TYPES` έχει απάντηση
 *   Π3  κάθε τύπος του `BIM_RENDERABLE_TYPES` λύνεται — σε κατηγορία, ή στον πίνακα των πρωτογενών
 *   Π4  🏆 ΧΡΥΣΟ ΑΠΟΤΥΠΩΜΑ: αλλαγή πίνακα χωρίς άνοδο της `version` ⇒ κόκκινο
 *   Π5  ό,τι το προφίλ δείχνει ΔΕΝ το κρύβει η προεπιλογή του προτύπου όψης
 *   Φ1  διάσταση κρύβεται · τοίχος φαίνεται
 *   Φ2  επίπλωση: μόνο όταν ζητηθεί
 *   Φ3  άγνωστος τύπος ⇒ κρύβεται ΚΑΙ αναφέρεται (ποτέ σιωπηλή εικασία)
 *   Φ4  κρυφό στρώμα · `visible: false` ⇒ έξω, πριν κριθεί ο τύπος
 *   Φ5  η είσοδος δεν μεταλλάσσεται
 */

import { createHash } from 'node:crypto';

import {
  PUBLIC_FLOORPLAN_GROUPS,
  PUBLIC_FLOORPLAN_PROFILE,
  type PublicFloorplanGroup,
} from '@/lib/listings/floorplan-render-recipe';

import type { DxfEntityUnion, DxfScene } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { BIM_CATEGORIES, DEFAULT_OBJECT_STYLES } from '../../../config/bim-object-styles';
import {
  BIM_RENDERABLE_TYPES,
  DXF_RENDERABLE_TYPES,
} from '../../../rendering/contract/renderable-entity-type';
import { resolveEntityBimCategory } from '../../../bim/visibility/resolve-entity-bim-category';
import {
  PUBLIC_FLOORPLAN_CATEGORY_RULES,
  PUBLIC_FLOORPLAN_PRIMITIVE_RULES,
  applyPublicFloorplanProfile,
  publicFloorplanRuleOf,
} from '../public-floorplan-profile';

/**
 * 🔴 **ΑΝ ΑΥΤΟ ΚΟΚΚΙΝΙΣΕΙ, ΜΗΝ ΑΛΛΑΞΕΙΣ ΑΠΛΩΣ ΤΟ HASH.** Άλλαξες τι βλέπει το κοινό: ανέβασε τη `version` στο
 * `PUBLIC_FLOORPLAN_PROFILE` (`lib/listings/floorplan-render-recipe.ts`) και πρόσθεσε εδώ **νέα** γραμμή. Οι
 * ήδη δημοσιευμένες κατόψεις θα σημανθούν μπαγιάτικες από τον μηχανισμό παλαιότητας — αυτό **είναι** το ζητούμενο.
 */
const DIGEST_BY_VERSION: Readonly<Record<number, string>> = {
  1: '545b5afe67fd1691e515804da0b2a2735b832f7a54a6fe69a705b5868a351f6e',
  // Β2.8 — η «επίπλωση» γενικεύτηκε σε επτά προαιρετικές ομάδες (Η/Μ, κείμενα, γραμμοσκιάσεις, Βορράς).
  2: '886d829c7082363f56ca847acb948ac7cb267481c2d42dc81f98eed2f3d46c29',
};

/** Σύγκριση κωδικών χαρακτήρων, **όχι** `localeCompare`: το αποτύπωμα οφείλει να βγαίνει ίδιο σε κάθε μηχάνημα. */
const sorted = (table: Readonly<Record<string, string>>): [string, string][] =>
  Object.entries(table).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

function profileDigest(): string {
  const canonical = JSON.stringify({
    categories: sorted(PUBLIC_FLOORPLAN_CATEGORY_RULES),
    primitives: sorted(PUBLIC_FLOORPLAN_PRIMITIVE_RULES),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/** Τύποι BIM που λύνονται σε κατηγορία από τα `params` τους — πάντα σε κάποια τιμή του `BimCategory`. */
const PARAMS_DRIVEN_TYPES: ReadonlySet<string> = new Set(['mep-fixture', 'mep-segment', 'mep-fitting', 'floorplan-symbol']);

const entity = (type: string, extra: Record<string, unknown> = {}): DxfEntityUnion =>
  ({ id: `e_${type}`, type, layerId: 'lyr_1', visible: true, ...extra }) as unknown as DxfEntityUnion;

const sceneOf = (entities: DxfEntityUnion[]): DxfScene =>
  ({ entities, layers: [], bounds: null }) as unknown as DxfScene;

const typesOf = (scene: DxfScene): string[] => scene.entities.map((e) => e.type);
const NEVER_HIDDEN = (): boolean => false;

/** Οι απαντήσεις που επιτρέπεται να δώσει ένας πίνακας: πάντα · ποτέ · μία γνωστή ομάδα. */
const ANSWERS: readonly string[] = ['show', 'hide', ...PUBLIC_FLOORPLAN_GROUPS];
const shown = (...groups: PublicFloorplanGroup[]) => ({ groups: new Set(groups) });
/** Ό,τι έδειχνε η έκδοση 1 χωρίς επίπλωση. */
const LISTING = shown('texts', 'hatches', 'orientation');

describe('Π — κανένα στοιχείο χωρίς απάντηση', () => {
  it('Π1 κάθε κατηγορία του BIM_CATEGORIES έχει απάντηση', () => {
    for (const category of BIM_CATEGORIES) {
      expect(ANSWERS).toContain(PUBLIC_FLOORPLAN_CATEGORY_RULES[category]);
    }
  });

  it('Π2 κάθε τύπος του DXF_RENDERABLE_TYPES έχει απάντηση', () => {
    for (const type of DXF_RENDERABLE_TYPES) {
      expect(ANSWERS).toContain(PUBLIC_FLOORPLAN_PRIMITIVE_RULES[type]);
    }
  });

  it('Π3 κάθε τύπος του BIM_RENDERABLE_TYPES λύνεται — σε κατηγορία ή στον πίνακα των πρωτογενών', () => {
    const unanswered = BIM_RENDERABLE_TYPES.filter((type) => {
      if (PARAMS_DRIVEN_TYPES.has(type)) return false;
      return resolveEntityBimCategory(entity(type)) === null && !Object.hasOwn(PUBLIC_FLOORPLAN_PRIMITIVE_RULES, type);
    });
    expect(unanswered).toStrictEqual([]);
  });

  it('Π4 🏆 το αποτύπωμα των πινάκων είναι δεμένο στην έκδοση του προφίλ', () => {
    expect(profileDigest()).toBe(DIGEST_BY_VERSION[PUBLIC_FLOORPLAN_PROFILE.version]);
  });

  it('Π6 κάθε ομάδα έχει τουλάχιστον ένα στοιχείο — κανένας διακόπτης που δεν ελέγχει τίποτα', () => {
    const used = new Set<string>([
      ...Object.values(PUBLIC_FLOORPLAN_CATEGORY_RULES),
      ...Object.values(PUBLIC_FLOORPLAN_PRIMITIVE_RULES),
    ]);
    expect(PUBLIC_FLOORPLAN_GROUPS.filter((group) => !used.has(group))).toStrictEqual([]);
  });

  it('Π7 διαστάσεις, σημειώσεις, ετικέτες και βοηθητικές γραμμές είναι «ποτέ» — όχι ομάδα που ανάβει', () => {
    expect(PUBLIC_FLOORPLAN_CATEGORY_RULES.dimension).toBe('hide');
    expect(PUBLIC_FLOORPLAN_CATEGORY_RULES.grip).toBe('hide');
    for (const type of ['dimension', 'angle-measurement', 'leader', 'opening-info-tag', 'table', 'xline', 'ray', 'point'] as const) {
      expect(PUBLIC_FLOORPLAN_PRIMITIVE_RULES[type]).toBe('hide');
    }
  });

  it('Π5 ό,τι το προφίλ δείχνει ΔΕΝ το κρύβει η προεπιλογή του προτύπου όψης', () => {
    const hiddenByDefault = BIM_CATEGORIES.filter(
      (category) => PUBLIC_FLOORPLAN_CATEGORY_RULES[category] !== 'hide' && DEFAULT_OBJECT_STYLES[category].visible === false,
    );
    expect(hiddenByDefault).toStrictEqual([]);
  });
});

describe('Φ — τι φεύγει στο κοινό', () => {
  it('Φ1 διάσταση κρύβεται · τοίχος και γραμμή φαίνονται', () => {
    const { scene, unruledTypes } = applyPublicFloorplanProfile(
      sceneOf([entity('wall'), entity('dimension'), entity('line'), entity('leader'), entity('beam')]),
      LISTING,
      NEVER_HIDDEN,
    );
    expect(typesOf(scene)).toStrictEqual(['wall', 'line']);
    expect(unruledTypes).toStrictEqual([]);
  });

  it('Φ2 επίπλωση: μόνο όταν ζητηθεί', () => {
    const input = sceneOf([entity('wall'), entity('furniture'), entity('imported-mesh')]);
    expect(typesOf(applyPublicFloorplanProfile(input, LISTING, NEVER_HIDDEN).scene)).toStrictEqual(['wall']);
    expect(typesOf(applyPublicFloorplanProfile(input, shown('furniture'), NEVER_HIDDEN).scene))
      .toStrictEqual(['wall', 'furniture', 'imported-mesh']);
  });

  it('Φ2β κάθε ομάδα ανάβει ΜΟΝΟ τα δικά της — και καμία δεν ανάβει ό,τι είναι «ποτέ»', () => {
    const input = sceneOf([
      entity('wall'), entity('text'), entity('hatch'), entity('scale-bar'), entity('furniture'), entity('dimension'),
    ]);
    const typesWith = (...groups: PublicFloorplanGroup[]) =>
      typesOf(applyPublicFloorplanProfile(input, shown(...groups), NEVER_HIDDEN).scene);

    expect(typesWith()).toStrictEqual(['wall']);
    expect(typesWith('texts')).toStrictEqual(['wall', 'text']);
    expect(typesWith('hatches')).toStrictEqual(['wall', 'hatch']);
    expect(typesWith('orientation')).toStrictEqual(['wall', 'scale-bar']);
    expect(typesWith(...PUBLIC_FLOORPLAN_GROUPS)).toStrictEqual(['wall', 'text', 'hatch', 'scale-bar', 'furniture']);
  });

  it('Φ6 τα πλήθη ανά ομάδα μετρούν το ΣΧΕΔΙΟ, όχι την επιλογή — και όχι ό,τι είναι σε κρυφό στρώμα', () => {
    const input = sceneOf([
      entity('wall'), entity('text'), entity('mtext'), entity('furniture'),
      entity('text', { id: 'hidden-text', layerId: 'lyr_hidden' }),
    ]);
    const hidden = (e: DxfEntityUnion): boolean => e.layerId === 'lyr_hidden';

    const off = applyPublicFloorplanProfile(input, shown(), hidden).groupCounts;
    const on = applyPublicFloorplanProfile(input, shown(...PUBLIC_FLOORPLAN_GROUPS), hidden).groupCounts;

    expect(off).toStrictEqual(on);
    expect(off).toMatchObject({ texts: 2, furniture: 1, hatches: 0, heating: 0 });
    expect(Object.keys(off).sort()).toStrictEqual([...PUBLIC_FLOORPLAN_GROUPS].sort());
  });

  it('Φ3 άγνωστος τύπος ⇒ κρύβεται ΚΑΙ αναφέρεται', () => {
    expect(publicFloorplanRuleOf(entity('hologram'))).toBeNull();
    const { scene, unruledTypes } = applyPublicFloorplanProfile(
      sceneOf([entity('wall'), entity('hologram'), entity('hologram'), entity('aura')]),
      shown(...PUBLIC_FLOORPLAN_GROUPS),
      NEVER_HIDDEN,
    );
    expect(typesOf(scene)).toStrictEqual(['wall']);
    expect(unruledTypes).toStrictEqual(['aura', 'hologram']);
  });

  it('Φ4 κρυφό στρώμα · `visible: false` ⇒ έξω, και ΔΕΝ μετρούν ως άγνωστοι τύποι', () => {
    const { scene, unruledTypes } = applyPublicFloorplanProfile(
      sceneOf([
        entity('wall'),
        entity('wall', { id: 'on-hidden-layer', layerId: 'lyr_hidden' }),
        entity('line', { visible: false }),
        entity('hologram', { layerId: 'lyr_hidden' }),
      ]),
      LISTING,
      (e) => e.layerId === 'lyr_hidden',
    );
    expect(scene.entities.map((e) => e.id)).toStrictEqual(['e_wall']);
    expect(unruledTypes).toStrictEqual([]);
  });

  it('Φ5 η είσοδος δεν μεταλλάσσεται', () => {
    const input = sceneOf([entity('wall'), entity('dimension')]);
    const { scene } = applyPublicFloorplanProfile(input, LISTING, NEVER_HIDDEN);
    expect(input.entities).toHaveLength(2);
    expect(scene).not.toBe(input);
  });
});

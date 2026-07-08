/**
 * Entity Descriptor Coverage (ADR-587 Φ1).
 *
 * Δένει το δηλωτικό `ENTITY_DESCRIPTORS` με τα ζωντανά SSoT ώστε να μην μπορεί να
 * αποκλίνει (mirror του `entity-render-coverage.test.ts`):
 *  1. Completeness — κάθε renderable type έχει descriptor με σωστό `type`.
 *  2. No-drift — `descriptor.render` ΕΙΝΑΙ το `ENTITY_RENDER_CONTRACTS[type]` (ίδια πηγή).
 *  3. Category consistency — `bim` ⟺ `BIM_RENDERABLE_TYPES`· `annotation` = δηλωμένο set
 *     (⊆ DXF list)· `dxf-primitive` = το υπόλοιπο.
 *  4. Pinned latent asymmetry — `isBimEntityType` ΔΕΝ περιλαμβάνει `stair` (γνωστό gap,
 *     ADR-587 §6). Καρφώνεται εδώ ώστε (α) να είναι ορατό, (β) οποιαδήποτε ΝΕΑ απόκλιση
 *     category↔isBimEntityType να σπάει το build. Δεν αλλάζει συμπεριφορά (Φ1).
 */

// Firebase auth mock — το `types/entities` barrel αγγίζει auth στο import path
// (ίδιος λόγος με το entity-render-coverage.test.ts).
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
  ANNOTATION_RENDERABLE_TYPES,
  ENTITY_DESCRIPTORS,
  descriptorOf,
  entityCategoryOf,
} from '../entity-type-descriptor';
import { ENTITY_RENDER_CONTRACTS } from '../entity-render-contract';
import {
  BIM_RENDERABLE_TYPES,
  DXF_RENDERABLE_TYPES,
  RENDERABLE_ENTITY_TYPES,
} from '../renderable-entity-type';
import { ENTITY_TYPE_MAPPING } from '../../../types/dxf-export.types';
import { DXF_WRAPPED_SUBENTITY_FIELD } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { isBimEntityType } from '../../../types/entities';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();

describe('Entity descriptor coverage — δηλωτικό ↔ ζωντανά SSoT (ADR-587 Φ1)', () => {
  describe('Completeness', () => {
    it('κάθε renderable type έχει descriptor με σωστό type', () => {
      const missing = RENDERABLE_ENTITY_TYPES.filter(
        (t) => descriptorOf(t)?.type !== t,
      );
      expect(missing).toEqual([]);
    });

    it('κανένα ξένο κλειδί στο μητρώο (no orphan)', () => {
      const canonical = new Set<string>(RENDERABLE_ENTITY_TYPES);
      const orphan = Object.keys(ENTITY_DESCRIPTORS).filter((t) => !canonical.has(t));
      expect(orphan).toEqual([]);
    });
  });

  describe('No-drift — render contract είναι η ΙΔΙΑ πηγή', () => {
    it('descriptor.render === ENTITY_RENDER_CONTRACTS[type] (μηδέν αντίγραφο)', () => {
      const drift = RENDERABLE_ENTITY_TYPES.filter(
        (t) => descriptorOf(t).render !== ENTITY_RENDER_CONTRACTS[t],
      );
      expect(drift).toEqual([]);
    });
  });

  describe('Category consistency', () => {
    it('category:"bim" ⟺ μέλος των BIM_RENDERABLE_TYPES', () => {
      const bimSet = new Set<string>(BIM_RENDERABLE_TYPES);
      const wrong = RENDERABLE_ENTITY_TYPES.filter(
        (t) => (descriptorOf(t).category === 'bim') !== bimSet.has(t),
      );
      expect(wrong).toEqual([]);
    });

    it('category:"annotation" ταυτίζεται με το δηλωμένο ANNOTATION_RENDERABLE_TYPES', () => {
      const annotation = RENDERABLE_ENTITY_TYPES.filter(
        (t) => descriptorOf(t).category === 'annotation',
      );
      expect(asSorted(annotation)).toEqual(asSorted(ANNOTATION_RENDERABLE_TYPES));
    });

    it('τα annotation types ζουν στη λίστα DXF_RENDERABLE_TYPES (ρέουν ως primitives)', () => {
      const dxfSet = new Set<string>(DXF_RENDERABLE_TYPES);
      const outside = ANNOTATION_RENDERABLE_TYPES.filter((t) => !dxfSet.has(t));
      expect(outside).toEqual([]);
    });

    it('category:"dxf-primitive" = DXF_RENDERABLE_TYPES μείον τα annotation', () => {
      const annotationSet = new Set<string>(ANNOTATION_RENDERABLE_TYPES);
      const expected = DXF_RENDERABLE_TYPES.filter((t) => !annotationSet.has(t));
      const actual = RENDERABLE_ENTITY_TYPES.filter(
        (t) => descriptorOf(t).category === 'dxf-primitive',
      );
      expect(asSorted(actual)).toEqual(asSorted(expected));
    });

    it('entityCategoryOf συμφωνεί με το μητρώο (ίδιος resolver)', () => {
      const mismatch = RENDERABLE_ENTITY_TYPES.filter(
        (t) => entityCategoryOf(t) !== descriptorOf(t).category,
      );
      expect(mismatch).toEqual([]);
    });
  });

  describe('DXF export type — απορρόφηση ENTITY_TYPE_MAPPING (ADR-587 Φ2)', () => {
    it('descriptor.dxfExportType === ENTITY_TYPE_MAPPING[type] (μηδέν αντίγραφο, no-drift)', () => {
      const drift = RENDERABLE_ENTITY_TYPES.filter(
        (t) => descriptorOf(t).dxfExportType !== ENTITY_TYPE_MAPPING[t],
      );
      expect(drift).toEqual([]);
    });

    it('category:"bim" ⟹ dxfExportType === null (εξάγεται via composite, όχι native)', () => {
      const wrong = RENDERABLE_ENTITY_TYPES.filter(
        (t) => descriptorOf(t).category === 'bim' && descriptorOf(t).dxfExportType !== null,
      );
      expect(wrong).toEqual([]);
    });

    it('category:"annotation" ⟹ dxfExportType === null (paper decoration, composite export)', () => {
      const wrong = RENDERABLE_ENTITY_TYPES.filter(
        (t) => descriptorOf(t).category === 'annotation' && descriptorOf(t).dxfExportType !== null,
      );
      expect(wrong).toEqual([]);
    });
  });

  describe('DXF wrapped sub-entity field — απορρόφηση DXF_WRAPPED_SUBENTITY_FIELD (ADR-587 Φ2c)', () => {
    const wrappedByType = DXF_WRAPPED_SUBENTITY_FIELD as Partial<Record<string, string>>;

    it('descriptor.dxfWrappedField === DXF_WRAPPED_SUBENTITY_FIELD[type] (no-drift, undefined για direct)', () => {
      const drift = RENDERABLE_ENTITY_TYPES.filter(
        (t) => descriptorOf(t).dxfWrappedField !== wrappedByType[t],
      );
      expect(drift).toEqual([]);
    });

    it('τα types με dxfWrappedField ταυτίζονται ΑΚΡΙΒΩΣ με τα keys του SSoT map', () => {
      const declared = RENDERABLE_ENTITY_TYPES.filter(
        (t) => descriptorOf(t).dxfWrappedField !== undefined,
      );
      expect(asSorted(declared)).toEqual(asSorted(Object.keys(DXF_WRAPPED_SUBENTITY_FIELD)));
    });
  });

  describe('Pinned latent asymmetry — isBimEntityType stair-gap (ADR-587 §6)', () => {
    it('η ΜΟΝΗ απόκλιση category:"bim" ↔ isBimEntityType είναι το "stair" (γνωστό gap)', () => {
      const divergent = BIM_RENDERABLE_TYPES.filter((t) => !isBimEntityType(t));
      // Αν εμφανιστεί ΝΕΑ απόκλιση (πέρα από stair) → σπάει· υποδεικνύει ασυνέπεια
      // που πρέπει να διορθωθεί στη δική της φάση (ΟΧΙ σιωπηλά στη Φ1).
      expect(asSorted(divergent)).toEqual(['stair']);
    });
  });
});

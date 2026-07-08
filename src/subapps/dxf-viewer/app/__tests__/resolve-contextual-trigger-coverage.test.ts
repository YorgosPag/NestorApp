/**
 * Selection-side contextual-trigger coverage (ADR-587 Φ3a).
 *
 * Δένει το δηλωτικό `ENTITY_CONTEXTUAL_TRIGGER` map + τον `resolveContextualTrigger`
 * με τον descriptor domain (`RENDERABLE_ENTITY_TYPES`), ακριβώς όπως το
 * `entity-descriptor-coverage.test.ts` δένει τον descriptor με τα render SSoT:
 *
 *  1. Partition — κάθε renderable type ανήκει σε ΑΚΡΙΒΩΣ μία κατηγορία selection-tab
 *     συμπεριφοράς: {simple 1:1 map | kind-refined | style-editable | no-tab}. Νέος
 *     renderable type που ξεχάστηκε → σπάει εδώ (δεν φτάνει σιωπηλά στο runtime).
 *  2. No-drift — για κάθε simple type, `resolveContextualTrigger` επιστρέφει ΑΚΡΙΒΩΣ την
 *     τιμή του map (καμία shadow-branch).
 *  3. Golden pins — αντιπροσωπευτικά type→trigger δεμένα στις πραγματικές tab σταθερές.
 *  4. Kind-refined & style-editable & no-tab behavior — pin της ζωντανής resolution.
 *
 * Το module που ελέγχεται είναι ΚΑΘΑΡΟ (χωρίς React/zustand/stores) — γι' αυτό ακριβώς
 * εξήχθη από το `ribbon-contextual-config.ts` (ADR-587 Φ3a).
 */

// Defensive: κάποιο transitive type-barrel μπορεί να αγγίξει firebase auth στο import path
// (ίδιος λόγος με το entity-descriptor-coverage.test.ts).
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
  ENTITY_CONTEXTUAL_TRIGGER,
  resolveContextualTrigger,
} from '../resolve-contextual-trigger';
import { RENDERABLE_ENTITY_TYPES } from '../../rendering/contract/renderable-entity-type';
import { STYLE_EDITABLE_PRIMITIVE_TYPES } from '../../types/style-editable-primitives';
import { WALL_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-wall-tab';
import { HATCH_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-hatch-tab';
import { ANNOTATION_SYMBOL_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-annotation-symbol-tab';
import { TEXT_EDITOR_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-text-editor-tab';
import { LINE_TOOL_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-line-tool-tab';
import { MEP_FIXTURE_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-mep-fixture-tab';
import { MEP_FLOOR_DRAIN_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-mep-floor-drain-tab';
import { MEP_MANIFOLD_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-mep-manifold-tab';
import { DRAINAGE_COLLECTOR_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-drainage-collector-tab';
import {
  ARRAY_RECT_CONTEXTUAL_TRIGGER,
  ARRAY_POLAR_CONTEXTUAL_TRIGGER,
  ARRAY_PATH_CONTEXTUAL_TRIGGER,
} from '../../ui/ribbon/data/contextual-array-tab';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();

// ── Οι 4 κατηγορίες selection-tab συμπεριφοράς ────────────────────────────────
/** 1:1 map (SSoT· κάθε τύπος → ΕΝΑ trigger ανεξαρτήτως params). */
const SIMPLE_TYPES = Object.keys(ENTITY_CONTEXTUAL_TRIGGER);
/** Ένας τύπος → πολλά tabs μέσω `params.kind` — λύνονται ρητά ΠΡΙΝ το map lookup. */
const KIND_REFINED_TYPES = ['mep-fixture', 'mep-manifold'];
/** Generic γεωμετρικά primitives → κοινό Line-Tool tab (SSoT `STYLE_EDITABLE_PRIMITIVE_TYPES`). */
const STYLE_EDITABLE_RENDERABLE = RENDERABLE_ENTITY_TYPES.filter((t) =>
  STYLE_EDITABLE_PRIMITIVE_TYPES.has(t),
);
/** Renderable αλλά ΧΩΡΙΣ per-selection editor tab (point/xline/railing/furniture/…). */
const NO_SELECTION_TAB_TYPES = [
  'point',
  'angle-measurement',
  'xline',
  'ray',
  'railing',
  'space-separator',
  'furniture',
  'mep-fitting',
];

describe('Selection contextual-trigger coverage — map ↔ resolver ↔ descriptor domain (ADR-587 Φ3a)', () => {
  describe('Partition — κάθε renderable type σε ΑΚΡΙΒΩΣ μία κατηγορία', () => {
    it('οι 4 κατηγορίες καλύπτουν ΟΛΟΥΣ τους renderable types (union === domain)', () => {
      const union = [
        ...SIMPLE_TYPES,
        ...KIND_REFINED_TYPES,
        ...STYLE_EDITABLE_RENDERABLE,
        ...NO_SELECTION_TAB_TYPES,
      ];
      expect(asSorted(union)).toEqual(asSorted(RENDERABLE_ENTITY_TYPES));
    });

    it('οι 4 κατηγορίες είναι αμοιβαία ξένες (κανένας τύπος σε δύο)', () => {
      const union = [
        ...SIMPLE_TYPES,
        ...KIND_REFINED_TYPES,
        ...STYLE_EDITABLE_RENDERABLE,
        ...NO_SELECTION_TAB_TYPES,
      ];
      expect(union.length).toBe(new Set(union).size);
    });
  });

  describe('Map integrity — keys ⊆ descriptor domain, disjoint από kind-refined/style-editable', () => {
    it('κάθε key του map είναι έγκυρος RenderableEntityType', () => {
      const domain = new Set<string>(RENDERABLE_ENTITY_TYPES);
      const orphan = SIMPLE_TYPES.filter((t) => !domain.has(t));
      expect(orphan).toEqual([]);
    });

    it('κανένα map key δεν είναι kind-refined ή style-editable (καμία επικάλυψη)', () => {
      const styleEditable = new Set<string>(STYLE_EDITABLE_RENDERABLE);
      const kindRefined = new Set<string>(KIND_REFINED_TYPES);
      const overlap = SIMPLE_TYPES.filter((t) => styleEditable.has(t) || kindRefined.has(t));
      expect(overlap).toEqual([]);
    });
  });

  describe('No-drift — ο resolver επιστρέφει ΑΚΡΙΒΩΣ την τιμή του map για τα simple types', () => {
    it('resolveContextualTrigger({type}) === ENTITY_CONTEXTUAL_TRIGGER[type] (καμία shadow-branch)', () => {
      const drift = SIMPLE_TYPES.filter(
        (t) => resolveContextualTrigger({ type: t }) !== ENTITY_CONTEXTUAL_TRIGGER[t as never],
      );
      expect(drift).toEqual([]);
    });
  });

  describe('Style-editable primitives → κοινό Line-Tool tab', () => {
    it('κάθε style-editable renderable type → LINE_TOOL_CONTEXTUAL_TRIGGER', () => {
      const wrong = STYLE_EDITABLE_RENDERABLE.filter(
        (t) => resolveContextualTrigger({ type: t }) !== LINE_TOOL_CONTEXTUAL_TRIGGER,
      );
      expect(wrong).toEqual([]);
    });
  });

  describe('No-tab types → null (renderable αλλά χωρίς per-selection editor tab)', () => {
    it('κάθε no-tab renderable type επιστρέφει null στην επιλογή', () => {
      const wrong = NO_SELECTION_TAB_TYPES.filter(
        (t) => resolveContextualTrigger({ type: t }) !== null,
      );
      expect(wrong).toEqual([]);
    });
  });

  describe('Golden pins — type → πραγματική tab σταθερά', () => {
    it('αντιπροσωπευτικά simple mappings δεν αποκλίνουν από τα tab constants', () => {
      expect(resolveContextualTrigger({ type: 'wall' })).toBe(WALL_CONTEXTUAL_TRIGGER);
      expect(resolveContextualTrigger({ type: 'hatch' })).toBe(HATCH_CONTEXTUAL_TRIGGER);
      expect(resolveContextualTrigger({ type: 'annotation-symbol' })).toBe(
        ANNOTATION_SYMBOL_CONTEXTUAL_TRIGGER,
      );
      expect(resolveContextualTrigger({ type: 'text' })).toBe(TEXT_EDITOR_CONTEXTUAL_TRIGGER);
      expect(resolveContextualTrigger({ type: 'mtext' })).toBe(TEXT_EDITOR_CONTEXTUAL_TRIGGER);
    });
  });

  describe('Kind-refined resolution — params.kind sub-discriminator', () => {
    it('mep-fixture: default → «Φωτιστικό»· floor-drain → «Σιφώνι»', () => {
      expect(resolveContextualTrigger({ type: 'mep-fixture' })).toBe(
        MEP_FIXTURE_CONTEXTUAL_TRIGGER,
      );
      expect(
        resolveContextualTrigger({ type: 'mep-fixture', params: { kind: 'floor-drain' } }),
      ).toBe(MEP_FLOOR_DRAIN_CONTEXTUAL_TRIGGER);
    });

    it('mep-manifold: default → «Συλλέκτης»· drainage-collector → «Φρεάτιο»', () => {
      expect(resolveContextualTrigger({ type: 'mep-manifold' })).toBe(
        MEP_MANIFOLD_CONTEXTUAL_TRIGGER,
      );
      expect(
        resolveContextualTrigger({ type: 'mep-manifold', params: { kind: 'drainage-collector' } }),
      ).toBe(DRAINAGE_COLLECTOR_CONTEXTUAL_TRIGGER);
    });

    it('array: default rect · polar · path (editor-only, εκτός descriptor domain)', () => {
      expect(resolveContextualTrigger({ type: 'array' })).toBe(ARRAY_RECT_CONTEXTUAL_TRIGGER);
      expect(resolveContextualTrigger({ type: 'array', params: { kind: 'polar' } })).toBe(
        ARRAY_POLAR_CONTEXTUAL_TRIGGER,
      );
      expect(resolveContextualTrigger({ type: 'array', params: { kind: 'path' } })).toBe(
        ARRAY_PATH_CONTEXTUAL_TRIGGER,
      );
    });
  });
});

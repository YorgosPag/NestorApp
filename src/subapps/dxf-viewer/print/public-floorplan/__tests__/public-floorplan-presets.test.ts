/**
 * ADR-909 Β2.8 — ΑΓΚΥΡΕΣ της **επιλογής** και των **προτύπων** της δημόσιας κάτοψης.
 *
 *   Τ1  🏆 το πρότυπο «Αγγελία» δείχνει ΑΚΡΙΒΩΣ ό,τι έδειχνε η έκδοση 1 χωρίς επίπλωση — και το «Με επίπλωση» ό,τι με
 *   Τ2  κάθε πρότυπο είναι σε κανονική μορφή και αναγνωρίζεται πίσω από τις ομάδες του
 *   Τ3  ένας διακόπτης έξω από κάθε πρότυπο ⇒ «προσαρμοσμένο» (`null`)
 *   Τ4  ο διακόπτης ομάδας δεν μεταλλάσσει, δεν διπλασιάζει, και κρατά την κανονική σειρά
 *   Τ5  κάθε ομάδα ανήκει σε ΜΙΑ ενότητα, και οι ενότητες μαζί τις καλύπτουν όλες
 *   Τ6  το χρώμα ΔΕΝ είναι μέρος του προτύπου — αλλάζει την εικόνα, όχι το πρότυπο
 *   Τ7  το `by-pen` δεν προσφέρεται για δημόσια κάτοψη
 */

import { PUBLIC_FLOORPLAN_GROUPS, canonicalFloorplanGroups } from '@/lib/listings/floorplan-render-recipe';

import type { DxfEntityUnion, DxfScene } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { applyPublicFloorplanProfile } from '../public-floorplan-profile';
import {
  DEFAULT_PUBLIC_FLOORPLAN_CHOICE,
  PUBLIC_FLOORPLAN_PLOT_STYLES,
  PUBLIC_FLOORPLAN_PRESETS,
  PUBLIC_FLOORPLAN_PRESET_IDS,
  PUBLIC_FLOORPLAN_SECTIONS,
  publicFloorplanChoiceKey,
  publicFloorplanGroupsOf,
  publicFloorplanPresetOf,
  withFloorplanGroup,
} from '../public-floorplan-presets';

const entity = (type: string): DxfEntityUnion =>
  ({ id: `e_${type}`, type, layerId: 'lyr_1', visible: true }) as unknown as DxfEntityUnion;

/** Ένα από κάθε είδος που η έκδοση 1 έκρινε διαφορετικά: πάντα · επίπλωση · ποτέ. */
const V1_SAMPLE = ['wall', 'line', 'hatch', 'text', 'mtext', 'annotation-symbol', 'scale-bar', 'image',
  'furniture', 'imported-mesh', 'dimension', 'leader', 'beam'];
const V1_WITHOUT_FURNITURE = ['wall', 'line', 'hatch', 'text', 'mtext', 'annotation-symbol', 'scale-bar', 'image'];

function typesShownBy(preset: keyof typeof PUBLIC_FLOORPLAN_PRESETS): string[] {
  const scene = { entities: V1_SAMPLE.map(entity), layers: [], bounds: null } as unknown as DxfScene;
  const groups = new Set(PUBLIC_FLOORPLAN_PRESETS[preset]);
  return applyPublicFloorplanProfile(scene, { groups }, () => false).scene.entities.map((e) => e.type);
}

describe('Τ — πρότυπα και επιλογή', () => {
  it('Τ1 🏆 «Αγγελία» = η έκδοση 1 χωρίς επίπλωση · «Με επίπλωση» = η έκδοση 1 με', () => {
    expect(typesShownBy('listing')).toStrictEqual(V1_WITHOUT_FURNITURE);
    expect(typesShownBy('furnished')).toStrictEqual([...V1_WITHOUT_FURNITURE, 'furniture', 'imported-mesh']);
    expect(DEFAULT_PUBLIC_FLOORPLAN_CHOICE).toStrictEqual({
      groups: PUBLIC_FLOORPLAN_PRESETS.listing,
      plotStyle: 'monochrome',
    });
  });

  it('Τ2 κάθε πρότυπο είναι σε κανονική μορφή και αναγνωρίζεται πίσω από τις ομάδες του', () => {
    for (const id of PUBLIC_FLOORPLAN_PRESET_IDS) {
      const groups = PUBLIC_FLOORPLAN_PRESETS[id];
      expect(groups).toStrictEqual(canonicalFloorplanGroups(groups));
      expect(publicFloorplanPresetOf(groups)).toBe(id);
      expect(publicFloorplanPresetOf([...groups].reverse())).toBe(id);
    }
    expect(PUBLIC_FLOORPLAN_PRESETS.technical).toStrictEqual(PUBLIC_FLOORPLAN_GROUPS);
  });

  it('Τ3 ένας διακόπτης έξω από κάθε πρότυπο ⇒ «προσαρμοσμένο»', () => {
    const custom = withFloorplanGroup(DEFAULT_PUBLIC_FLOORPLAN_CHOICE, 'heating', true);
    expect(publicFloorplanPresetOf(custom.groups)).toBeNull();
    expect(publicFloorplanPresetOf([])).toBeNull();
  });

  it('Τ4 ο διακόπτης δεν μεταλλάσσει, δεν διπλασιάζει, και κρατά την κανονική σειρά', () => {
    const start = DEFAULT_PUBLIC_FLOORPLAN_CHOICE;
    const before = [...start.groups];

    const on = withFloorplanGroup(start, 'furniture', true);
    expect(on.groups).toStrictEqual(['furniture', 'texts', 'hatches', 'orientation']);
    expect(withFloorplanGroup(on, 'furniture', true).groups).toStrictEqual(on.groups);
    expect(withFloorplanGroup(on, 'furniture', false).groups).toStrictEqual(before);
    expect(start.groups).toStrictEqual(before);
    expect(on.plotStyle).toBe(start.plotStyle);
  });

  it('Τ5 κάθε ομάδα ανήκει σε ΜΙΑ ενότητα, και οι ενότητες μαζί τις καλύπτουν όλες', () => {
    const placed = PUBLIC_FLOORPLAN_SECTIONS.flatMap((section) => publicFloorplanGroupsOf(section));
    expect([...placed].sort()).toStrictEqual([...PUBLIC_FLOORPLAN_GROUPS].sort());
    expect(new Set(placed).size).toBe(placed.length);
    // 🔑 Και **ποια** πάει πού: Model / Annotation του Revit. Χωρίς αυτό, «Κείμενα» κάτω από «Κτίσμα και
    //    εξοπλισμός» περνούσε πράσινο (μετάλλαξη Γ6).
    expect(publicFloorplanGroupsOf('model')).toStrictEqual(['furniture', 'electrical', 'heating', 'plumbing']);
    expect(publicFloorplanGroupsOf('drawing')).toStrictEqual(['texts', 'hatches', 'orientation']);
  });

  it('Τ6 το χρώμα δεν είναι μέρος του προτύπου — αλλάζει την εικόνα, όχι το πρότυπο', () => {
    const colour = { ...DEFAULT_PUBLIC_FLOORPLAN_CHOICE, plotStyle: 'colour' as const };
    expect(publicFloorplanPresetOf(colour.groups)).toBe('listing');
    expect(publicFloorplanChoiceKey(colour)).not.toBe(publicFloorplanChoiceKey(DEFAULT_PUBLIC_FLOORPLAN_CHOICE));
    expect(publicFloorplanChoiceKey({ ...colour, groups: [...colour.groups].reverse() }))
      .toBe(publicFloorplanChoiceKey(colour));
  });

  it('Τ7 το `by-pen` δεν προσφέρεται για δημόσια κάτοψη', () => {
    expect(PUBLIC_FLOORPLAN_PLOT_STYLES).toStrictEqual(['monochrome', 'grayscale', 'colour']);
  });
});

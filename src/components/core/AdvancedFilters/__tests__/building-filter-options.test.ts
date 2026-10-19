/**
 * ADR-840 §7.6 — φίλτρα «Κτίρια»: επιλογές από τα ίδια τα κτίρια, κριτής πάνω σε `projectId`/`city`.
 * Περιστατικό 2026-10-19: ψεύτικα δείγματα (`project1/2/3`) + κριτής σε ανύπαρκτα πεδία ⇒ ωμά κλειδιά
 * στην οθόνη και κάθε επιλογή άδειαζε τη λίστα.
 */

import {
  buildBuildingFilterOptions,
  matchesBuildingLocation,
} from '../hooks/building-filter-options';
import { buildingFiltersConfig } from '../configs/buildingProjectFiltersConfig';
import { injectFilterOptions } from '../hooks/filter-option-injection';

const NAMES: Record<string, string> = { proj_a: 'ΕΡΓΟ Α', proj_b: 'Απολλωνία' };
const projectName = (id: string) => NAMES[id] ?? null;

const BUILDINGS = [
  { projectId: 'proj_a', city: '' },
  { projectId: 'proj_a', city: ' Αθήνα ' },
  { projectId: 'proj_b', city: 'Ιωάννινα' },
  { projectId: 'proj_x', city: 'Αθήνα' },
];

describe('buildBuildingFilterOptions', () => {
  const options = buildBuildingFilterOptions(BUILDINGS, projectName);

  it('έργα = ταυτότητες με όνομα (αλφαβητικά, αυτούσια)· άγνωστο όνομα στο τέλος, ποτέ ωμή ταυτότητα', () => {
    expect(options.get('project')).toEqual([
      { value: 'all', label: 'filters.allProjects' },
      { value: 'proj_b', label: 'Απολλωνία', verbatim: true },
      { value: 'proj_a', label: 'ΕΡΓΟ Α', verbatim: true },
      { value: 'proj_x', label: 'filters.unknownProject' },
    ]);
  });

  it('τοποθεσίες = οι πραγματικές πόλεις, μοναδικές, χωρίς κενά', () => {
    expect(options.get('location')).toEqual([
      { value: 'all', label: 'filters.allLocations' },
      { value: 'Αθήνα', label: 'Αθήνα', verbatim: true },
      { value: 'Ιωάννινα', label: 'Ιωάννινα', verbatim: true },
    ]);
  });

  it('ο πίνακας δεν κρατά πια δείγματα ούτε φίλτρο εταιρείας, και η έγχυση δεν τον μεταλλάσσει', () => {
    const injected = injectFilterOptions(buildingFiltersConfig, options);
    const fieldIds = buildingFiltersConfig.rows.flatMap(r => r.fields.map(f => f.id));
    expect(fieldIds).not.toContain('company');
    expect(JSON.stringify(buildingFiltersConfig)).not.toMatch(/sample/);
    const projectField = injected.rows.flatMap(r => r.fields).find(f => f.id === 'project');
    expect(projectField?.options).toHaveLength(4);
    const baseProject = buildingFiltersConfig.rows.flatMap(r => r.fields).find(f => f.id === 'project');
    expect(baseProject?.options).toHaveLength(1);
  });
});

describe('matchesBuildingLocation', () => {
  it('συγκρίνει projectId και (κομμένη) πόλη· all/κενό = χωρίς φίλτρο', () => {
    expect(matchesBuildingLocation(BUILDINGS[1], { project: 'proj_a', location: 'Αθήνα' })).toBe(true);
    expect(matchesBuildingLocation(BUILDINGS[1], { project: 'proj_b' })).toBe(false);
    expect(matchesBuildingLocation(BUILDINGS[0], { location: 'Αθήνα' })).toBe(false);
    expect(matchesBuildingLocation(BUILDINGS[0], { project: 'all', location: 'all' })).toBe(true);
    expect(matchesBuildingLocation(BUILDINGS[0], {})).toBe(true);
  });
});

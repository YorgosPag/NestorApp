/**
 * **ΑΓΚΥΡΕΣ: ΤΙ ΛΕΕΙ ΜΙΑ ΚΑΡΤΑ ΠΛΟΗΓΗΣΗΣ** (ADR-583/584 · CHECK 3.28 · N.11)
 *
 * ⚠️ Πριν από αυτό το αρχείο, τα `DesktopMultiColumn` (494 γρ.) και
 * `MobileNavigation` (274 γρ.) είχαν **ΜΗΔΕΝ** tests — επαληθευμένο με
 * `git ls-files`. Δηλαδή η αφαίρεση του διπλότυπου γινόταν **χωρίς δίχτυ**, και
 * κάθε απόκλιση που θα εισαγόταν θα φαινόταν μόνο σε ανθρώπινο μάτι στην οθόνη.
 *
 * 🔑 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ**: οι άγκυρες `Π` δεν ρωτούν «λύνεται το
 * κλειδί;» — ρωτούν **πρώτα** «θα αποτύγχανε ο παλιός δρόμος;». Χωρίς αυτό, ένα
 * πράσινο test θα μπορούσε να σημαίνει «δεν υπήρξε ποτέ βλάβη».
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  describeNavigationCompany,
  describeNavigationProject,
  describeNavigationBuilding,
  buildBuildingActionDescriptors,
  NAVIGATION_EMPTY_BADGE_STATUS,
  type NavigationTranslate,
} from '../navigation-item-descriptors';

// ────────────────────────────────────────────────────────────────────────────
// Εργαλεία
// ────────────────────────────────────────────────────────────────────────────

/**
 * Μεταφραστής-μάρτυρας: επιστρέφει **το ίδιο το κλειδί**, ώστε κάθε ισχυρισμός να
 * λέει «ποιο κλειδί ζητήθηκε», όχι «τι κείμενο βγήκε».
 *
 * ⚠️ `as unknown as` και **ποτέ `any`** (N.2): το `t` του i18next είναι βαριά
 * υπερφορτωμένο και μια χειρόγραφη υπογραφή θα ήταν δεύτερη αλήθεια.
 */
function witnessTranslate(): NavigationTranslate {
  return ((key: string, options?: Record<string, unknown>) =>
    options ? `${key}|${JSON.stringify(options)}` : key) as unknown as NavigationTranslate;
}

function readLocale(language: 'el' | 'en', namespace: string): Record<string, unknown> {
  const path = join(process.cwd(), 'src', 'i18n', 'locales', language, `${namespace}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function lookup(tree: Record<string, unknown>, dottedKey: string): unknown {
  return dottedKey
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      tree,
    );
}

/** Το πρόθεμα αφαιρείται για να ρωτηθεί το locale με το ωμό του κλειδί. */
function bareKey(prefixed: string): string {
  return prefixed.replace(/^navigation-entities:/, '');
}

const COMPANY = { companyName: 'Παγώνης ΑΕ', industry: 'Κατασκευαστική', vatNumber: '999999999' };

// ────────────────────────────────────────────────────────────────────────────
// Π — ΠΑΡΟΝΟΜΑΣΤΗΣ: η βλάβη ήταν πραγματική
// ────────────────────────────────────────────────────────────────────────────

describe('Π — ο παρονομαστής: γιατί χρειαζόταν το πρόθεμα namespace', () => {
  it('Π1 — τα κλειδιά των badge ΔΕΝ υπάρχουν στο `navigation`, το ns που ζητά το hook', () => {
    const navigation = readLocale('el', 'navigation');

    // Και τα δύο component καλούσαν `useTranslation('navigation')`. Αν το κλειδί
    // υπήρχε εδώ, το παλιό `t(key)` του Desktop θα δούλευε και δεν θα υπήρχε βλάβη.
    expect(lookup(navigation, 'filters.companies.withoutProjects')).toBeUndefined();
    expect(lookup(navigation, 'filters.projects.withoutBuildings')).toBeUndefined();
    expect(lookup(navigation, 'filters.buildings.withoutProperties')).toBeUndefined();
  });

  it('Π2 — δεν ορίζεται `fallbackNS`, άρα η αστοχία καταλήγει ΣΤΗΝ ΟΘΟΝΗ', () => {
    const config = readFileSync(join(process.cwd(), 'src', 'i18n', 'config.ts'), 'utf8');

    // Αν κάποια στιγμή προστεθεί `fallbackNS`, αυτή η άγκυρα πρέπει να ξαναγραφεί
    // ΜΑΖΙ με το σκεπτικό της — όχι να σβηστεί σιωπηλά.
    expect(config).not.toMatch(/^\s*fallbackNS\s*:/m);
  });

  it('Π3 — το παλιό κλειδί κτιρίου (`withoutUnits`) δεν υπήρχε σε ΚΑΝΕΝΑ locale', () => {
    for (const language of ['el', 'en'] as const) {
      const entities = readLocale(language, 'navigation-entities');
      expect(lookup(entities, 'filters.buildings.withoutUnits')).toBeUndefined();
      // …ενώ η ίδια έννοια υπήρχε, με άλλο όνομα:
      expect(typeof lookup(entities, 'filters.buildings.withoutProperties')).toBe('string');
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Λ — ΤΑ ΚΛΕΙΔΙΑ ΛΥΝΟΝΤΑΙ ΣΕ ΠΡΑΓΜΑΤΙΚΟ ΚΕΙΜΕΝΟ
// ────────────────────────────────────────────────────────────────────────────

describe('Λ — κάθε ετικέτα badge λύνεται, και στις δύο γλώσσες', () => {
  const asked = [
    describeNavigationCompany({
      company: COMPANY,
      hasProjects: false,
      isNavigationCompany: false,
      projectsLoading: false,
      t: witnessTranslate(),
    }).badgeText,
    describeNavigationProject({ project: { name: 'Έργο' }, buildingCount: 0, t: witnessTranslate() })
      .badgeText,
    describeNavigationBuilding({ building: { name: 'Κτίριο' }, propertyCount: 0, t: witnessTranslate() })
      .badgeText,
  ];

  it('Λ1 — και τα τρία ζητούνται ΜΕ ρητό πρόθεμα `navigation-entities:`', () => {
    expect(asked).toHaveLength(3);
    for (const key of asked) {
      expect(key).toMatch(/^navigation-entities:/);
    }
  });

  it('Λ2 — και τα τρία υπάρχουν ως ΚΕΙΜΕΝΟ σε el ΚΑΙ en (όχι απλώς «υπάρχουν»)', () => {
    for (const language of ['el', 'en'] as const) {
      const entities = readLocale(language, 'navigation-entities');
      for (const key of asked) {
        const value = lookup(entities, bareKey(key as string));
        expect(typeof value).toBe('string');
        expect((value as string).trim().length).toBeGreaterThan(0);
        // Η μετάφραση δεν επιτρέπεται να είναι το ίδιο το κλειδί.
        expect(value).not.toBe(bareKey(key as string));
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Κ — Η ΣΥΜΠΕΡΙΦΟΡΑ ΤΩΝ ΚΑΡΤΩΝ
// ────────────────────────────────────────────────────────────────────────────

describe('Κ — εταιρεία', () => {
  const t = witnessTranslate();

  it('Κ1 — ΜΕ έργα: υπότιτλος ο κλάδος, κανένα badge, κανένα ΑΦΜ', () => {
    const d = describeNavigationCompany({
      company: COMPANY,
      hasProjects: true,
      isNavigationCompany: false,
      projectsLoading: false,
      t,
    });

    expect(d.subtitle).toBe('Κατασκευαστική');
    expect(d.badgeStatus).toBeUndefined();
    expect(d.badgeText).toBeUndefined();
    expect(d.extraInfo).toBeUndefined();
  });

  it('Κ2 — χωρίς κλάδο πέφτει στον προεπιλεγμένο υπότιτλο', () => {
    const d = describeNavigationCompany({
      company: { ...COMPANY, industry: null },
      hasProjects: true,
      isNavigationCompany: false,
      projectsLoading: false,
      t,
    });

    expect(d.subtitle).toBe('columns.companies.defaultSubtitle');
  });

  it('Κ3 — ΧΩΡΙΣ έργα: badge + το ΑΦΜ επαναφέρει την ταυτότητα', () => {
    const d = describeNavigationCompany({
      company: COMPANY,
      hasProjects: false,
      isNavigationCompany: false,
      projectsLoading: false,
      t,
    });

    expect(d.subtitle).toBe('columns.companies.noProjects');
    expect(d.badgeStatus).toBe(NAVIGATION_EMPTY_BADGE_STATUS);
    expect(d.extraInfo).toContain('columns.companies.vatNumber');
    expect(d.extraInfo).toContain('999999999');
  });

  it('Κ4 — navigation company χωρίς έργα: ΠΡΟΤΡΟΠΗ, όχι διαπίστωση', () => {
    const d = describeNavigationCompany({
      company: COMPANY,
      hasProjects: false,
      isNavigationCompany: true,
      projectsLoading: false,
      t,
    });

    expect(d.subtitle).toBe('columns.companies.addProjects');
  });

  it('Κ5 — όσο φορτώνουν τα έργα, το badge ΣΙΩΠΑ (άγνωστο ≠ ψευδές)', () => {
    const d = describeNavigationCompany({
      company: COMPANY,
      hasProjects: false,
      isNavigationCompany: false,
      projectsLoading: true,
      t,
    });

    expect(d.badgeStatus).toBeUndefined();
    expect(d.badgeText).toBeUndefined();
    // …αλλά ο υπότιτλος και το ΑΦΜ παραμένουν: μόνο ο ισχυρισμός σιωπά.
    expect(d.subtitle).toBe('columns.companies.noProjects');
    expect(d.extraInfo).toContain('999999999');
  });

  it('Κ6 — χωρίς ΑΦΜ δεν εφευρίσκεται γραμμή', () => {
    const d = describeNavigationCompany({
      company: { ...COMPANY, vatNumber: null },
      hasProjects: false,
      isNavigationCompany: false,
      projectsLoading: false,
      t,
    });

    expect(d.extraInfo).toBeUndefined();
  });
});

describe('Κ — έργο και κτίριο', () => {
  const t = witnessTranslate();

  it('Κ7 — έργο με κτίρια: μέτρηση στον υπότιτλο, κανένα badge', () => {
    const d = describeNavigationProject({ project: { name: 'Έργο Α' }, buildingCount: 3, t });

    expect(d.title).toBe('Έργο Α');
    expect(d.subtitle).toContain('columns.projects.buildingCount');
    expect(d.subtitle).toContain('3');
    expect(d.badgeStatus).toBeUndefined();
  });

  it('Κ8 — έργο χωρίς κτίρια: badge', () => {
    const d = describeNavigationProject({ project: { name: 'Έργο Α' }, buildingCount: 0, t });
    expect(d.badgeStatus).toBe(NAVIGATION_EMPTY_BADGE_STATUS);
  });

  it('Κ9 — κτίριο χωρίς ακίνητα: badge· με ακίνητα: κανένα', () => {
    const empty = describeNavigationBuilding({ building: { name: 'Κ1' }, propertyCount: 0, t });
    const full = describeNavigationBuilding({ building: { name: 'Κ1' }, propertyCount: 7, t });

    expect(empty.badgeStatus).toBe(NAVIGATION_EMPTY_BADGE_STATUS);
    expect(full.badgeStatus).toBeUndefined();
    expect(full.subtitle).toContain('7');
  });
});

describe('Κ — ενέργειες κτιρίου', () => {
  const t = witnessTranslate();
  const building = { code: 'Β-01', name: 'Πολυκατοικία' };

  it('Κ10 — χωρίς επιλεγμένο έργο: ΔΥΟ ενέργειες, με σταθερή σειρά', () => {
    const actions = buildBuildingActionDescriptors({
      selectedBuilding: building,
      selectedProject: null,
      propertyCount: 4,
      t,
    });

    expect(actions.map(a => a.key)).toEqual(['properties', 'buildings']);
  });

  it('Κ11 — με επιλεγμένο έργο: ΤΡΕΙΣ, και το έργο έρχεται ΤΕΛΕΥΤΑΙΟ (στενό → ευρύ)', () => {
    const actions = buildBuildingActionDescriptors({
      selectedBuilding: building,
      selectedProject: { name: 'Έργο Α' },
      propertyCount: 4,
      t,
    });

    expect(actions.map(a => a.key)).toEqual(['properties', 'buildings', 'projects']);
    expect(actions[2].subtitle).toBe('Έργο Α');
  });

  it('Κ12 — η ετικέτα κτιρίου ενώνει κωδικό και όνομα (SSoT formatBuildingLabel)', () => {
    const [, buildingAction] = buildBuildingActionDescriptors({
      selectedBuilding: building,
      selectedProject: null,
      propertyCount: 0,
      t,
    });

    expect(buildingAction.subtitle).toBe('Β-01 — Πολυκατοικία');
  });

  it('Κ13 — το πλήθος ακινήτων φτάνει στον υπότιτλο της πρώτης ενέργειας', () => {
    const [properties] = buildBuildingActionDescriptors({
      selectedBuilding: building,
      selectedProject: null,
      propertyCount: 12,
      t,
    });

    expect(properties.subtitle).toContain('columns.actions.propertiesCount');
    expect(properties.subtitle).toContain('12');
  });
});

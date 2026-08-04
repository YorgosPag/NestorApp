/**
 * CHECK 3.36 — i18n namespace reachability: Jest suite (ADR-752).
 *
 * ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΓΕΝΝΗΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * -------------------------------------
 * Έξι namespaces (`textTemplates`, `textSpell`, `textFonts`, `textDraft`, `textAi`,
 * `dxf-viewer-dimensions`) είχαν: αρχεία locale σε **el και en**, καταχώριση στους
 * παραγόμενους τύπους, ~20 αρχεία καταναλωτές — και **κανένα `case` στο
 * `namespace-loaders.ts`**. Το `loadTranslations` έπεφτε στο `default: null`, κατέγραφε
 * **άδειο** bundle, και ο χρήστης έβλεπε `placeholders.drawing.title` μέσα σε έναν
 * «έλεγχο πληρότητας για κατάθεση» — ενώ η μετάφραση («Τίτλος Σχεδίου») ήταν στον δίσκο.
 *
 * Το βρήκε **άνθρωπος σε στιγμιότυπο οθόνης**. Καμία από τις 30+ CHECK δεν το είδε, γιατί
 * καμία δεν έκανε αυτή την ερώτηση: το 3.8 ρωτά «υπάρχει το κλειδί;», το 3.33 «είναι
 * φρέσκοι οι τύποι;». Και οι δύο απαντούσαν σωστά **ναι**.
 *
 * Η Ομάδα 4 είναι η μόνη που έχει σημασία αν ξεχάσεις τις υπόλοιπες: τρέχει πάνω στο
 * **πραγματικό** δέντρο και θα ήταν κόκκινη πριν τη διόρθωση.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SHARED = path.resolve(__dirname, '..', '_shared', 'i18n-governance.js');

const {
  parseConstArray,
  parseNamespaceLoaders,
  stripLineComments,
  getNamespacesForLocale,
  SUPPORTED_LOCALES,
  LOADER_FUNCTIONS,
} = require(SHARED);

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const REAL_LOADERS = path.join(PROJECT_ROOT, 'src', 'i18n', 'namespace-loaders.ts');

let TMP_ROOT;
let counter = 0;

beforeAll(() => {
  TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-reach-'));
});

afterAll(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

/** Γράφει ένα προσωρινό αρχείο και επιστρέφει τη διαδρομή του. */
function writeTemp(contents, extension = '.ts') {
  counter += 1;
  const filePath = path.join(TMP_ROOT, `fixture-${counter}${extension}`);
  fs.writeFileSync(filePath, contents, 'utf8');
  return filePath;
}

/** Ελάχιστο `namespace-loaders.ts` με τα `case` που του δίνεις ανά γλώσσα. */
function loadersFixture({ el = [], en = [] }) {
  const caseLine = (language) => (entry) => {
    const namespace = typeof entry === 'string' ? entry : entry.namespace;
    const target = typeof entry === 'string' ? `${language}/${entry}` : entry.target;
    return `    case '${namespace}': return () => import('./locales/${target}.json');`;
  };

  return [
    `function ${LOADER_FUNCTIONS.el}(namespace: Namespace): NamespaceLoader | null {`,
    '  switch (namespace) {',
    ...el.map(caseLine('el')),
    '    default: return null;',
    '  }',
    '}',
    '',
    `function ${LOADER_FUNCTIONS.en}(namespace: Namespace): NamespaceLoader | null {`,
    '  switch (namespace) {',
    ...en.map(caseLine('en')),
    '    default: return null;',
    '  }',
    '}',
    '',
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Ομάδα 1 — parseNamespaceLoaders: διαβάζει δηλώσεις, όχι κείμενο', () => {
  it('εξάγει τα case κάθε γλώσσας χωριστά', () => {
    const file = writeTemp(loadersFixture({ el: ['alpha', 'beta'], en: ['alpha'] }));
    const loaders = parseNamespaceLoaders(file);

    expect(loaders.el.map((entry) => entry.namespace)).toEqual(['alpha', 'beta']);
    expect(loaders.en.map((entry) => entry.namespace)).toEqual(['alpha']);
  });

  it('κρατά τον ΠΡΑΓΜΑΤΙΚΟ στόχο του import, όχι το όνομα του case', () => {
    // Αυτό είναι το χειρότερο σφάλμα των τριών: δεν δίνει ωμό κλειδί, δίνει **λάθος
    // κείμενο** — που μοιάζει σωστό. Χωρίς αυτή τη σύλληψη, ο έλεγχος θα κοίταζε μόνο
    // ονόματα και θα έβαφε πράσινο ένα loader που σερβίρει άλλο αρχείο.
    const file = writeTemp(
      loadersFixture({ el: [{ namespace: 'alpha', target: 'el/beta' }] }),
    );
    const [entry] = parseNamespaceLoaders(file).el;

    expect(entry).toEqual({ namespace: 'alpha', dir: 'el', file: 'beta' });
  });

  it('δεν μπερδεύει τις δύο γλώσσες όταν μοιράζονται ονόματα', () => {
    const file = writeTemp(
      loadersFixture({
        el: ['alpha'],
        en: [{ namespace: 'alpha', target: 'el/alpha' }],
      }),
    );
    const loaders = parseNamespaceLoaders(file);

    expect(loaders.el[0].dir).toBe('el');
    expect(loaders.en[0].dir).toBe('el'); // λάθος γλώσσα — το βλέπει ο validator
  });

  it('γυρίζει άδειους πίνακες όταν λείπει η συνάρτηση (δεν σκάει)', () => {
    const file = writeTemp('export const nothing = 1;\n');
    const loaders = parseNamespaceLoaders(file);

    expect(loaders.el).toEqual([]);
    expect(loaders.en).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Ομάδα 2 — stripLineComments: το σχόλιο δεν είναι δήλωση', () => {
  it('πετά σχόλιο που περιέχει παράδειγμα σε μονά εισαγωγικά', () => {
    expect(stripLineComments("  'alpha', // δες το t('ghost:key')")).toBe("  'alpha', ");
  });

  it('ΔΕΝ πετά // που ζει μέσα σε συμβολοσειρά', () => {
    expect(stripLineComments("  'https://example.test',")).toBe("  'https://example.test',");
  });

  it('αφήνει άθικτη γραμμή χωρίς σχόλιο', () => {
    expect(stripLineComments("  'alpha',")).toBe("  'alpha',");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Ομάδα 3 — parseConstArray: φάντασμα από σχόλιο (πραγματική παλινδρόμηση)', () => {
  // Αυτό ΔΕΝ είναι υποθετικό: γράφοντας τη διόρθωση του ADR-752 πρόσθεσα σχόλιο με
  // παράδειγμα κλειδιού σε μονά εισαγωγικά μέσα στο SUPPORTED_NAMESPACES, και ο
  // validator κοκκίνισε με «Extra: textTemplates:…» — namespace που δεν υπήρξε ποτέ.
  const withGhostComment = [
    'export const SUPPORTED_NAMESPACES = [',
    "  'alpha',",
    "  // ⚠️ κάθε t('ghost:key') ζωγράφιζε ωμό κλειδί",
    "  'beta',",
    '] as const;',
  ].join('\n');

  it('δεν μετρά κλειδί που ζει μέσα σε σχόλιο', () => {
    const file = writeTemp(withGhostComment);
    expect(parseConstArray(file, 'SUPPORTED_NAMESPACES')).toEqual(['alpha', 'beta']);
  });

  it('γυρίζει άδειο όταν η σταθερά δεν υπάρχει', () => {
    const file = writeTemp('export const OTHER = 1;\n');
    expect(parseConstArray(file, 'SUPPORTED_NAMESPACES')).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Ομάδα 4 — ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΔΕΝΤΡΟ: κάθε αρχείο locale είναι φορτώσιμο', () => {
  const loaders = parseNamespaceLoaders(REAL_LOADERS);

  SUPPORTED_LOCALES.forEach((locale) => {
    it(`[${locale}] κάθε αρχείο locale έχει case στο namespace-loaders.ts`, () => {
      const declared = new Set((loaders[locale] ?? []).map((entry) => entry.namespace));
      const orphanFiles = getNamespacesForLocale(locale).filter((ns) => !declared.has(ns));

      // Πριν το ADR-752 αυτό ήταν: dxf-viewer-dimensions, textAi, textDraft,
      // textFonts, textSpell, textTemplates — έξι άδεια bundles στην παραγωγή.
      expect(orphanFiles).toEqual([]);
    });

    it(`[${locale}] κάθε case δείχνει στο ομώνυμο αρχείο της ΙΔΙΑΣ γλώσσας`, () => {
      const wrong = (loaders[locale] ?? [])
        .filter((entry) => entry.dir !== locale || entry.file !== entry.namespace)
        .map((entry) => `${entry.namespace} → ${entry.dir}/${entry.file}`);

      expect(wrong).toEqual([]);
    });

    it(`[${locale}] κανένα case δεν δείχνει σε ανύπαρκτο αρχείο`, () => {
      const existing = new Set(getNamespacesForLocale(locale));
      const orphanCases = (loaders[locale] ?? [])
        .map((entry) => entry.namespace)
        .filter((ns) => !existing.has(ns));

      expect(orphanCases).toEqual([]);
    });
  });

  it('el και en δηλώνουν ΤΑ ΙΔΙΑ namespaces', () => {
    const el = new Set(loaders.el.map((entry) => entry.namespace));
    const en = new Set(loaders.en.map((entry) => entry.namespace));

    expect([...el].filter((ns) => !en.has(ns))).toEqual([]);
    expect([...en].filter((ns) => !el.has(ns))).toEqual([]);
  });

  it('τα έξι namespaces του ADR-752 είναι πλέον φορτώσιμα και στις δύο γλώσσες', () => {
    const regression = [
      'textTemplates',
      'textSpell',
      'textFonts',
      'textDraft',
      'textAi',
      'dxf-viewer-dimensions',
    ];

    SUPPORTED_LOCALES.forEach((locale) => {
      const declared = new Set((loaders[locale] ?? []).map((entry) => entry.namespace));
      regression.forEach((ns) => expect(declared.has(ns)).toBe(true));
    });
  });
});

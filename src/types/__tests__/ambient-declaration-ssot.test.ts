/**
 * ADR-719 — Ο φύλακας του SSoT των ambient declarations.
 *
 * ## Τι φυλάει και γιατί
 *
 * Το έργο έχει **δύο** TypeScript programs που επικαλύπτονται:
 *
 * - το **root** (`tsconfig.json`) κάνει `exclude` το `src/subapps/dxf-viewer/**`, αλλά
 *   τα αρχεία παραγωγής του subapp μπαίνουν παρ' όλα αυτά μέσω import-chain·
 * - το **subapp** (`src/subapps/dxf-viewer/tsconfig.json`) βλέπει μόνο τον δικό του
 *   φάκελο, αλλά τραβά αρχεία του `src/lib`/`src/services` μέσω import-chain.
 *
 * Οι ambient δηλώσεις (`declare module 'x'`) **δεν** ταξιδεύουν με το import-chain —
 * κανένα import δεν τις τραβά. Άρα κάθε πακέτο χωρίς επίσημους τύπους χρειάζεται ρητή
 * ορατότητα και στα δύο programs. Ιστορικά αυτό λύθηκε με **αντιγραφή** (4 πακέτα) και
 * αλλού **ξεχάστηκε** (5 πακέτα). Τα αντίγραφα απέκλιναν σιωπηλά — το subapp «έβλεπε»
 * `@google-cloud/storage` με `Bucket.file() → unknown` ενώ το root είχε τον πλήρη τύπο.
 *
 * Η λύση είναι μία δήλωση ανά πακέτο + δύο γέφυρες triple-slash reference. Αυτό το
 * αρχείο είναι ο λόγος που η λύση **παραμένει** λύση.
 *
 * ⚠️ Αν ένα από αυτά τα tests κοκκινίσει, **μην** χαλαρώσεις τον έλεγχο: πρόσθεσε τη
 * γραμμή reference που λείπει, ή σβήσε το αντίγραφο. Ο έλεγχος περιγράφει την υγεία
 * του build, δεν την επιβάλλει τεχνητά.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname, resolve, relative } from 'path';

/** Ρίζα του repo — δύο επίπεδα πάνω από το `src/types/__tests__`. */
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const SRC_ROOT = join(REPO_ROOT, 'src');
const SUBAPP_ROOT = join(SRC_ROOT, 'subapps', 'dxf-viewer');

const ROOT_BRIDGE = join(SRC_ROOT, 'types', 'dxf-viewer-ambient.d.ts');
const SUBAPP_BRIDGE = join(SUBAPP_ROOT, 'types', 'root-ambient.d.ts');

/** Φάκελοι εκτός και των δύο programs — παλιός/αντιγραμμένος κώδικας. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'archive',
  'patches',
  'test.BACK',
  '_canvas_LEGACY',
  'dxf-viewer-10-backup',
  'ai.back',
]);

interface SourceFile {
  readonly absPath: string;
  readonly relPath: string;
  readonly text: string;
}

/** Ένα πέρασμα του `src/`: διαβάζει κάθε πηγαίο αρχείο ακριβώς μία φορά. */
function collectSources(): SourceFile[] {
  const out: SourceFile[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name));
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const absPath = join(dir, entry.name);
      out.push({
        absPath,
        relPath: relative(REPO_ROOT, absPath).replace(/\\/g, '/'),
        text: readFileSync(absPath, 'utf8'),
      });
    }
  };

  walk(SRC_ROOT);
  return out;
}

const SOURCES = collectSources();
const DECLARATION_FILES = SOURCES.filter((f) => f.absPath.endsWith('.d.ts'));

/**
 * Ονόματα πακέτων που δηλώνει ένα `.d.ts`.
 *
 * Οι **σχετικές** δηλώσεις (`declare module './ui/...'`) εξαιρούνται σκόπιμα: δεν
 * αφορούν πακέτο, έχουν νόημα μόνο μέσα στο program που τις περιέχει, και δεν
 * μπορούν να συγκρουστούν μεταξύ programs.
 */
function declaredPackages(text: string): string[] {
  const names: string[] = [];
  const re = /^\s*declare\s+module\s+['"]([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!m[1].startsWith('.')) names.push(m[1]);
  }
  return names;
}

/** Οι διαδρομές των `/// <reference path="..." />` ενός αρχείου, ως absolute paths. */
function referencedPaths(file: SourceFile): string[] {
  const re = /\/\/\/\s*<reference\s+path=["']([^"']+)["']\s*\/>/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(file.text)) !== null) {
    out.push(resolve(dirname(file.absPath), m[1]));
  }
  return out;
}

const isSubappOwned = (f: SourceFile): boolean => f.absPath.startsWith(SUBAPP_ROOT);

/** Map: όνομα πακέτου → τα αρχεία που το δηλώνουν. */
const DECLARERS = new Map<string, SourceFile[]>();
for (const file of DECLARATION_FILES) {
  for (const pkg of declaredPackages(file.text)) {
    const list = DECLARERS.get(pkg) ?? [];
    list.push(file);
    DECLARERS.set(pkg, list);
  }
}

describe('ADR-719 — ambient declaration SSoT', () => {
  it('κάθε αρχείο-γέφυρα υπάρχει', () => {
    expect(existsSync(ROOT_BRIDGE)).toBe(true);
    expect(existsSync(SUBAPP_BRIDGE)).toBe(true);
  });

  it('βρήκε πραγματικές δηλώσεις (ο σαρωτής δεν είναι σιωπηλά άδειος)', () => {
    // Φρουρός του ίδιου του ελέγχου: αν αλλάξει η δομή φακέλων και ο walk δεν βρει
    // τίποτα, όλα τα υπόλοιπα tests θα περνούσαν κενά — «0» ως «κανείς δεν κοίταξε».
    expect(DECLARATION_FILES.length).toBeGreaterThan(5);
    expect(DECLARERS.size).toBeGreaterThan(5);
  });

  it('κανένα πακέτο δεν δηλώνεται σε δύο αρχεία', () => {
    const duplicates = [...DECLARERS.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([pkg, files]) => `${pkg} → ${files.map((f) => f.relPath).join(' + ')}`);

    // Δύο ambient declare module με το ίδιο όνομα συγκρούονται· και όταν ζουν σε
    // διαφορετικά programs, αποκλίνουν σιωπηλά. Η ορατότητα λύνεται με reference.
    expect(duplicates).toEqual([]);
  });

  it('κάθε reference path των γεφυρών δείχνει σε υπαρκτό αρχείο', () => {
    const bridges = SOURCES.filter(
      (f) => f.absPath === ROOT_BRIDGE || f.absPath === SUBAPP_BRIDGE,
    );
    expect(bridges).toHaveLength(2);

    const broken = bridges.flatMap((bridge) =>
      referencedPaths(bridge)
        .filter((target) => !existsSync(target))
        .map((target) => `${bridge.relPath} → ${relative(REPO_ROOT, target)}`),
    );
    expect(broken).toEqual([]);
  });

  it('οι γέφυρες δεν περιέχουν τύπους — είναι μόνο δείκτες', () => {
    const offenders = SOURCES.filter(
      (f) => f.absPath === ROOT_BRIDGE || f.absPath === SUBAPP_BRIDGE,
    )
      .filter((f) => /^\s*declare\s/m.test(f.text))
      .map((f) => f.relPath);

    // Τύπος μέσα σε γέφυρα = η αρχή της επόμενης αντιγραφής.
    expect(offenders).toEqual([]);
  });

  it('κάθε δήλωση του subapp είναι ορατή στο root program', () => {
    const bridged = new Set(
      referencedPaths(SOURCES.find((f) => f.absPath === ROOT_BRIDGE)!),
    );

    const unbridged = DECLARATION_FILES.filter(isSubappOwned)
      .filter((f) => declaredPackages(f.text).length > 0)
      .filter((f) => !bridged.has(f.absPath))
      .map((f) => f.relPath);

    // Το root program μεταγλωττίζει τα αρχεία παραγωγής του subapp (import-chain),
    // άρα χρειάζεται τις δηλώσεις τους — αλλιώς TS2307/TS7016.
    expect(unbridged).toEqual([]);
  });

  it('κάθε δήλωση του root με καταναλωτή στο subapp είναι ορατή στο subapp program', () => {
    const bridged = new Set(
      referencedPaths(SOURCES.find((f) => f.absPath === SUBAPP_BRIDGE)!),
    );

    const subappSources = SOURCES.filter((f) => isSubappOwned(f) && !f.absPath.endsWith('.d.ts'));
    const importsPackage = (pkg: string): boolean => {
      const re = new RegExp(`from ['"]${pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
      return subappSources.some((f) => re.test(f.text));
    };

    const missing = [...DECLARERS.entries()]
      .filter(([, files]) => files.length === 1 && !isSubappOwned(files[0]))
      .filter(([, files]) => !bridged.has(files[0].absPath))
      .filter(([pkg]) => importsPackage(pkg))
      .map(([pkg, files]) => `${pkg} (${files[0].relPath})`);

    // Το subapp program τραβά αρχεία του root μέσω import-chain αλλά όχι τις ambient
    // δηλώσεις τους· χωρίς γέφυρα, το πακέτο μένει άτυπο μέσα στο subapp.
    expect(missing).toEqual([]);
  });

  it('κανένα tsconfig δεν δείχνει σε ανύπαρκτο .d.ts', () => {
    // Υπάρχουν **τρία** επικαλυπτόμενα programs: root, subapp, και το IDE-scoped
    // `canvas-v2/tsconfig.json`. Το τρίτο απαριθμούσε ρητά `../../../types/utif.d.ts`,
    // δηλαδή κρατούσε **αντίγραφο της διαδρομής** ενός αρχείου που δεν όριζε το ίδιο.
    // Μετακίνηση της δήλωσης το έσπαγε σιωπηλά. Πλέον δείχνει στις γέφυρες, που
    // ενημερώνονται μόνες τους — και αυτός ο έλεγχος κρατά τον κανόνα.
    const tsconfigs: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name));
        } else if (/^tsconfig.*\.json$/.test(entry.name)) {
          tsconfigs.push(join(dir, entry.name));
        }
      }
    };
    walk(SRC_ROOT);
    expect(tsconfigs.length).toBeGreaterThan(0);

    const broken = tsconfigs.flatMap((cfgPath) => {
      const cfg: unknown = JSON.parse(readFileSync(cfgPath, 'utf8'));
      const include = (cfg as { include?: unknown }).include;
      if (!Array.isArray(include)) return [];
      return include
        .filter((e): e is string => typeof e === 'string')
        .filter((e) => e.endsWith('.d.ts') && !e.includes('*'))
        .filter((e) => !existsSync(resolve(dirname(cfgPath), e)))
        .map((e) => `${relative(REPO_ROOT, cfgPath).replace(/\\/g, '/')} → ${e}`);
    });

    expect(broken).toEqual([]);
  });

  it('δεν επανεμφανίστηκε bundle αρχείο πολλαπλών πακέτων στα types/ του subapp', () => {
    // Το `types/test-modules.d.ts` ήταν bundle: δεν γίνεται reference σε *μέρος*
    // αρχείου, οπότε το bundle **επέβαλλε** την αντιγραφή. Μία δήλωση ανά αρχείο
    // (ή μία οικογένεια ενός vendor) είναι δομική απαίτηση, όχι αισθητική.
    const vendorFamily = (pkg: string): string => pkg.split('/')[0].replace(/^@/, '');

    const bundles = DECLARATION_FILES.filter(isSubappOwned)
      .map((f) => ({ relPath: f.relPath, families: new Set(declaredPackages(f.text).map(vendorFamily)) }))
      .filter((f) => f.families.size > 1)
      .map((f) => `${f.relPath} → ${[...f.families].join(', ')}`);

    expect(bundles).toEqual([]);
  });
});

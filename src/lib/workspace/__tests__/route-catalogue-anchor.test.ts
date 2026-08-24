/**
 * ΑΓΚΥΡΑ — «συμφωνεί ο κριτής χώρου με τον **πραγματικό κατάλογο διαδρομών**;»
 *
 * ADR-787 §5.3 κ.4 — ο **φρουρός #4**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΤΟ ΑΠΟΔΕΙΚΝΥΕΙ ΤΙΠΟΤΑ ΑΛΛΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `isInsideWorkspace` κρίνει από **κλειστό σύνολο εξαιρέσεων**. Ένα τέτοιο
 * σύνολο έχει **δύο** τρόπους να είναι λάθος, και οι δύο είναι **σιωπηλοί**:
 *
 * | λάθος | συνέπεια |
 * |---|---|
 * | **περιττή** εγγραφή *(π.χ. `projects`)* | υπαρκτή σελίδα χώρου γίνεται **απροσπέλαστη** |
 * | **λείπει** εγγραφή *(π.χ. `login`)* | δημόσιος σύνδεσμος παίρνει πρόθεμα ⇒ **404** |
 *
 * Οι άγκυρες του ίδιου του συνόλου το συγκρίνουν με το δέντρο· **αυτή** κάνει το
 * αντίστροφο και το συμπληρωματικό: τρέχει τον **ζωντανό κριτή** πάνω σε **κάθε
 * πραγματική διαδρομή** και απαιτεί η ετυμηγορία να συμφωνεί με τη **θέση της
 * σελίδας στον δίσκο**. Δηλαδή: *«οι δύο μηχανές επιτρέπεται να υπάρχουν, δεν
 * επιτρέπεται να διαφωνήσουν»* (ADR-749).
 *
 * ⚠️ **ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ**: ο απαριθμητής είναι ο **υπάρχων** `enumerateRoutes`
 * του χρησμού SSR (CHECK 3.51). Δεύτερος απαριθμητής θα ήταν τρίτη αλήθεια.
 *
 * ⚠️ **Ο ΚΑΤΑΛΟΓΟΣ ΒΓΑΙΝΕΙ ΑΠΟ ΤΟΝ ΔΙΣΚΟ, ΟΧΙ ΑΠΟ ΤΟ `.next/`**: το
 * `routes.d.ts` είναι gitignored και **λείπει** σε καθαρό clone — άγκυρα που
 * εξαρτιόταν από αυτό θα ήταν πράσινη επειδή **δεν κοίταξε**. Το `src/app` είναι
 * η **ίδια** αυθεντία που διαβάζει το `next typegen`, και υπάρχει πάντα.
 */

import { OUTSIDE_WORKSPACE, isInsideWorkspace } from '../workspace-scope';
import { WORKSPACE_PATH_PREFIX } from '../workspace-path';

import path from 'path';
import fs from 'fs';

interface RouteRecord {
  readonly file: string;
  readonly url: string;
  readonly dynamic: boolean;
}

interface RouteOracle {
  readonly enumerateRoutes: (projectRoot: string, appDir?: string) => RouteRecord[];
  readonly SYNTHETIC_SEGMENT: string;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const oracle = require('scripts/lib/i18n-ssr/oracle') as RouteOracle;

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const APP_DIR = path.join(PROJECT_ROOT, 'src', 'app');

/**
 * ⚠️ **Τα catch-all ΔΕΝ είναι προορισμοί συνδέσμου** — είναι **δίχτυα**.
 * Το `(app)/[...unprefixed]` υπάρχει ακριβώς για να πιάνει διεύθυνση **χωρίς**
 * πρόθεμα και να την ανακατευθύνει· το να απαιτούσε η άγκυρα να «ανήκει σε
 * κόσμο» θα ήταν λάθος ερώτημα σε σωστό κώδικα. Το πλήθος τους **κλειδώνεται**
 * (`Δ4`), ώστε η εξαίρεση να μην μπορεί να μεγαλώσει σιωπηλά.
 */
const ALL_ROUTES: readonly RouteRecord[] = oracle.enumerateRoutes(PROJECT_ROOT);
const CATCH_ALL = ALL_ROUTES.filter((r) => r.file.includes('[...'));
const ROUTES: readonly RouteRecord[] = ALL_ROUTES.filter((r) => !r.file.includes('[...'));

/**
 * Τα **κορυφαία τμήματα** που όντως υπάρχουν στον δίσκο — από **φακέλους**, όχι
 * από σελίδες.
 *
 * 🔑 Ο παρονομαστής «μόνο σελίδες» είναι **αποδεδειγμένα λάθος**: το `api/`
 * κατέχει `route.ts` και **κανένα** `page.tsx`, άρα θα φαινόταν «ανύπαρκτο» και
 * η —απολύτως σωστή— εγγραφή του θα καταγγελλόταν ως περιττή. Ένα `/api/...`
 * που θα έπαιρνε πρόθεμα χώρου είναι **σπασμένη κλήση**, όχι σπασμένος σύνδεσμος.
 */
function topLevelSegments(): Set<string> {
  const segments = new Set<string>();
  for (const entry of fs.readdirSync(APP_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (/^\(.*\)$/.test(entry.name)) {
      // Route group: δεν εμφανίζεται στη διεύθυνση — κοίτα τα παιδιά του.
      for (const child of fs.readdirSync(path.join(APP_DIR, entry.name), { withFileTypes: true })) {
        if (child.isDirectory() && !/^\(.*\)$/.test(child.name)) segments.add(child.name);
      }
    } else {
      segments.add(entry.name);
    }
  }
  return segments;
}

/** `/o/<ψευδώνυμο>/projects/x` → `/projects/x`· ό,τι δεν φέρει πρόθεμα → `null`. */
function tailOf(url: string): string | null {
  const segments = url.split('/').filter(Boolean);
  if (segments[0] !== WORKSPACE_PATH_PREFIX) return null;
  const rest = segments.slice(2);
  return rest.length ? `/${rest.join('/')}` : '/';
}

/**
 * Ο ΚΡΙΤΗΣ ΤΗΣ ΑΓΚΥΡΑΣ, με τον κριτή **περασμένο ως όρισμα**.
 *
 * 🔑 Χωρίς τη ραφή ένεσης, οι μεταλλάξεις (`Μ`) θα ήταν αδύνατες: δεν μπορείς να
 * μεταλλάξεις ένα `Readonly` const από έξω. Με αυτήν, η ίδια ακριβώς λογική
 * ασκείται και με **σπασμένο** κριτή — που είναι ο μόνος τρόπος να αποδειχθεί
 * ότι η άγκυρα **μπορεί** να κοκκινίσει.
 */
function disagreements(judge: (href: string) => boolean): string[] {
  const found: string[] = [];
  for (const route of ROUTES) {
    const tail = tailOf(route.url);
    if (tail === null) {
      // Εκτός χώρου: ο κριτής ΔΕΝ πρέπει να θέλει να βάλει πρόθεμα.
      if (judge(route.url)) found.push(`${route.url} — εκτός χώρου, αλλά κρίθηκε ΕΝΤΟΣ`);
    } else {
      // Εντός χώρου: η διαδρομή ΧΩΡΙΣ πρόθεμα πρέπει να κρίνεται ΕΝΤΟΣ.
      if (!judge(tail)) found.push(`${route.url} — εντός χώρου, αλλά το «${tail}» κρίθηκε ΕΚΤΟΣ`);
    }
  }
  return found;
}

const INSIDE = ROUTES.filter((r) => tailOf(r.url) !== null);
const OUTSIDE = ROUTES.filter((r) => tailOf(r.url) === null);

/** Κάθε πηγαίο αρχείο του `src/`, χωρίς tests. Κοινό για τα `Σ2` και `Ν`. */
function sourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '__tests__') walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
        found.push(full);
      }
    }
  };
  walk(path.join(PROJECT_ROOT, 'src'));
  return found;
}

/**
 * Ο κατάλογος ως **κριτής διευθύνσεων**.
 *
 * 🔴 **ΤΟ ΔΙΧΤΥ ΕΞΑΙΡΕΙΤΑΙ, ΚΑΙ ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ Ο ΕΛΕΓΧΟΣ ΔΟΥΛΕΥΕΙ**: το
 * `[...unprefixed]` αντιστοιχεί σε `^/[^/]+$`, άρα **κάθε** μονοτμηματική
 * διεύθυνση θα φαινόταν υπαρκτή. Μετρημένο ζωντανά: με το δίχτυ μέσα, οι νεκροί
 * σύνδεσμοι ήταν **0**· χωρίς αυτό, **1** — και ήταν αληθινός. Ένα δίχτυ που
 * πιάνει τα λάθη σε **χρόνο εκτέλεσης** τα κρύβει από κάθε **στατικό** κριτή.
 */
const MATCHERS: readonly RegExp[] = ROUTES.map((route) => {
  const body = route.url
    .split('/')
    .filter(Boolean)
    .map((segment) =>
      segment === oracle.SYNTHETIC_SEGMENT
        ? '[^/]+'
        : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/');
  return new RegExp(`^/${body}$`);
});

/** Ανήκει σε **έναν από τους δύο κόσμους**; (καθολική ή —με πρόθεμα— χώρου) */
function resolves(target: string): boolean {
  const clean = target.split(/[?#]/)[0];
  return MATCHERS.some((m) => m.test(clean) || m.test(`/${WORKSPACE_PATH_PREFIX}/x${clean}`));
}

describe('Φρουρός #4 — ο κατάλογος διαδρομών και ο κριτής χώρου', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Δ — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ. Χωρίς αυτόν, ένα πράσινο «0 διαφωνίες» μπορεί να
  //     σημαίνει «δεν βρέθηκε καμία διαδρομή», δηλαδή «κανείς δεν κοίταξε».
  // ───────────────────────────────────────────────────────────────────────────
  test('Δ1 — ο κατάλογος ΔΕΝ είναι κενός', () => {
    expect(ROUTES.length).toBeGreaterThan(100);
  });

  test('Δ2 — και οι ΔΥΟ κόσμοι έχουν πληθυσμό', () => {
    expect(INSIDE.length).toBeGreaterThan(50);
    expect(OUTSIDE.length).toBeGreaterThan(10);
  });

  test('Δ3 — κλειστή λογιστική: κάθε διαδρομή σε ΑΚΡΙΒΩΣ μία κατηγορία', () => {
    expect(INSIDE.length + OUTSIDE.length + CATCH_ALL.length).toBe(ALL_ROUTES.length);
  });

  test('Δ4 — η εξαίρεση των catch-all είναι ΚΛΕΙΔΩΜΕΝΗ, όχι ανοιχτή πόρτα', () => {
    // Σήμερα ΕΝΑ δίχτυ: το `(app)/[...unprefixed]` (ADR-787 §5.3 λ). Αν
    // εμφανιστεί δεύτερο, θέλει ΑΠΟΦΑΣΗ — όχι σιωπηλή απορρόφηση.
    expect(CATCH_ALL.map((r) => r.file)).toEqual([
      'src/app/(app)/[...unprefixed]/page.tsx',
    ]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Κ — Η ΚΡΙΣΗ, σε ΚΑΘΕ πραγματική διαδρομή — όχι σε δείγμα.
  // ───────────────────────────────────────────────────────────────────────────
  test('Κ1 — ο ζωντανός κριτής συμφωνεί με τη θέση ΚΑΘΕ σελίδας στον δίσκο', () => {
    expect(disagreements(isInsideWorkspace)).toEqual([]);
  });

  test('Κ2 — καμία εγγραφή του κλειστού συνόλου δεν είναι ΠΕΡΙΤΤΗ', () => {
    // Μια εγγραφή που δεν αντιστοιχεί σε κανένα κορυφαίο τμήμα εκτός χώρου
    // είναι είτε λάθος είτε νεκρή — και τα δύο σιωπηλά.
    const live = topLevelSegments();
    live.add(WORKSPACE_PATH_PREFIX); // ο ίδιος ο δείκτης, by design

    const orphans = Object.keys(OUTSIDE_WORKSPACE).filter((key) => !live.has(key));
    expect(orphans).toEqual([]);
  });

  test('Κ3 — κάθε εγγραφή φέρει ΛΟΓΟ (δήλωση χωρίς λόγο = παράκαμψη με άλλο όνομα)', () => {
    const reasonless = Object.entries(OUTSIDE_WORKSPACE)
      .filter(([, why]) => typeof why !== 'string' || why.trim().length < 20)
      .map(([key]) => key);
    expect(reasonless).toEqual([]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Μ — ΜΕΤΑΛΛΑΞΕΙΣ. Αποδεικνύουν ότι το «0 διαφωνίες» του Κ1 είναι ετυμηγορία
  //     και όχι αδράνεια: με σπασμένο κριτή, η ΙΔΙΑ λογική ΠΡΕΠΕΙ να κοκκινίσει.
  // ───────────────────────────────────────────────────────────────────────────
  test('Μ1 — κριτής που λέει ΠΑΝΤΑ «εντός» ⇒ η άγκυρα κοκκινίζει', () => {
    expect(disagreements(() => true).length).toBeGreaterThan(0);
  });

  test('Μ2 — κριτής που λέει ΠΑΝΤΑ «εκτός» ⇒ η άγκυρα κοκκινίζει', () => {
    expect(disagreements(() => false).length).toBeGreaterThan(0);
  });

  test('Μ3 — ΠΕΡΙΤΤΗ εγγραφή («projects») ⇒ σελίδα χώρου γίνεται απροσπέλαστη', () => {
    const withSpurious = (href: string): boolean =>
      href.split('/').filter(Boolean)[0] === 'projects' ? false : isInsideWorkspace(href);
    const broken = disagreements(withSpurious);
    expect(broken.length).toBeGreaterThan(0);
    expect(broken.join('\n')).toContain('/projects');
  });

  test('Μ4 — εγγραφή ΠΟΥ ΛΕΙΠΕΙ («login») ⇒ δημόσιος σύνδεσμος παίρνει πρόθεμα', () => {
    const withMissing = (href: string): boolean =>
      href.split('/').filter(Boolean)[0] === 'login' ? true : isInsideWorkspace(href);
    const broken = disagreements(withMissing);
    expect(broken.length).toBeGreaterThan(0);
    expect(broken.join('\n')).toContain('/login');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Σ — ΔΟΜΙΚΑ. Αποδεικνύουν ΧΩΡΙΣ `tsc` (N.17) ότι η γέφυρα προς τον
  //     παραγόμενο κατάλογο είναι στη θέση της.
  // ───────────────────────────────────────────────────────────────────────────
  const SHIM = path.join(PROJECT_ROOT, 'src', 'types', 'app-routes.d.ts');

  test('Σ1 — η γέφυρα υπάρχει και δείχνει στον ΚΑΝΟΝΙΚΟ κατάλογο', () => {
    const shim = fs.readFileSync(SHIM, 'utf8');
    expect(shim).toContain("from '../../.next/types/routes'");
    expect(shim).toContain('AppRoutes');
    expect(shim).toContain('ParamMap');
  });

  test('Σ2 — ΤΟ ΑΣΧΗΜΟ ΜΟΝΟΠΑΤΙ ΖΕΙ ΜΟΝΟ ΕΚΕΙ (καμία δεύτερη γέφυρα)', () => {
    // Ένα δεύτερο `../.next/types/...` σε πηγαίο αρχείο θα ήταν δεύτερη
    // αυθεντία που σπάει σιωπηλά όταν αλλάξει το NEXT_DIST_DIR.
    // ⚠️ Το `sourceFiles()` παραλείπει τα `__tests__` — και ΠΡΕΠΕΙ: ΑΥΤΟ το αρχείο
    //    γράφει το μονοπάτι ως συμβολοσειρά (Σ1), οπότε χωρίς την παράλειψη η
    //    άγκυρα θα κατήγγελλε τον εαυτό της, δηλαδή θα κοκκίνιζε πάνω στην ίδια
    //    της την απόδειξη.
    const offenders: string[] = [];
    for (const full of sourceFiles()) {
      const text = fs.readFileSync(full, 'utf8');
      if (full === SHIM) continue; // η ΜΙΑ επιτρεπτή γέφυρα — αυτή είναι το νόημα
      if (/from\s+'[^']*\.next\/types\//.test(text)) offenders.push(path.relative(PROJECT_ROOT, full));
    }
    expect(offenders).toEqual([]);
  });

  test('Σ3 — το tsconfig ΒΑΖΕΙ τον κανονικό κατάλογο στο πρόγραμμα', () => {
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'tsconfig.json'), 'utf8'),
    ) as { include: string[]; exclude: string[] };
    expect(tsconfig.include).toContain('.next/types/**/*.ts');
    expect(tsconfig.include).toContain('src/**/*.d.ts');
    // Η αρχική αντίφαση του §5.3 κ (Ε1): το exclude έσβηνε ό,τι έβαζε το include.
    expect(tsconfig.exclude).not.toContain('.next');
  });

  test('Σ4 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο παραγόμενος κατάλογος όντως εξάγει ό,τι ζητά η γέφυρα', () => {
    const generated = path.join(PROJECT_ROOT, '.next', 'types', 'routes.d.ts');
    if (!fs.existsSync(generated)) {
      // Καθαρό clone χωρίς build. Το λέμε ΡΗΤΑ αντί να περάσουμε σιωπηλά:
      // «δεν κοίταξα» δεν είναι «καθαρό» (ADR-787 §5.3 κ).
      expect(fs.existsSync(path.join(PROJECT_ROOT, '.next'))).toBe(false);
      return;
    }
    const text = fs.readFileSync(generated, 'utf8');
    expect(text).toMatch(/export type \{[^}]*\bAppRoutes\b/);
    expect(text).toMatch(/export type \{[^}]*\bParamMap\b/);
    expect(text).toMatch(/type AppRoutes = "/);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Ν — ΟΔΗΓΕΙ ΚΑΠΟΥ ΚΑΘΕ ΣΥΝΔΕΣΜΟΣ; (ADR-787 §5.3 λ — η ερώτηση της άγκυρας A1)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * ⚠️ Δεν είναι διαδρομές σελίδων: route handlers και στατικά του `public/`.
   * Ένα `/api/...` που θα έπαιρνε πρόθεμα είναι **σπασμένη κλήση**, όχι σύνδεσμος.
   */
  const NOT_A_PAGE = /^\/(api|images|fonts|static|_next|\.well-known)\//;

  /**
   * **Κλειστό σύνολο**: κυριολεκτικοί προορισμοί που **δεν** αντιστοιχούν σε
   * σελίδα, με **υποχρεωτικό λόγο**. Ένας **νέος** μπλοκάρει.
   */
  const DECLARED_UNRESOLVED: Readonly<Record<string, string>> = {
    '/unauthorized':
      'ΣΕΛΙΔΑ ΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ ΣΕ ΚΑΝΕΝΑ GROUP (ADR-787 §5.3 λ). Σήμερα ανενεργό — κανείς δεν ' +
      'περνά `requiredRole` στο ProtectedRoute — και ΠΡΟΫΠΗΡΧΕ του 5ff0baa2, άρα ΔΕΝ το γέννησε ' +
      'η μετακίνηση. Η θεραπεία είναι ΑΠΟΦΑΣΗ ΤΟΜΕΑ (ποια οθόνη βλέπει ο μη εξουσιοδοτημένος;), ' +
      'όχι μηχανική — γι΄ αυτό δηλώνεται αντί να «διορθωθεί» με μια διεύθυνση της τύχης.',
  };

  /** Τα κυριολεκτικά σημεία πλοήγησης — `href="/…"` · `router.push/replace` · `redirect`. */
  function literalTargets(): Array<{ file: string; target: string }> {
    const patterns = [
      /href=["'](\/[^"'{}\s]*)["']/g,
      // ⚠️ ΑΠΑΙΤΕΙΤΑΙ ο δέκτης `router`: το σκέτο `.replace('/…')` είναι πράξη
      //    ΣΥΜΒΟΛΟΣΕΙΡΑΣ. Μετρημένο: 56 `router.` έναντι 8 (`current`·`href`·
      //    `pathname`·`path`) — χωρίς τον δέκτη, το `urlObj.pathname.replace('/+','')`
      //    γινόταν «νεκρός σύνδεσμος» (1 στα 2 ευρήματα = 50% ψευδώς θετικά).
      /\brouter\.(?:push|replace)\(\s*['"](\/[^'"]*)['"]/g,
      /\b(?:redirect|permanentRedirect)\(\s*['"](\/[^'"]*)['"]/g,
    ];
    const found: Array<{ file: string; target: string }> = [];
    for (const full of sourceFiles()) {
      const text = fs.readFileSync(full, 'utf8');
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
          const target = match[1];
          if (!NOT_A_PAGE.test(target)) {
            found.push({ file: path.relative(PROJECT_ROOT, full).replace(/\\/g, '/'), target });
          }
        }
      }
    }
    return found;
  }

  const TARGETS = literalTargets();

  test('Ν0 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο σαρωτής βρίσκει πραγματικό πληθυσμό', () => {
    expect(TARGETS.length).toBeGreaterThan(50);
  });

  test('Ν1 — κάθε κυριολεκτικός σύνδεσμος οδηγεί σε ΥΠΑΡΚΤΗ σελίδα', () => {
    const dead = TARGETS.filter(
      (t) => !resolves(t.target) && !(t.target.split(/[?#]/)[0] in DECLARED_UNRESOLVED),
    ).map((t) => `${t.target}  ←  ${t.file}`);
    expect(dead).toEqual([]);
  });

  test('Ν2 — καμία δήλωση δεν είναι ΟΡΦΑΝΗ (διορθώθηκε ⇒ σβήσε τη γραμμή)', () => {
    const live = new Set(TARGETS.map((t) => t.target.split(/[?#]/)[0]));
    const orphans = Object.keys(DECLARED_UNRESOLVED).filter((key) => !live.has(key));
    expect(orphans).toEqual([]);
  });

  test('Ν3 — κάθε δήλωση φέρει ΛΟΓΟ', () => {
    for (const [target, why] of Object.entries(DECLARED_UNRESOLVED)) {
      expect(`${target}: ${why}`.length).toBeGreaterThan(80);
    }
  });

  test('Ν4 — ΜΕΤΑΛΛΑΞΗ: ανύπαρκτος προορισμός ΠΡΕΠΕΙ να πιάνεται', () => {
    expect(resolves('/καμια-τετοια-σελιδα')).toBe(false);
    expect(resolves('/projects')).toBe(true); // παρονομαστής: εντός χώρου, χωρίς πρόθεμα
    expect(resolves('/login')).toBe(true); // παρονομαστής: καθολική
  });

  test('Ν5 — 🔴 ΤΟ ΔΙΧΤΥ ΤΥΦΛΩΝΕΙ ΤΟΝ ΕΛΕΓΧΟ, ΚΑΙ ΓΙ΄ ΑΥΤΟ ΕΞΑΙΡΕΙΤΑΙ', () => {
    // Με το `[...unprefixed]` ΜΕΣΑ στους κριτές, το `^/[^/]+$` κάνει ΚΑΘΕ
    // μονοτμηματική διεύθυνση «υπαρκτή» ⇒ ο έλεγχος βγάζει 0 και σημαίνει
    // «κανείς δεν κοίταξε». Μετρημένο ζωντανά: 0 με το δίχτυ, 1 χωρίς αυτό.
    //
    // ⚠️ Ο ΜΑΡΤΥΡΑΣ ΕΙΝΑΙ ΣΥΝΘΕΤΙΚΟΣ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ. Μέχρι τις 2026-08-24 ήταν
    // το `/unauthorized` — ΠΡΑΓΜΑΤΙΚΗ τότε βλάβη (η σελίδα ζει στο `(app)/unauthorized`
    // αλλά ο κριτής την έκρινε «εντός» ⇒ `/o/<ψευδώνυμο>/unauthorized` ⇒ 404 σε ΚΑΘΕ
    // άρνηση ρόλου). Μόλις δηλώθηκε εκτός χώρου, ο μάρτυρας ΘΕΡΑΠΕΥΤΗΚΕ και η άγκυρα
    // κοκκίνισε πάνω στη ΔΙΟΡΘΩΣΗ. Άγκυρα καρφωμένη σε υπαρκτό ελάττωμα πεθαίνει με τη
    // θεραπεία του· ο μάρτυρας οφείλει να είναι ΔΟΜΙΚΑ αθεράπευτος (σχήμα Κ7β/CHECK 3.50).
    const NEVER_A_PAGE = '/δεν-υπαρχει-τετοιο-τμημα';
    expect(CATCH_ALL.length).toBeGreaterThan(0);
    const withNet = new RegExp('^/[^/]+$');
    expect(withNet.test(NEVER_A_PAGE)).toBe(true); // μονοτμηματικό ⇒ το δίχτυ θα το έκρυβε
    expect(resolves(NEVER_A_PAGE)).toBe(false); // ο πραγματικός κριτής το βλέπει
  });
});

/**
 * ⚓ ADR-742 §7decies.2 — **η μνήμη δεν επιτρέπεται να παρακάμπτει τον μισθωτή**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΒΡΗΚΕ ΑΥΤΟ ΤΟ GATE (μετρημένο 2026-08-01)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η Ομάδα 5 ξεκίνησε ως μεταμφίεση επτά σημείων. Διαβάζοντας τη διαδρομή
 * `GET /api/conversations/{id}/messages` βρέθηκε κάτι **διαφορετικού είδους**:
 *
 * 1. ο έλεγχος ιδιοκτησίας γινόταν **ΜΕΤΑ** την ανάγνωση της μνήμης, και
 * 2. το κλειδί της μνήμης **δεν περιείχε μισθωτή**.
 *
 * ⇒ Δεύτερος χρήστης, **άλλης εταιρείας**, που ζητούσε το ίδιο `conversationId`
 * με τις ίδιες παραμέτρους σελίδας, έπαιρνε **CACHE HIT** — δηλαδή τα μηνύματα
 * της πρώτης εταιρείας — και **ο φύλακας δεν έτρεχε ποτέ**. Το ίδιο σχήμα στο
 * `GET /api/conversations` (λίστα): το **ερώτημα** ήταν σωστά tenant-scoped, η
 * **μνήμη** όχι, οπότε το φίλτρο ακυρωνόταν πριν καν εκτελεστεί.
 *
 * 🔴 **Διαρροή περιεχομένου, όχι ύπαρξης** — το ίδιο είδος με τη §7octies, και
 * αόρατο σε **κάθε** έλεγχο του ADR-742 μέχρι τώρα: όλοι ρωτούσαν «τι απαντά ο
 * φύλακας;», κανείς «**τρέχει** ο φύλακας;».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ANCHOR ΚΑΙ ΟΧΙ ΑΠΛΩΣ ΔΙΟΡΘΩΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η διόρθωση των δύο διαδρομών είναι δύο γραμμές. Αυτό που **δεν** διορθώνεται
 * με δύο γραμμές είναι η **επόμενη** διαδρομή που θα βάλει μνήμη: το λάθος δεν
 * φαίνεται σε κανένα unit test, γιατί κάθε διαδρομή είναι **εσωτερικά συνεπής**
 * — ακριβώς το επιχείρημα του §7septies, ένα στρώμα πιο κάτω.
 *
 * ⚠️ **Δηλωμένα τυφλά σημεία**: σαρώνεται **μόνο** το `src/app/api` (εκεί ζει
 * ο μηχανισμός `EnterpriseAPICache`)· ο έλεγχος είναι **κειμενικός** — κλειδί
 * που συντίθεται σε ξένο module με άλλο όνομα δεν φαίνεται· και δεν βλέπει
 * μνήμες άλλου είδους (Redis, `unstable_cache`). Το «0» εδώ σημαίνει «κανένα
 * **από αυτά** που ξέρω να κοιτάζω», όχι «καμία μνήμη δεν διαρρέει» (N.11/N.12).
 *
 * @module lib/auth/__tests__/tenant-cache-isolation-anchor
 * @see ADR-742 §7decies.2
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const API_ROOT = join(process.cwd(), 'src', 'app', 'api');
const SKIP_DIRS = new Set(['__tests__', '__mocks__', 'node_modules', '.next']);

function listSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name)) return [];
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listSources(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

const toRepoPath = (file: string): string =>
  file.slice(process.cwd().length + 1).split('\\').join('/');

const API_FILES = listSources(API_ROOT)
  .filter((file) => !/\.(test|spec)\.ts$/.test(file))
  .map((file) => ({ path: toRepoPath(file), source: readFileSync(file, 'utf8') }));

/** Κάθε ανάθεση σε μεταβλητή-κλειδί μνήμης, **ολόκληρη** (μπορεί να είναι πολυγραμμική). */
const CACHE_KEY_ASSIGNMENT = /const\s+\w*[cC]ache[kK]ey\w*\s*(?::\s*string\s*)?=\s*([\s\S]*?);\n/g;

/**
 * Τι μετράει ως **διακριτής μισθωτή** μέσα σε ένα κλειδί.
 *
 * Το `cacheSlot` είναι ο ονομασμένος διακριτής των έργων (Ομάδα 3,
 * `project-cache.ts`): κωδικοποιεί «εταιρεία **ή** ρητή θυρίδα υπεργραφέα»,
 * δηλαδή απαντά την ίδια ερώτηση με πιο αυστηρό τύπο.
 */
const TENANT_DISCRIMINATORS = /companyId|cacheSlot/;

const cacheKeyExpressions = (source: string): string[] => {
  const found: string[] = [];
  for (const match of source.matchAll(CACHE_KEY_ASSIGNMENT)) {
    if (match[1] !== undefined) found.push(match[1]);
  }
  return found;
};

describe('⚓ ADR-742 §7decies.2 — καμία μνήμη API δεν μοιράζεται θέση μεταξύ εταιρειών', () => {
  it('βρίσκει αρχεία να ελέγξει (φρουρά κατά σιωπηλά άδειας σάρωσης)', () => {
    expect(API_FILES.length).toBeGreaterThan(100);
    expect(API_FILES.some((f) => f.source.includes('EnterpriseAPICache'))).toBe(true);
  });

  /**
   * 🔴 Το κλειδί **είναι** το σύνορο απομόνωσης. Ένα σωστό `where(companyId)`
   * από κάτω δεν σημαίνει τίποτα αν η απάντηση σερβίρεται από θέση που
   * μοιράζονται δύο εταιρείες.
   */
  it('🔴 κάθε κλειδί μνήμης περιέχει διακριτή μισθωτή', () => {
    const offenders = API_FILES.flatMap((file) =>
      cacheKeyExpressions(file.source)
        .filter((expr) => !TENANT_DISCRIMINATORS.test(expr))
        .map((expr) => `${file.path} :: ${expr.replace(/\s+/g, ' ').slice(0, 90)}`),
    );

    expect(offenders).toEqual([]);
  });

  /**
   * 🔴 …και η **σειρά**: μνήμη που διαβάζεται πριν τον φύλακα σερβίρει χωρίς να
   * ρωτήσει. Το κλειδί με μισθωτή είναι η δεύτερη ζώνη, όχι η πρώτη
   * (belt-and-suspenders, N.7.2 #4) — από μόνο του δεν σταματά διαδρομή που
   * αύριο θα βάλει στο κλειδί κάτι που ο καλών ελέγχει.
   */
  it('🔴 όπου υπάρχει φύλακας ιδιοκτησίας ΚΑΙ μνήμη, ο φύλακας τρέχει ΠΡΩΤΟΣ', () => {
    const offenders = API_FILES.filter((file) => {
      const guard = file.source.search(/\bawait\s+loadOwned\w+\(/);
      const cacheRead = file.source.search(/\bcache\s*\.\s*get\s*</);
      return guard !== -1 && cacheRead !== -1 && cacheRead < guard;
    }).map((file) => file.path);

    expect(offenders).toEqual([]);
  });

  it('οι ανιχνευτές θα πυροδοτούσαν ακόμη — regex που δεν ταιριάζει τίποτα δεν αποδεικνύει τίποτα', () => {
    const leaky = "const cacheKey = `api:x:${conversationId}:p${page}`;\n";
    const scoped = "const cacheKey = `api:x:${ctx.companyId}:${conversationId}`;\n";
    const slotted = 'const tenantCacheKey = projectListCacheKey(scope.cacheSlot);\n';

    expect(cacheKeyExpressions(leaky).filter((e) => !TENANT_DISCRIMINATORS.test(e))).toHaveLength(1);
    expect(cacheKeyExpressions(scoped).filter((e) => !TENANT_DISCRIMINATORS.test(e))).toHaveLength(0);
    expect(cacheKeyExpressions(slotted).filter((e) => !TENANT_DISCRIMINATORS.test(e))).toHaveLength(0);

    // …και η πολυγραμμική μορφή (το `projects/bootstrap` τη γράφει έτσι).
    const multiline =
      'const cacheKey = scope.isAllTenants\n  ? `${CACHE_KEY}:admin`\n  : `${CACHE_KEY}:${scope.cacheSlot}`;\n';
    expect(cacheKeyExpressions(multiline)).toHaveLength(1);
    expect(cacheKeyExpressions(multiline).filter((e) => !TENANT_DISCRIMINATORS.test(e))).toHaveLength(0);
  });
});

/**
 * =============================================================================
 * ADR-744 §18 · CHECK 3.51 Χ — ΤΟ ROUTE SLICE ΑΝΗΚΕΙ ΣΤΗ ΔΙΑΔΡΟΜΗ, ΟΧΙ ΣΕ ΕΝΑΝ ΚΛΑΔΟ
 * =============================================================================
 *
 * 🔴 **Η ΚΛΑΣΗ, ΜΕΤΡΗΜΕΝΗ ΖΩΝΤΑΝΑ (2026-09-22, run `35715370312`)**: το
 * `/mandate/[token]` έστελνε από τον server το ωμό `mandate.consent.reason.*` —
 * ενώ το κλειδί **ΥΠΗΡΧΕ** μέσα στο `mandate__token.el.json`. Το slice το
 * καταχωρούσε ο **ένας** κλάδος (`MandateConsentContent`), σε εμβέλεια module.
 * Ένα client module εκτελείται στο SSR **μόνο αν αποδοθεί** — και όταν ο
 * σύνδεσμος απορρίπτεται αποδίδεται ο **άλλος** κλάδος (`MandateConsentRefusal`).
 * Άρα η καταχώρηση δεν έτρεχε ποτέ σε αυτό ακριβώς το μονοπάτι.
 *
 * 🔑 **ΓΙΑΤΙ ΚΑΝΕΝΑ ΑΛΛΟ ΟΡΓΑΝΟ ΔΕΝ ΤΟ ΒΛΕΠΕΙ**: ο γεννήτορας χτίζει το slice από
 * τη στατική κλειστότητα της **σελίδας** (που περιέχει **και τους δύο** κλάδους),
 * άρα το artifact είναι **πλήρες** και το CHECK 3.34 πράσινο. Το κενό δεν είναι
 * στα δεδομένα — είναι στο **ποιος τα εγκαθιστά**. Και ο χρησμός το πιάνει μόνο
 * όταν τύχει να ζωγραφίσει τον ορφανό κλάδο (εδώ: επειδή στο CI δεν υπάρχει βάση).
 *
 * 🏆 **ΚΑΝΟΝΑΣ**: σε σελίδα Server Component που αποδίδει ≥1 client κλάδο με
 * route slice, **κάθε** client κλάδος με `useTranslation` οφείλει να φέρνει το
 * **ΙΔΙΟ** slice — απευθείας ή μέσω του module καταχώρησης της διαδρομής (το ένα
 * σημείο, `*-route-slice.ts`). Σελίδα που καταχωρεί **η ίδια** (client page)
 * καλύπτει όλα της τα παιδιά και δεν ελέγχεται εδώ.
 *
 * ⚠️ **ΘΕΤΙΚΟ CONTROL ΠΡΩΤΑ**: ο παρονομαστής (πόσες σελίδες ΜΠΗΚΑΝ στον κανόνα)
 * κλειδώνεται ≥ 2, αλλιώς ένα «0 παραβάσεις» θα μπορούσε να σημαίνει «δεν βρήκα
 * καμία σελίδα να κοιτάξω» — το σχήμα «0 = κανείς δεν κοίταξε» (N.11/N.12/N.18).
 * =============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');
const APP = path.join(SRC, 'app');

const SLICE_IMPORT = /generated\/routes\/([^'"]+)\.el\.json/;
const IMPORT_SPEC = /import\s+(?:[^'"]*?\s+from\s+)?'([^']+)'/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(full, out);
    } else if (entry.name === 'page.tsx') {
      out.push(full);
    }
  }
  return out;
}

const cache = new Map<string, string>();
function read(file: string): string {
  const hit = cache.get(file);
  if (hit !== undefined) return hit;
  const text = fs.readFileSync(file, 'utf8');
  cache.set(file, text);
  return text;
}

/** `@/x` ή σχετικό specifier → αρχείο στον δίσκο, ή `null` (πακέτο / json). */
function resolveSpec(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  const candidates = [`${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function importsOf(file: string): string[] {
  return [...read(file).matchAll(IMPORT_SPEC)]
    .map((match) => resolveSpec(match[1], file))
    .filter((resolved): resolved is string => resolved !== null);
}

const isClient = (file: string): boolean => /^\s*['"]use client['"]/m.test(read(file).slice(0, 600));
const usesTranslation = (file: string): boolean => /\buseTranslation\(/.test(read(file));
const ownSlice = (file: string): string | null => read(file).match(SLICE_IMPORT)?.[1] ?? null;

/** Το slice που φέρνει ένα αρχείο: δικό του, ή ενός **άμεσα** εισαγόμενου module καταχώρησης. */
function sliceCarriedBy(file: string): string | null {
  return ownSlice(file) ?? importsOf(file).map(ownSlice).find((slice): slice is string => slice !== null) ?? null;
}

interface PageVerdict {
  readonly page: string;
  readonly slice: string;
  readonly orphans: readonly string[];
}

function judgePages(): PageVerdict[] {
  const verdicts: PageVerdict[] = [];
  for (const page of walk(APP)) {
    if (isClient(page) || ownSlice(page) !== null) continue;
    const branches = importsOf(page).filter((file) => isClient(file) && usesTranslation(file));
    const slices = [...new Set(branches.map(sliceCarriedBy).filter((slice): slice is string => slice !== null))];
    if (slices.length === 0) continue;
    const slice = slices.sort().join(' + ');
    const orphans = branches
      .filter((branch) => sliceCarriedBy(branch) !== slices[0] || slices.length > 1)
      .map((branch) => path.relative(ROOT, branch).replace(/\\/g, '/'));
    verdicts.push({ page: path.relative(ROOT, page).replace(/\\/g, '/'), slice, orphans });
  }
  return verdicts;
}

describe('ADR-744 §18 — το route slice ανήκει στη διαδρομή, όχι σε έναν κλάδο', () => {
  const verdicts = judgePages();

  it('Κ0 (θετικό control): ο κανόνας βρίσκει σελίδες να κοιτάξει', () => {
    const pages = verdicts.map((verdict) => verdict.page);
    expect(pages).toEqual(
      expect.arrayContaining(['src/app/(auth)/mandate/[token]/page.tsx', 'src/app/(me)/offers/mandate/new/page.tsx']),
    );
  });

  it('Κ1: κάθε client κλάδος σελίδας-server φέρνει το ΙΔΙΟ route slice', () => {
    const offenders = verdicts
      .filter((verdict) => verdict.orphans.length > 0)
      .map((verdict) => `${verdict.page} [${verdict.slice}] ⇒ ορφανοί: ${verdict.orphans.join(', ')}`);
    expect(offenders).toEqual([]);
  });
});

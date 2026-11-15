/**
 * @jest-environment node
 */
/**
 * ⚓ ADR-929 §6.21.5 — **ο χρυσός runner**: οι περιπτώσεις του χρυσού συνόλου (εκτός repo, `NESTOR_PLAN_GOLDEN_DIR`) με
 * αλήθεια `declared-dimensions` περνούν από την αλυσίδα της παραγωγής, και κάθε άνοιγμα διάστασης κρίνεται από το `checkSpans`.
 *
 * 🔑 **Ποτέ σιωπηλό πράσινο (Δ13.1).** Κάθε λόγος για τον οποίο δεν μετρήθηκε κάτι φαίνεται **στο όνομα** ενός test:
 *   - χωρίς μεταβλητή / φάκελο / μανιφέστο ⇒ ένα παραλειπόμενο test «SKIPPED: …»·
 *   - άκυρο μανιφέστο ⇒ **αποτυχία** «FAILED: …» με τα σφάλματα του σχήματος·
 *   - αρχείο περίπτωσης που λείπει ή άλλαξε (sha256) ⇒ **αποτυχία**: η αλήθεια δηλώθηκε για εκείνο το αρχείο·
 *   - περίπτωση με άλλο είδος αλήθειας ⇒ παραλειπόμενο test που λέει ποιο είδος, όχι εξαφάνιση.
 * 🔑 **Δύο αποδόσεις.** Η απόδοση του Node (pdf.js + `@napi-rs/canvas`) **και** κάθε καταγεγραμμένη απόδοση της παραγωγής
 *   για την ίδια πηγή (`captured-renderings.ts`): στο ΤΕΣΤ2 η 2.05 χανόταν **μόνο** στο Chrome (§6.21.3).
 * 🔑 **Τι σημαίνει «πέρασε».** Καμία δηλωμένη διάσταση χωρίς άνοιγμα, και **κάθε** άνοιγμα πάνω σε δηλωμένη διάσταση με το
 *   σωστό ζεύγος βοηθητικών. Έτσι πιάνεται και η βάση βέλους που γίνεται άγκυρα (§6.21.2): δίνει άνοιγμα 0,12 που δεν
 *   ταιριάζει σε καμία διάσταση.
 */

import { describe, expect, it } from '@jest/globals';
import type { Affine2x3 } from '@/lib/geometry/affine-2x3';
import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { capturedRenderingsOf, loadCapturedRendering } from '../testing/captured-renderings';
import type { GoldenDeclaredDimensions } from '../testing/golden-manifest-schema';
import { describeGoldenSetStatus, loadGoldenSet, type ResolvedGoldenCase } from '../testing/golden-set-loader';
import { checkDeclaredDimensions, renderGoldenPdfPage, runPlanChain, type GoldenPageImage } from '../testing/golden-plan-run';
import { grayToPlanRaster } from '../testing/gray-rle-raster';

/** Απόδοση + αλυσίδα σε σελίδα A4 ×2: ~20 s σε αδύναμο μηχάνημα. */
const CASE_TIMEOUT_MS = 180_000;

interface Rendering {
  readonly renderer: string;
  readonly image: () => Promise<{ readonly raster: PlanRaster; readonly userToPx: Affine2x3 | null }>;
}

/** Η απόδοση του Node, και μετά όσες καταγράφηκαν από την παραγωγή για την ίδια πηγή. */
function renderingsOf(c: ResolvedGoldenCase, page: () => Promise<GoldenPageImage>): readonly Rendering[] {
  const node: Rendering = { renderer: 'node-pdfjs', image: page };
  const captured = capturedRenderingsOf(c.files[0].ref.sha256).map((r): Rendering => ({
    renderer: r.renderer,
    image: async () => ({ raster: grayToPlanRaster(loadCapturedRendering(r)), userToPx: null }),
  }));
  return [node, ...captured];
}

/**
 * Μία απόδοση μιας περίπτωσης. Οι καταγεγραμμένες αποδόσεις δεν φέρουν πίνακα· είναι στο **ίδιο** πλέγμα με την απόδοση
 * του Node (ίδια κλίμακα, ίδιο μέγεθος — ελέγχεται), άρα χρησιμοποιούν τον δικό της.
 */
function measureCase(c: ResolvedGoldenCase, truth: GoldenDeclaredDimensions): void {
  let rendered: Promise<GoldenPageImage> | null = null;
  const page = () => (rendered ??= renderGoldenPdfPage(c.files[0].absPath, c.case.source.page)); // μία απόδοση ανά περίπτωση
  for (const rendering of renderingsOf(c, page)) {
    it(`${c.case.id} · ${rendering.renderer}: κάθε διάσταση έχει άνοιγμα, και κάθε άνοιγμα το σωστό ζεύγος`, async () => {
      const reference = await page();
      const { raster, userToPx } = await rendering.image();
      expect([raster.width, raster.height]).toEqual([reference.raster.width, reference.raster.height]);
      const check = checkDeclaredDimensions(runPlanChain(raster), truth, userToPx ?? reference.userToPx);
      expect(check.missedDimensions.map((i) => truth.dimensions[i].text)).toEqual([]);
      expect(check.verdicts.filter((v) => v.kind !== 'matched')).toEqual([]);
    }, CASE_TIMEOUT_MS);
  }
}

function caseTests(c: ResolvedGoldenCase): void {
  const { truth } = c.case;
  if (truth.kind !== 'declared-dimensions') {
    it.skip(`${c.case.id}: αλήθεια «${truth.kind}» — δεν τη μετρά αυτός ο runner`, () => undefined);
    return;
  }
  if (!c.measurable) {
    it(`FAILED: ${c.case.id} — αρχείο που λείπει ή άλλαξε`, () => {
      expect(c.files.filter((f) => f.integrity !== 'ok').map((f) => `${f.integrity}: ${f.ref.root}/${f.ref.path}`)).toEqual([]);
    });
    return;
  }
  measureCase(c, truth);
}

const golden = loadGoldenSet(process.env);

describe('ADR-929 §6.21.5 — χρυσός runner (δηλωμένες διαστάσεις)', () => {
  switch (golden.status) {
    case 'not-configured':
    case 'missing-dir':
    case 'missing-manifest':
      it.skip(describeGoldenSetStatus(golden), () => undefined);
      break;
    case 'invalid':
      it(describeGoldenSetStatus(golden), () => {
        expect(golden.errors).toEqual([]);
      });
      break;
    case 'ready':
      golden.cases.forEach(caseTests);
      break;
  }
});

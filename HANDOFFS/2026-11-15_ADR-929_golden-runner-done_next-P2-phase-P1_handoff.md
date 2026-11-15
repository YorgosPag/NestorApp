# HANDOFF — ADR-929: χρυσός runner ΚΛΕΙΣΤΟΣ (§6.21.5) → επόμενο: Π2 (μέτρηση σε εξέλιξη) → Π1 → Ε1–Ε3

**Ημερομηνία:** 2026-11-15 · **Worktree:** `C:\Nestor_Worktrees\pdf-import-persist` · **Κλαδί:** `agent/pdf-import-persist`
**Κατάσταση:** `main` = `origin/main` = `e473d844`. Το κλαδί είναι μπροστά κατά `a21dc694` (§6.21.3) + `6d21e854` (§6.21.4) + **`3b75362f`** (§6.21.5, χρυσός runner) + το commit αυτού του handoff. **Χωρίς land, χωρίς push.**
**Προηγούμενα handoff (ισχύουν για Γ/Δ):**
- `HANDOFFS\2026-11-15_ADR-929_cause-c-subpixel-stroke_next-steps_handoff.md`: §2 Δ (Ε1–Ε3, με αρχεία).
- `HANDOFFS\2026-11-15_ADR-929_golden-runner_prod-cause-c_handoff.md`: §2, Π1 και Π2 (ορισμοί).
- `HANDOFFS\2026-11-15_ADR-929_arrow-base-anchor_fix-plan_handoff.md`: §2.1 γεωμετρία ΤΕΣΤ2.

## 0. Κανόνες (Giorgio)
- Commit **μόνο** στο κλαδί, με ρητή λίστα αρχείων και μήνυμα γραμμένο με `Write` + `git commit -F`. **Ποτέ** στο `main`. `wt:land` και `push` **μόνο με ρητή εντολή Giorgio**.
- Στοχευμένα jest επιτρέπονται· **tsc ΠΟΤΕ**.
- Το `heavy-task.lock` το παίρνει **η ίδια** σου η εντολή jest (hook `heavy-mutex.js`, PreToolUse/PostToolUse). **Δεν** σημαίνει ξένη συνεδρία· ξένη είναι μόνο αν υπάρχει **πριν** τρέξεις.
- Ροή: έρευνα → σχέδιο → **έγκριση Giorgio** → κώδικας → μετάλλαξη → ADR-929 (υποενότητα + changelog) → commit στο κλαδί. Πραγματικό SSoT audit (grep) πριν από κάθε κώδικα· έρευνα στο web όπου υπάρχει αβεβαιότητα. Ποιότητα Revit/ArchiCAD/Figma, FULL SSoT.
- Μεταλλάξεις: αλλαγή και επαναφορά **στο ίδιο** script Python (`try/finally`). Τρέξ' το με `python -X utf8 -I` (το `-I` αγνοεί το `PYTHONIOENCODING`). **Ποτέ** `git checkout -- <αρχείο>`.
- Ο φύλακας του worktree αρνείται σύνθετες εντολές που γράφουν **έξω** από το worktree (π.χ. στο `F:\`). Εκεί χρησιμοποίησε Read + Edit.

## 1. Τι έγινε (μη το ξανακάνεις): ADR-929 §6.21.5, commit `3b75362f`
- **Χρυσό σύνολο** `NESTOR_PLAN_GOLDEN_DIR` = `F:\Shared\_Nestor_Plan_Golden` (ήδη ρυθμισμένη μεταβλητή χρήστη).
  - Το ΤΕΣΤ2 βρίσκεται στο `cases/01c86397bf1122e6f65171cb0e465327b05438705b2d91b12a7ee7c84134ad74.pdf` (ρίζα `golden` = `.`).
  - Περίπτωση `test2-dimension-arrows` στο μανιφέστο· αντίγραφο ασφαλείας `plan-golden-manifest.json.2026-11-15.bak`. Το README ενημερώθηκε.
- **Σχήμα:** νέα αλήθεια `declared-dimensions` (μονάδες περιεχομένου + `contentMatrix`, βαθμίδα Α).
- **Runner:** `__tests__/golden-plan-runner.test.ts` (`@jest-environment node`) και `testing/golden-plan-run.ts` (`renderGoldenPdfPage`, `runPlanChain`, `checkDeclaredDimensions`).
  - Απόδοση με τον SSoT `rasterizePdfPageImages`, στο νέο `PDF_RENDER_CONFIG.PLAN_RENDER_SCALE` (το διαβάζει και το `PdfPageProvider`).
  - Νέο πεδίο `RasterizedPdfPage.userToPx`. Κριτής το `checkSpans`.
- **Δεύτερη απόδοση:** η εικόνα του Chrome (`testing/captured-renderings.ts`, κλειδί sha256). Αποκωδικοποιητής RLE στο `testing/gray-rle-raster.ts`.
- **jest:** `pdfjs-dist` στο `transformIgnorePatterns`.
- **Μετάλλαξη αιτίας γ** (όλο το `coverageWidthOf` → `band.thickness`) ⇒ κόκκινο **μόνο** στο `chrome-production`. Η μετάλλαξη `isArrowBase` επιζεί: μετρήθηκε ότι το ΤΕΣΤ2 δεν φτάνει πια σε εκείνον τον κλάδο.
- Σουίτες: 978 πράσινα. 1 κόκκινο που **προϋπήρχε**: `pdf-rasterize-scale.test.ts` «ταβάνι πλάτους 1000 px» ⇒ 1001, λόγω `Math.ceil(1000,0000000000002)`.

## 2. Επόμενη δουλειά (σειρά εγκεκριμένη)

### Γ.1 — Π2: η οριζόντια 6.25 στα 0,06 px/mm δεν αναγνωρίζεται (ΜΕΤΡΗΣΗ ΣΕ ΕΞΕΛΙΞΗ, κανένας κώδικας ακόμη)
Συνθετικό: `__tests__/dimension-arrow-base.test.ts` (SPEC με δύο διαστάσεις κλειστού άγεμιστου βέλους, 0,06 px/mm).

**Μετρημένα (Παράρτημα Α, εικόνα 491×371, πινελιά 1, ύψος κειμένου 16):**
- **Κατακόρυφη 4.25 σωστή.** `ps4`/`ps26` `dimension-line`, απολήξεις `arrow`, άγκυρες `ps3`/`ps32`, δεσμός κειμένου, ένα άνοιγμα 255 px. Η αλήθεια πέφτει στο **κέντρο** pixel (x = 451,5).
- **Οριζόντια 6.25: η αλήθεια πέφτει ΠΑΝΩ σε όριο pixel (y = 332,00).** Είναι το κάτω όριο της έκτασης, άρα το `fitPlacement` τη βάζει πάντα εκεί. Αλλαγή του `offsetMm` μετακινεί τους τοίχους, **όχι** τη διάσταση.
  - offset −875: τμήματα `ps45` (23,5…68,5, y 332,5) και `ps51` (354,5…398,5), ρόλος `unknown` (0,46). Παράγοντες `text 0` (κατακόρυφη: 3) και `terminators 0.25`: απόληξη «**cross**» αντί για «arrow» (κατακόρυφη: 1,4).
  - offset −883,33: η οριζόντια γραμμή **χάνεται εντελώς** από τη μάσκα.
  - Βοηθητικές (`ps33` x 23,5 · `ps34` x 398,5) και βάσεις βελών (`ps42`, `ps43`) = `wall-face`. **Συνέπεια, όχι αιτία**: ίδιοι παράγοντες με τις σωστές `ps3`/`ps32`, απλώς καμία γραμμή διάστασης δεν τις ζητά.
- **Υπόθεση (ΟΧΙ αποδεδειγμένη):** η ίδια οικογένεια με την αιτία γ, δηλαδή εξάρτηση από τη φάση της εξομάλυνσης. Εδώ όμως εμφανίζεται στη **δυαδοποίηση** της γραμμής, στην **ανίχνευση βέλους** (`classify/dimension-terminators.ts` `arrowScore` / `crossScore`, δειγματοληψία στη δυαδική μάσκα από κορυφή μετατοπισμένη ½ px) και στο **κείμενο** (`textEvidence`). Αν επιβεβαιωθεί, είναι όριο του **αναγνωριστή**, όχι του συνθετικού: το Chrome αποδίδει κι αυτό πινελιές 0,57 px σε μισούς τόνους.

**Τι μένει για απόδειξη (με αυτή τη σειρά):**
1. Γκρι τιμές των σειρών 331/332/333 στο x ≈ 30, 50, 200 (γραμμή, βραχίονες βέλους, αριθμός)· τι κρατά η μάσκα (`alignment.ink`) και τι το κανάλι `alignment.darkness`.
2. Βαθμός βέλους **ανά βραχίονα** στην άκρη της `ps45` (το `arrowScore` δεν εξάγεται· είτε προσωρινό export μέσα σε μετάλλαξη-script, είτε μέτρηση με `inkFractionAlong` του `lib/geometry/raster/ink-probe.ts`).
3. Γιατί δεν δένεται το «6.25»: είναι γλυφές στο `glyphs`; το κενό 69…354 px είναι πολύ μεγάλο για το `textEvidence`;
4. Έλεγχος φάσης **χωρίς** το εμπόδιο του `fitPlacement`: μετατόπιση ολόκληρης της εικόνας κατά ¼ / ½ px (υπάρχει διγραμμική μετατόπιση `shifted` στο `subpixel-stroke-phase.test.ts`). Ή διάσταση που **δεν** είναι το όριο της έκτασης (π.χ. `marginMm` / επιπλέον στοιχείο κάτω).
5. Μετά: σχέδιο διόρθωσης (πιθανώς το βέλος/κείμενο να διαβάζουν το κανάλι κάλυψης, όπως το §6.21.4 για το πάχος) → **έγκριση Giorgio** → κώδικας. SSoT grep πρώτα: `arrowScore`, `crossScore`, `inkFractionAlong`, `coverageWidth`, `darkness`, `textEvidence`, `binarization`.

### Γ.2 — Π1: μισή βάση βέλους (δεν έχει ξεκινήσει)
Ορισμός στο golden-runner handoff §2: πινελιά από **έναν** βραχίονα ως τη γραμμή διάστασης. Πρώτα: συμβαίνει σε πραγματικό σχέδιο; Μόνο τότε γενίκευση του `isArrowBase`, με unit test + μετάλλαξη στο `arrow-base-anchor.test.ts`.

### Δ — Ε1–Ε3: cause-c-subpixel handoff §2 Δ.

## 3. Προτάσεις σε αναμονή (ΜΗΝ τις κάνεις χωρίς ρητό «ναι» του Giorgio)
1. Διόρθωση της στρογγυλοποίησης του πλάτους (`Math.ceil` πάνω σε 1000,0000000000002) στο `src/services/pdf/pdf-rasterize.service.ts` `renderPage`.
2. Τα tests της αναγνώρισης που γράφουν με το χέρι την αλυσίδα `alignPlan` → `extractPlanSegments` → `fusePlan` να χρησιμοποιούν το κοινό `runPlanChain` (`testing/golden-plan-run.ts`).
3. (Παλιά) `chamfer-register.estimateStrokeWidthPx` / `judgeStrokeWidthPx` και `dimension-terminators.measuredStroke` στον εκτιμητή κάλυψης, μόνο με μέτρηση.

## 4. Ανοιχτά (μόνο αναφορά)
- «Ορφανά» κομμάτια βραχιόνων ως `dimension-line` («Γραμμές 6»). Επίσης: «τίποτα νέο» · «Τελευταία» αυτόματης αποθήκευσης · κείμενα OCR ως οντότητες · γραμμές κάτω από τοίχους · `fileIdCacheRef` · επαλήθευση §6.19.
- Επαλήθευση των `6d21e854` / `3b75362f` στην παραγωγή μόνο μετά από land + push (εντολή Giorgio). Αναμένεται «Θα δημιουργηθούν 2» (2.05 + 4.12).

## Παράρτημα Α — προσωρινό jest μέτρησης Π2 (**ΜΗΝ** το δεσμεύσεις· σβήσ' το πριν από commit)
Αρχείο: `src/subapps/dxf-viewer/bim/plan-recognition/__tests__/zz-measure-p2.test.ts`.
Τρέξιμο: `P2_OUT=<json> [P2_PX=0.06] [P2_ONLY=both|h|v] [P2_OFF=-875] npx jest <αρχείο>` (~15 s).
```ts
// ΠΡΟΣΩΡΙΝΟ — μέτρηση Π2 (ADR-929 βήμα Γ): γιατί η οριζόντια 6.25 στα 0,06 px/mm δεν αναγνωρίζεται. ΜΗΝ το δεσμεύσεις.
import { writeFileSync } from 'node:fs';
import { it } from '@jest/globals';
import { applyAffine, invertAffine } from '@/lib/geometry/affine-2x3';
import { rasterToSceneAffine } from '../../../floorplan-background/geometry/raster-scene-mapping';
import { mmToSceneUnits } from '../../../utils/scene-units';
import { alignPlan } from '../alignment/align-plan';
import { extensionAnchorMap, segmentRoleMap, textLinkMap } from '../classify/segment-roles';
import { fusePlan } from '../fusion/plan-fusion';
import { DEFAULT_PLAN_SEGMENTS, extractPlanSegments, minFillPxFor } from '../segments/plan-segments';
import type { SyntheticDimension } from '../testing/synthetic-dimensions';
import { renderSyntheticPlan, SAMPLE_HOUSE_WALLS, type SyntheticPlanSpec } from '../testing/synthetic-plan-raster';

const PX = Number(process.env.P2_PX ?? 0.06);
const ONLY = process.env.P2_ONLY ?? 'both'; // both | h | v
const OUT = 125;
const STYLE = {
  terminator: 'arrow', arrowStyle: 'closed-blank', arrowHalfWidthMm: (3 * 12) / 57, text: 'interrupt', stubMm: 7.5,
  extensionAroundLineMm: 2, offsetMm: -875,
} as const;
const H = { ...STYLE, offsetMm: Number(process.env.P2_OFF ?? -875), from: { x: -OUT, y: -OUT }, to: { x: 6000 + OUT, y: -OUT }, label: '6.25' };
const V = { ...STYLE, from: { x: 6000 + OUT, y: -OUT }, to: { x: 6000 + OUT, y: 4000 + OUT }, label: '4.25' };
const dims = (ONLY === 'h' ? [H] : ONLY === 'v' ? [V] : [H, V]) as SyntheticDimension[];
const SPEC: SyntheticPlanSpec = {
  walls: SAMPLE_HOUSE_WALLS, pxPerMm: PX, marginMm: 400, wallStyle: 'outlined', strokePx: 1, rotationDeg: 0, degradation: null, dimensions: dims,
};

it('μέτρηση Π2', () => {
  const plan = renderSyntheticPlan(SPEC);
  const toPx = invertAffine(rasterToSceneAffine(plan.placement));
  if (!toPx) throw new Error('no inverse');
  const alignment = alignPlan(plan.image);
  const mpp = mmToSceneUnits('m') / PX;
  const minFillPx = minFillPxFor(alignment, { metresPerPixelX: mpp, metresPerPixelY: mpp, source: 'gallery-scale' });
  const extraction = extractPlanSegments(alignment, { ...DEFAULT_PLAN_SEGMENTS, minFillPx });
  const verdicts = extraction.classification.verdicts;
  const fusion = fusePlan({
    kind: 'scan', alignment, segments: extraction.segments, reading: null, knownScale: null, sourceDpi: null,
    segmentRoles: segmentRoleMap(verdicts), extensionAnchors: extensionAnchorMap(verdicts), textLinks: textLinkMap(verdicts),
    roomAreaProbe: () => null,
  });
  const truthPx = (list: readonly { a: { x: number; y: number }; b: { x: number; y: number } }[]) =>
    list.map((t) => ({ a: applyAffine(toPx, t.a), b: applyAffine(toPx, t.b) }));
  const vById = new Map(verdicts.map((v) => [v.segmentId, v]));
  const near = (t: { a: { x: number; y: number }; b: { x: number; y: number } }) => {
    const minX = Math.min(t.a.x, t.b.x) - 4, maxX = Math.max(t.a.x, t.b.x) + 4, minY = Math.min(t.a.y, t.b.y) - 4, maxY = Math.max(t.a.y, t.b.y) + 4;
    return extraction.segments.filter((s) => [s.start, s.end].some((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY))
      .map((s) => {
        const v = vById.get(s.id);
        return { id: s.id, a: [s.start.x, s.start.y], b: [s.end.x, s.end.y], w: s.strokeWidthPx, role: v?.role, score: v?.dimensionScore,
          term: v?.terminators, anchors: v?.extensionAnchors, links: v?.textLinkedWith, factors: v?.factors };
      });
  };
  const t = plan.dimensions;
  const out = {
    px: PX, only: ONLY, size: [plan.image.width, plan.image.height], strokeWidthPx: extraction.strokeWidthPx,
    textHeightPx: extraction.classification.textHeightPx,
    dimensionLines: truthPx(t.dimensionLines).map((tl) => ({ truth: tl, segs: near(tl) })),
    extensionLines: truthPx(t.extensionLines).map((tl) => ({ truth: tl, segs: near(tl) })),
    spans: fusion.dimensionSpans.map((s) => ({ id: s.id, gapPx: s.gapPx, ends: s.ends.map((e) => e.extensionId), segs: s.segmentIds })),
  };
  writeFileSync(process.env.P2_OUT ?? 'p2.json', JSON.stringify(out, null, 1));
});
```

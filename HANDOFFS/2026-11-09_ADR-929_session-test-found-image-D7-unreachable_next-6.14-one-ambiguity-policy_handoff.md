# Handoff — ADR-929 (δ) test συνεδρίας με πηγή-εικόνα ⇒ ΕΥΡΗΜΑ: οι Δ7 με πηγή-εικόνα είναι ανέφικτες · επόμενο: §6.14 «μία πολιτική αμφισημίας για κάθε πηγή»

**Ημερομηνία:** 2026-11-09 (13η συνεδρία) · **Worktree:** `C:\Nestor_Worktrees\raster-plan-recognition` · **Κλαδί:** `agent/raster-plan-recognition`
**Προηγούμενο:** `HANDOFFS/2026-11-09_ADR-929_6.12-6.13-image-scope-and-opening-anchors-done_next-session-test-and-threshold_handoff.md`

## Κανόνες (Giorgio) — αμετάβλητοι
Κάθε βήμα μόνο με «ναι» · πριν από κώδικα **πραγματικό SSoT audit με grep** · έρευνα διαδικτύου όπου δεν είσαι σίγουρος · ποιότητα
Revit/ArchiCAD/Cinema 4D/Figma/Zillow/Idealista και καλύτερα · όχι tsc · **κανένα test χωρίς έγκριση** · commit μόνο στο `agent/*` με
ρητή λίστα · **ποτέ commit στο main** · `wt:land` και push **μόνο** με εντολή Giorgio · απαντήσεις στα ελληνικά.
⚠️ Ο φύλακας του worktree αρνείται σύνθετες εντολές bash (`$(...)`, βρόχους, heredoc): απλές εντολές, αλλιώς `Write`/`Edit`.
⚠️ `git grep -n "…" -- <φάκελος>` από τον φάκελο του dxf-viewer (το `Grep` κάνει timeout στο `src/`).
⚠️ jest: `npx jest <διαδρομές>` από τη ρίζα του worktree.

## Τι έγινε (αυτό το commit)
1. **Κοινό fixture υποβάθρου** (απόφαση Giorgio «ναι»): `src/subapps/dxf-viewer/floorplan-background/testing/background-fixture.ts`
   — `testFloorplanBackground(overrides)` · `seedFloorBackground(bg)` (γράφει στο ΠΡΑΓΜΑΤΙΚΟ store, χωρίς `jest.mock`) · `TEST_CALIBRATION`.
   Το χρησιμοποιούν πλέον `floorplan-background/services/__tests__/commit-calibration.test.ts` και
   `systems/plan-recognition/__tests__/plan-recognition-flow.test.ts` (τα δύο αντίγραφα του κυριολεκτικού `FloorplanBackground` έφυγαν).
2. **Νέο test** `systems/model-from-drawing/__tests__/model-from-drawing-raster-source.test.ts` (4 περιπτώσεις): πηγή = οι 160
   γραμμές τοίχου του `floor-plan-lines.json` ως pixel (`sceneToRasterPixel`, 1 px = 10 mm), υπόβαθρο στο πραγματικό store.
3. **Εκτέλεση (εγκρίθηκε):** 4 σουίτες · **36 ✅ / 3 ❌**. Πράσινα: `commit-calibration`, `plan-recognition-flow`,
   `model-from-drawing-session`, και η περίπτωση «πηγή αντικατεστημένης εικόνας ⇒ `resolveProposalLines` = null, καμία εγγραφή».
   🔴 **Κόκκινες ΣΚΟΠΙΜΑ (προδιαγραφή της §6.14):** «προϋπόθεση: αμφίσημα με πηγή-εικόνα» · «ίδια εικόνα ⇒ η απόφαση μένει» ·
   «άλλη εικόνα ⇒ ορφανή». Γίνονται πράσινες μόνο όταν υλοποιηθεί το βήμα 1 πιο κάτω.

## ΕΥΡΗΜΑ (επαληθευμένο στον κώδικα)
- Πηγή-εικόνα ⇒ `rasterParallelPairStrategy` ⇒ `findWallsFromParallelPairs` ⇒ **κάθε** ορθογώνιο από `rectFromAxis`
  (`bim/walls/wall-rect-end-snap.ts:32`, μέσω `pieceRect`, `bim/walls/parallel-pair-walls.ts:276`) με **ρητό `axis`**.
- `isAmbiguous` (`bim/model-from-drawing/wall-proposal.ts:159`): `if (rect.axis) return false`.
- ⇒ με πηγή-εικόνα **ποτέ** ορθογώνιο «προς απόφαση» Δ7 ⇒ οι §6.11/§6.12 για πλαίσιο εικόνας είναι σωστές αλλά **νεκρές** στην
  παραγωγή· το ADR τις περιγράφει για crop/νέα αναγνώριση, σενάριο που ο κώδικας δεν παράγει.
- Σε σχεδόν τετράγωνο κομμάτι (π.χ. κολόνα 4 γραμμών) ο άξονας είναι **αυθαίρετος** (βήμα 7 του `parallel-pair-walls.ts`: κρατά
  το λεπτότερο ζεύγος). **Ίδιο σχήμα ⇒ άλλη συμπεριφορά ανά πηγή**: σχέδιο ⇒ ερώτηση· εικόνα ⇒ σιωπηλός τοίχος με μαντεμένο άξονα.

## Έρευνα [Π]
- Avontus: γραμμή < 2× πάχος ⇒ **κανένας** τοίχος («πιθανώς παραστάδα/κολόνα»), χωρίς τεκμήριο ειδοποίησης.
  https://docs.avontus.com/docs/overlaying-lines-with-walls
- Configura: «ελάχιστο μήκος τοίχου», τα κοντύτερα παραλείπονται.
  https://support.configura.com/hc/en-us/articles/360047133413-Generating-Walls-on-CAD-Files
- Scan-to-BIM: αμφίβολα στοιχεία ⇒ σημαία για ανθρώπινο έλεγχο. Chief Architect / Revit / ArchiCAD: **δεν βρέθηκε** δημόσια
  τεκμηρίωση για τον άξονα σχεδόν τετράγωνου κομματιού — **δεν ξέρουμε**.
- Ο Νέστωρ στην πηγή-σχέδιο ήδη κάνει καλύτερα, σε 3 στάδια: ρητός άξονας → `resolveAxesFromContext`
  (`bim/model-from-drawing/context-axis.ts:87`, `CONTEXT_AXIS_MAX_GAP_MM` 2500) → άνθρωπος, με αποφάσεις που επιβιώνουν.

## ΕΠΟΜΕΝΟ (νέα συνεδρία, κάθε βήμα με «ναι»)
**Giorgio είπε «ναι» στην κατεύθυνση §6.14: μία πολιτική αμφισημίας για κάθε πηγή («ίδιο σχήμα ⇒ ίδια ερώτηση»).**
1. **Πρώτο βήμα (εγκεκριμένο):** διάβασε ΟΛΟΚΛΗΡΑ `bim/walls/parallel-pair-walls.ts`, `bim/walls/wall-rect-end-snap.ts`,
   `bim/model-from-drawing/context-axis.ts`, `bim/model-from-drawing/wall-proposal.ts` (+ `wall-detection-strategy.ts`) · SSoT audit με
   grep · έρευνα όπου χρειάζεται ⇒ **φέρε λεπτομερές σχέδιο** (σημείο αλλαγής, αρχεία, tests). **Κώδικας μόνο με νέο «ναι».**
   Αρχή: σχεδόν τετράγωνο κομμάτι (λόγος < `AMBIGUOUS_ASPECT_RATIO` 1,75) από ζεύγη περνά από τα στάδια 2 και 3 (συμφραζόμενο →
   άνθρωπος) όπως στο σχέδιο· το μακρόστενο κρατά τον άξονα των παρειών (πραγματική γνώση, π.χ. παραστάδα ανάμεσα σε ανοίγματα
   λύνεται από συγγραμμικούς γείτονες). Καμία νέα μηχανή — `isAmbiguous` και `resolveAxesFromContext` υπάρχουν. Προσοχή στη σειρά:
   η έλξη άκρων (`snapRectEndsToFaces`) χρησιμοποιεί τον άξονα.
2. **Μέτρηση πριν/μετά** (κάθε εκτέλεση με έγκριση): χρυσό σύνολο + συνθετικά §6.9 (26/26 · 32/32 · 0/33) · πλήθος «προς απόφαση»
   ανά πραγματική σάρωση · **test ισοτιμίας**: πηγή-σχέδιο και πηγή-εικόνα του ίδιου σχεδίου ⇒ ίδιο σύνολο «προς απόφαση».
3. Τότε το `model-from-drawing-raster-source.test.ts` γίνεται πράσινο, και ακολουθούν οι μεταλλάξεις Μ1–Μ6:
   Μ1 χωρίς έλεγχο `frameId` στο `rankedCandidates` · Μ2 `sourceBackground` χωρίς έλεγχο `background.id` · Μ3 `imageAnchorFrameId`
   χωρίς id · Μ4 `adoptRasterSegments` αδειάζει αποφάσεις ίδιου ορόφου · Μ5 `withOpeningChoice` χωρίς αφαίρεση · Μ6 αποτύπωμα
   κουφώματος με πάχος ξενιστή. Κάθε μετάλλαξη επαναφέρεται στην ΙΔΙΑ κλήση εργαλείου.
4. ADR-929: νέα **§6.14** + διόρθωση των §6.11/§6.12 (σήμερα περιγράφουν σενάριο που ο κώδικας δεν παράγει).

## ΑΝΟΙΧΤΑ (ειλικρινά)
1. **Push / `wt:land`** — μόνο με εντολή: `1ab518db` (διόρθωση Α1, η παλινδρόμηση είναι ακόμη στην παραγωγή), `01d26390`,
   `feaa6b04`, `c3228cb3`, `bc2a157a`, `c0f1d897`, `1b8a6be2` και αυτό το commit.
2. Αντικατάσταση εικόνας: το `publishRecomputed(null)` **κρατά την παλιά πρόταση** με ειδοποίηση `'no-scene'`· η έγκριση λέει
   `'uncalibrated'`. Ασφαλές (τίποτα δεν γράφεται) αλλά παραπλανητικό ⇒ πρόταση: σβήσιμο προεπισκόπησης + ειδοποίηση με σωστό
   όνομα (νέο i18n). Δεν έγινε.
3. Πρόταση: τρίτη απάντηση «κολόνα» δίπλα στο «τοίχος / όχι» στη Δ7. Δεν έγινε.
4. Η `deps()` του `plan-recognition-flow.test.ts` αντιγράφει την `harness()` του `model-from-drawing-harness.ts` — αναφέρθηκε, δεν έγινε.
5. Από προηγούμενα: §6.9 #21 επαναβαθμονόμηση · changelog ADR-929 για Α1/Α2/`1ab518db` · Δ3 σε αλλαγή εικόνας χωρίς ορατή σημείωση ·
   `ModelFromDrawingHost.test.tsx` κόκκινο (λείπει `NotificationProvider`) · πινακίδα χωρίς πλαίσιο < 3 πεδία · Β1 (§6.10) ·
   (γ) βαθμονόμηση `DECISION_ANCHOR_MIN_IOU` = 0,5.

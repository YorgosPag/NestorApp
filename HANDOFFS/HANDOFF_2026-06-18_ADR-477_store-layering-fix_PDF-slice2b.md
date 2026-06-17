# HANDOFF — ADR-477: (A) Store layering root-cause fix [enterprise] + (B) Slice 2b PDF longitudinal delegation + (C) Slice 3 EC8

**Ημερομηνία:** 2026-06-18 | **Μοντέλο:** Opus | **Κατάσταση:** Slice 1 COMMITTED (9fef2a8b)· **Slice 2 (render unification) DONE & UNCOMMITTED** (tsc exit 0, adapter jest GREEN). Αυτό το handoff = τα ΕΠΟΜΕΝΑ tasks.

> ⚠️ **Working tree μοιράζεται με ΑΛΛΟΝ agent** (slab agent, ADR-476). `git add` **ΜΟΝΟ τα δικά σου αρχεία**. **ΠΟΤΕ commit/push** — ο Giorgio κάνει commit (N.(-1)). Πριν από edit σε shared/κεντρικό αρχείο → **re-read first** (stale-write protection).
> 🎯 **FULL ENTERPRISE + FULL SSOT, Revit-grade, ΜΗΔΕΝ διπλότυπα** (ρητή εντολή Giorgio: «όπως οι μεγάλοι παίχτες όπως η Revit»). N.7.1: functions ≤40 γρ., files ≤500.
> ⚠️ **tsc serialization (N.17):** πριν τρέξεις tsc → έλεγξε ότι δεν τρέχει άλλος (`Get-CimInstance Win32_Process … '*tsc*'`).
> 🌐 Απάντα στον Giorgio **Ελληνικά**.

---

## 0. Τι ΕΓΙΝΕ ήδη (Slice 2 — render unification, DONE & UNCOMMITTED) — context, ΜΗΝ το ξαναγράψεις

Η συνδετήρια δοκός (`FoundationEntity` kind `'tie-beam'`) **ΕΙΝΑΙ δοκός** → τροφοδοτεί πλέον το **ίδιο** beam rebar pipeline (EC8 κρίσιμες ζώνες συνδετήρων). Αρχιτεκτονική = **SSoT core-extraction** (ΟΧΙ fake-BeamEntity — εκείνο θα ξανα-resolve-άρε λάθος cover μέσω beam suggester· η θεμελίωση έχει μεγαλύτερο cover EC2 §4.4.1).

**NEW αρχεία (δικά μου):**
- `bim/renderers/linear-member-rebar-2d.ts` → `drawLinearMemberRebar2D(ctx, {axisPts, sceneUnits, layout, stirrupType}, pxPerMm, worldToScreen)` (2Δ core, πρώην σώμα `drawBeamRebar2D` μετά το resolve).
- `bim-3d/converters/linear-member-rebar-3d.ts` → `buildLinearMemberRebarCage({axisPts, sceneUnits, layout, stirrupType, bottomFaceY})` (3Δ core· επιστρέφει `THREE.Group` **χωρίς** userData — ο caller βάζει `bimType`).
- `bim/structural/reinforcement/tie-beam-linear-member.ts` → **pure** adapter: `tieBeamRebarLayout(p, r)` (REUSE `buildFootingSectionContextFromParams` — tie-beam ctx ⊂ `BeamSectionContext` — + `resolveBeamRebarLayout`) + `tieBeamAxisPoints(p)` (justified άξονας canvas units μέσω `stripJustifiedAxis`).
- `bim/structural/reinforcement/__tests__/tie-beam-linear-member.test.ts` (parity με δοκό + EC8 densification + justified axis — GREEN).

**ΑΛΛΑΓΜΕΝΑ (δικά μου):**
- `beam-rebar-2d.ts` / `beam-rebar-3d.ts` → **thin wrappers** (resolve auto-aware → core)· public signatures **αμετάβλητα**.
- `footing-rebar-2d.ts` / `footing-rebar-3d.ts` → tie-beam **delegate στο core**· **διαγράφηκαν** τα bespoke `drawTieBeam`/`buildTieBeamCage` bodies (ομοιόμορφο βήμα → EC8). 3Δ cage = child στο foundation group (absolute world metres, ίδιο datum με pad/strip).
- `bim/structural/detail-sheet/footing-detail-plan.ts` → `pushTieBeamRebar` συνδετήρες στις EC8 στάθμες (`tieBeamRebarLayout().stirrupLevelsMm`)· fallback uniform μόνο σε degenerate.
- Docs: ADR-477 (Slice 2 changelog+status), adr-index, local_ΕΚΚΡΕΜΟΤΗΤΕΣ, MEMORY.

**3Δ PDF capture:** `footing-detail-3d-capture` → `buildFootingRebarCage` → ο tie-beam κλωβός στο PDF κερδίζει EC8 **αυτόματα** (μηδέν αλλαγή εκεί).

**Gotchas που έμαθα (κράτησέ τα):**
- `TieBeamParams.start`/`end` = **canvas units** (όχι mm)· υπό canonical-mm (ADR-462) canvas==mm. Ο core δέχεται `axisPts` σε canvas units + `sceneUnits` για το scale.
- tie-beam cover (footing, EC2 §4.4.1) **>** beam cover → ΠΟΤΕ resolve μέσω beam suggester· πέρνα **footing-resolved** οπλισμό (`resolveActiveFootingReinforcementForParams`) στο core.
- `TieBeamSectionContext extends BeamSectionContext` → απευθείας στο `resolveBeamRebarLayout` (μηδέν cast, narrow με `if (ctx.kind !== 'tie-beam') return null`).

---

## A. TASK A (πρώτο) — Store layering root-cause fix [enterprise, Revit-grade]

### Το πρόβλημα (layering violation, ΟΧΙ test bug)
Ο **καθαρός compute layer** (renderers / converters / `section-context` / validators) διαβάζει `useStructuralSettingsStore.getState().codeId` (synchronous, in-memory). ΑΛΛΑ το store module σέρνει **eager** ολόκληρο το Firestore/Firebase stack στο import-graph → κάθε pure consumer γίνεται μη-testable:

```
footing-rebar-3d.ts → active-footing-reinforcement.ts → structural-settings-store.ts:31
  → structural-settings.service.ts:14 → building-mutation-gateway → realtime → firestore
  → auth-context → firebase/auth (caller `fetch` at module-init) → ReferenceError: fetch is not defined
```

**Σύμπτωμα:** `bim-3d/converters/__tests__/footing-rebar-3d.test.ts` → «Test suite failed to run: fetch is not defined». Το ίδιο το test δηλώνει στο σχόλιό του «μηδέν store/fetch landmine» — εγγύηση που έσπασε σιωπηλά όταν η Slice 1 (committed 9fef2a8b) πρόσθεσε το store import στο `active-footing-reinforcement.ts`. **ΔΕΝ το εισήγαγε η Slice 2.**

### Root cause (μία γραμμή)
`src/subapps/dxf-viewer/state/structural-settings-store.ts:31`:
```ts
import { saveStructuralSettings } from '../services/structural-settings.service';
```
Eager top-level import. Το service χρειάζεται **ΜΟΝΟ** μέσα στο `debounceWrite` (γρ. 38-48), που τρέχει σε `setTimeout` → ήδη deferred + fire-and-forget.

### Το enterprise/SSoT-σωστό fix (lazy dynamic import — όπως οι μεγάλοι: code-split heavy persistence dep)
**Σπάσε το eager import στην πηγή** ώστε το store module να μένει pure (zero Firebase στο import-graph). Pattern ΗΔΗ καθιερωμένο στο codebase (12+ αρχεία με `await import()` — π.χ. `services/dxf-firestore.service.ts`, `pdf-background/services/PdfRenderer.ts`).

```ts
// ✂️ ΑΦΑΙΡΕΣΕ το top-level import (γρ. 31)
// import { saveStructuralSettings } from '../services/structural-settings.service';

function debounceWrite(buildingId: string, settings: StructuralSettings, delayMs = 500): void {
  const existing = pendingTimers.get(buildingId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    pendingTimers.delete(buildingId);
    // Lazy: το store μένει pure στο import-graph (zero Firebase at module-init) → κάθε
    // pure consumer (renderers/converters/validators/section-context) γίνεται testable.
    void import('../services/structural-settings.service')
      .then((m) => m.saveStructuralSettings(buildingId, settings))
      .catch(() => { /* fire-and-forget: transient failures heal next edit */ });
  }, delayMs);
  pendingTimers.set(buildingId, t);
}
```

**Γιατί αυτό κι όχι hack:** layering boundary (compute ↛ persistence στο import-graph)· SSoT αμετάβλητο (το store μένει ο ΕΝΑΣ source)· zero behavior change (το save ήταν ήδη deferred/fire-and-forget)· ωφελεί ΟΛΑ τα store-coupled pure modules (column/beam `active-reinforcement.ts` έχουν το ίδιο λανθάνον landmine). Απορρίφθηκε το DI/ports-adapters = overkill surface για ένα fire-and-forget save.

### Caveats / κανόνες
- **Κεντρικό/shared αρχείο** (ADR-456/464/474· ίσως ο slab agent ADR-476 το αγγίζει για building-level κανονισμό) → **re-read πριν edit**, `git add` ΜΟΝΟ αυτό.
- Επιβεβαίωσε ότι **κανένας caller δεν βασίζεται σε sync persistence** μετά το setter (δεν βασίζεται — όλα fire-and-forget debounced).

### Verify (Task A)
1. tsc (N.17 serialize) exit 0.
2. `npx jest src/subapps/dxf-viewer/bim-3d/converters/__tests__/footing-rebar-3d.test.ts` → **πρέπει πλέον να φορτώνει & GREEN** (4 tests, incl. tie-beam EC8 cage children > 0).
3. Sanity: structural-settings σχετικά tests (`npx jest structural-settings` αν υπάρχουν) + ότι το building-level persist δεν έσπασε (γρήγορο read του `useStructuralSettingsSync`).
4. Docs: νέο ADR ή entry στο ADR-456 changelog («store import-graph purity — lazy persistence»). Update adr-index + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY.

---

## B. TASK B — Slice 2b: πλήρης longitudinal-elevation στο PDF της συνδετήριας

### Στόχος
Σήμερα το PDF της συνδετήριας χρησιμοποιεί τα footing builders: slot 'elevation' = **cross-section** (`footing-detail-elevation`), slot 'plan' = **top-plan** (`footing-detail-plan`, ήδη EC8 ticks από Slice 2). Θέλουμε **beam-style**: slot 'elevation' = **longitudinal όψη** (EC8 densified συνδετήρες κατά μήκος, `beam-detail-elevation`), slot 'plan' = **διατομή** (`beam-detail-section`) — όπως ακριβώς η δοκός.

### Αρχιτεκτονική (mirror της Slice-2 core-extraction — ΟΧΙ fake-BeamEntity)
1. **Extract pure cores** (τα builders σήμερα παίρνουν `beam: BeamEntity` και καλούν εσωτερικά `buildBeamSectionContext` + `resolveBeamRebarLayout`):
   - `beam-detail-elevation.ts` → extract `buildLinearMemberElevationRegion(layout: BeamRebarLayout, r: BeamReinforcement, region: RectMm): BeamElevationResult` (όλο το σώμα ΜΕΤΑ το `layout`). `buildBeamElevationRegion(beam, r, region)` = thin wrapper (resolve layout → core).
   - `beam-detail-section.ts` → extract `buildLinearMemberSectionRegion(layout: BeamRebarLayout, region: RectMm): BeamSectionResult` (χρησιμοποιεί ΜΟΝΟ `layout`). Wrapper resolves.
   - (Αυτά είναι entity-free → μηδέν cast, μηδέν fake entity. Mirror του 2Δ/3Δ core-extraction που έκανα στη Slice 2.)
2. **`footing-detail-sheet.ts` tie-beam branch:** όταν `foundation.params.kind === 'tie-beam'`:
   - `r = resolveActiveFootingReinforcementForParams(p)` (narrow tie-beam)· `layout = tieBeamRebarLayout(p, r)` (ήδη υπάρχει, Slice 2).
   - slot **'elevation'** ← `buildLinearMemberElevationRegion(layout, r, regions.elevation)` (longitudinal).
   - slot **'plan'** ← `buildLinearMemberSectionRegion(layout, regions.plan)` (διατομή).
   - slots **schedule / perspective / title-block** → **μένουν footing** (`buildFootingScheduleRegion`/`buildColumnPerspectiveRegion`/`buildFootingTitleBlockRegion` — ήδη kind-aware/σωστά labels, μηδέν αλλαγή).
   - pad/strip → αμετάβλητο (footing plan + section).
3. **Labels (το μόνο πραγματικό μπλόκο):** οι footing region titles είναι «Κάτοψη/Τομή»· για longitudinal όψη χρειάζονται **beam-style** «Όψη/Τομή». Επιλογές (διάλεξε το πιο SSoT):
   - **(προτεινόμενο)** Στον `FoundationDetailHost.tsx`: όταν kind==='tie-beam', πέρνα region titles «Όψη» (elevation slot) + «Τομή» (plan slot) μέσω **νέων i18n keys** `foundationDetail.tieBeamRegions.{elevation,section}` (el+en) — N.11: keys ΠΡΩΤΑ στα locale JSONs. Τα schedule/titleblock labels μένουν τα ήδη υπάρχοντα footing labels.
   - Το `buildFootingDetailSheet` δέχεται ήδη `labels: FootingDetailSheetLabels` — πρόσθεσε optional `tieBeamRegions?: { elevation: string; section: string }` (ή reuse `labels.elevation`/`labels.plan` με σωστές μεταφράσεις αν ο host τις δίνει kind-aware).
4. **Tests:** parity (tie-beam PDF elevation/section model regions = beam για ίδια διατομή/άνοιγμα)· no-crash· τα footing schedule/titleblock αμετάβλητα.

### Reuse inventory (Task B)
`resolveBeamRebarLayout` · `tieBeamRebarLayout`/`tieBeamAxisPoints` (Slice 2) · `beam-detail-elevation`/`beam-detail-section` (→ extract cores) · `buildFootingScheduleRegion`/`buildFootingTitleBlockRegion`/`buildColumnPerspectiveRegion` (kind-neutral) · `groupSpacingZones`/`formatSpacingZoneLabel`/`formatBeamStirrupsLabel`.

### Gotcha (Task B)
- Μετά το Task A, το `footing-detail-*` import chain παραμένει store-coupled (μέσω `resolveActiveFootingReinforcementForParams`) — αλλά πλέον **pure στο import-graph** (lazy persistence), οπότε τα PDF model tests φορτώνουν χωρίς fetch landmine.

---

## C. TASK C — Slice 3: EC8 §5.4.1.2 σεισμική αξονική δύναμη σύνδεσης (ΜΕΤΑ τα A+B)

Πλήρης προδιαγραφή στο προηγούμενο handoff: `HANDOFFS/HANDOFF_2026-06-18_ADR-477_tie-beam-render-unification.md` §3. Περίληψη: `N_tie = ±0.3·a_g·S·N_Ed,mean` των συνδεόμενων υποστυλωμάτων· νέο `bim/structural/loads/tie-beam-tie-force.ts` (scene-level)· σεισμικά settings building-level στο `StructuralSettings`· readout στην καρτέλα Ιδιότητες· ΟΧΙ στο gravity `isLoadPathMember`.

---

## D. Επαλήθευση & κανόνες (όλα)
- tsc: ΕΝΑΣ τη φορά (N.17). Browser-verify: σχεδίασε συνδετήρια· «Οπλισμός» ON → 2Δ/3Δ πύκνωση άκρων· PDF «Λεπτομέρεια Οπλισμού» → (μετά B) longitudinal όψη + διατομή σαν δοκός· resize → live re-study (Slice 1)· μηδέν regression pad/strip.
- **Commit/push: ΜΟΝΟ ο Giorgio** (N.(-1)). git add ΜΟΝΟ δικά σου (shared tree με slab agent ADR-476).
- Μετά: ADR-477 changelog + adr-index + local_ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY.

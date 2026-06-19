# HANDOFF — ADR-503 Slice 3 (organism-wide safety-gated lock: δοκός → πλάκα → πέδιλο)

> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ (με τη σειρά):**
> 1. `docs/centralized-systems/reference/adrs/ADR-503-two-way-auto-size-safety-gated-lock.md` (Slice 1+2 DONE — η υλοποίηση που κάνεις mirror).
> 2. `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` §4 (live αυτο-διόρθωση) + §5 (δυναμική επανα-διαστασιολόγηση) + **§8.4** (ο άνθρωπος υπογράφει, το σύστημα προειδοποιεί).
> 3. MEMORY: `~/.claude/projects/C--Nestor-Pagonis/memory/reference_two_way_auto_size.md`.

**Ημ/νία:** 2026-06-19 · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά · **Μοντέλο:** Opus (`/model opus`) · **PLAN-FIRST** (plan σε sub-slices → «προχώρα» → κώδικας).
**🚨 commit + tsc = ο GIORGIO (ΟΧΙ εσύ). jest = repo ROOT. Επαλήθευση: live DB Firestore MCP `proj_12788b6a`.**
**⚠️ SHARED TREE (μοιράζεται με άλλον agent):** `git add` ΜΟΝΟ τα δικά σου. **ΜΗΝ** αγγίξεις `bim/columns/column-beam-align*` (ADR-496) ούτε `bim-3d/diagrams/*` (ADR-483) ούτε ό,τι αγγίζει ο structural agent. **ADR = ήδη ADR-503** (συνέχισέ το, ΜΗΝ νέο νούμερο).
**🚨 N.0.2 / FULL SSOT:** ΠΡΙΝ γράψεις ΟΤΙΔΗΠΟΤΕ, ξανα-grep — η §2 παρακάτω είναι το audit μου (2026-06-19), αλλά **επιβεβαίωσέ το** (το shared tree αλλάζει). Revit-grade, full enterprise, μηδέν `any`/inline-style, ≤40γρ/func, ≤500γρ/file, i18n keys ΠΡΩΤΑ (N.11).

---

## 0. ΑΠΟΦΑΣΕΙΣ GIORGIO (παγωμένες — verbatim)

«Η εφαρμογή πρέπει να είναι έξυπνη → να αλλάζει αυτόματα διατομές+οπλισμό ώστε μηδέν υπο-διαστασιολόγηση (ανασφαλές) ΚΑΙ μηδέν υπερ-διαστασιολόγηση (σπατάλη). Ο αρχιτέκτονας βάζει default χωρίς να ξέρει στατικά.»

- **Q1 = Two-way** (μεγαλώνει + μικραίνει στο ελάχιστο επαρκές).
- **Q2 = Lock υποδιαστασιολογημένης → ΜΠΛΟΚΑΡΕΤΑΙ ΕΝΤΕΛΩΣ** (μένει AUTO ώσπου να γίνει ασφαλής). **Invariant: καμία persisted οντότητα ποτέ κάτω από το επαρκές.** (Over-dimensioned lock = επιτρέπεται — επιλογή του μηχανικού.)

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (Slice 1 + Slice 2 — κολώνα, UNCOMMITTED 2026-06-19)

**Το pattern που κάνεις mirror.** Κολώνα: two-way `suggestColumnSection` (ν-floor EC8) + safety-gated lock:
- `bim/structural/sizing/column-sizing.ts`: NEW pure `isColumnSectionAdequate(provider, params, moment?) → { adequate, minWidthMm, minDepthMm }`. Boy-scout de-dup: `rectangularSectionFits(w,d)` (πύλες αντοχής) + `columnDimensionFloorMm(height)` (γεωμετρικό floor).
- `bim/structural/sizing/column-size-patch.ts`: **ΕΝΑ SSoT** `resolveColumnSectionLock(provider, prevParams, nextParams, moment?) → { params, rejected, minWidthMm, minDepthMm }`. Κανόνας: μη-section edit → pass-through· ≥ επαρκές → `autoSized:false`· < επαρκές → ΜΠΛΟΚ (clamp στο ελάχιστο επαρκές, μένει AUTO, `rejected:true`).
- Wiring 2 thin call sites: `useColumnParamsDispatcher.ts` (panel) + `commitColumnGripDrag` (`hooks/grips/grip-parametric-commits.ts`).
- Toast: typed event `bim:column-section-rejected` (`systems/events/drawing-event-map-bim.ts`) + registrar στο `hooks/notifications/structural-attach-notifications.ts` με **stable `id`** (μηδέν storm κατά grip drag) + i18n `structuralOrganism.columnSectionRejected` (el+en, `dxf-viewer-shell.json`).
- 28/28 sizing jest GREEN.

**👉 Διάβασε `column-size-patch.ts` (resolveColumnSectionLock) — είναι το ακριβές template για beam/slab/footing.**

---

## 2. 🔍 SSOT AUDIT (grep 2026-06-19 — ΞΑΝΑ-grep πριν τον κώδικα)

### Κρίσιμο εύρημα: οι sizers ΕΙΝΑΙ ΗΔΗ two-way
- `suggestBeamSection` (`bim/structural/sizing/member-sizing.ts`) → επιστρέφει `max(serviceability, flexure, shear, torsion, MIN)` rounded, clamped. **ΟΧΙ** `Math.max(currentDepth, …)`. ⇒ ήδη μικραίνει+μεγαλώνει.
- `suggestSlabThickness` (`bim/structural/sizing/slab-sizing.ts`) → ίδια φιλοσοφία (επιβεβαίωσε στο αρχείο).
- Footing `suggest-pad-dimensions.ts` → A_req = N/σ συνεχές (ήδη two-way).

**⇒ Slice 3 ΔΕΝ είναι two-way μετατροπή. Είναι ΜΟΝΟ lock-gate (reject-if-inadequate).**

### Reuse map (ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΑ — μην ξαναγράψεις)

| Concern | SSoT (υπάρχει) | Πού |
|---|---|---|
| Beam sizer (two-way) | `suggestBeamSection(provider, ctx)` | `sizing/member-sizing.ts` |
| Beam context builder | `buildBeamSectionContext(beam, supportTypeOverride?, designTorsionKnm?)` | `bim/structural/section-context.ts` |
| Beam patch + guards | `buildBeamSizePatch`, `isBeamAutoSized`, `beamSectionMateriallyDiffers` (private), `resolveActiveBeamSection` (private) | `sizing/beam-size-patch.ts` |
| Beam active support type | `resolveActiveBeamSupportType(beamId)` | `bim/structural/active-reinforcement.ts` |
| Beam active torsion | `resolveActiveBeamTorsion(beamId)` | `bim/structural/active-reinforcement.ts` |
| Slab sizer | `suggestSlabThickness(...)` | `sizing/slab-sizing.ts` |
| Slab patch + guards | `buildSlabSizePatch`, `isSlabAutoSized` (composite `dna` → ΠΟΤΕ auto) | `sizing/slab-size-patch.ts` |
| Slab active support | `resolveActiveSlabSupportCondition(slabId)` | `bim/structural/active-reinforcement.ts` |
| Footing auto-size | `suggestPadDimensions(...)` + `auto-foundation-layout.ts` | `footing-design/suggest-pad-dimensions.ts` |
| Provider (imperative) | `resolveStructuralCode(useStructuralSettingsStore.getState().codeId)` | `bim/structural/codes` + `state/structural-settings-store` |
| Toast event map | `drawing-event-map-bim.ts` (πρόσθεσε νέα events εδώ) | `systems/events/` |
| Toast registrar | `registerStructuralAttachNotifications(t)` | `hooks/notifications/structural-attach-notifications.ts` |
| i18n | `structuralOrganism.*` | `src/i18n/locales/{el,en}/dxf-viewer-shell.json` |

### Manual section-edit σημεία (εκεί μπαίνει το lock-gate)

| Μέλος | Grip (commit) | Panel/ribbon dispatcher |
|---|---|---|
| **Δοκός** | `commitBeamGripDrag` — `grip-parametric-commits.ts:~237-239` (`sectionChanged ? {...newParams, autoSized:false} : newParams`) | `useBeamParamsDispatcher.ts:~55-58` (ίδιο pattern) |
| **Πλάκα** | — (polygon-footprint vertices μόνο· πάχος ΔΕΝ έχει grip) | `useSlabParamsDispatcher.ts` — **ΔΕΝ κλειδώνει καθόλου σήμερα** (βλ. §3.2 — pre-existing gap) |
| **Πέδιλο** | `commitFoundationGripDrag` — `grip-parametric-commits.ts` (width/length) | `useFoundationParamsDispatcher.ts` (**cross-level aware** — προσοχή §3.3) |

---

## 3. SLICE 3 — PLAN ΑΝΑ ΜΕΛΟΣ (κάνε πρώτα τον ΔΟΚΟ, μετά πλάκα, μετά πέδιλο)

### 3.1 ΔΟΚΟΣ (ξεκίνα από εδώ — πιο καθαρό mirror της κολώνας)
**Πρόβλημα:** σήμερα ο δοκός κλειδώνει (`autoSized:false`) σε **ΚΑΘΕ** section change — ακόμη κι αν είναι υποδιαστασιολογημένη (παραβίαση Q2).

**Σχέδιο (mirror `resolveColumnSectionLock`):**
1. `sizing/beam-size-patch.ts`: NEW pure `isBeamSectionAdequate(provider, beam, next, support?, torsion?) → { adequate, minDepthMm }`. **Πύλη = serviceability L/d + κάμψη + διάτμηση + στρέψη — ΟΧΙ ν** (όλες ήδη μέσα στο `suggestBeamSection`). Adequacy = `next.depth ≥ suggested.depthMm` (depth-driven v1· width = αρχιτεκτονική επιλογή, αλλά επηρεάζει το suggested → χτίσε ctx από τα **next** params: `buildBeamSectionContext({ ...beam, params: next }, support, torsion)` → `suggestBeamSection`).
2. NEW `resolveBeamSectionLock(provider, beam, prev, next, support?, torsion?) → { params, rejected, minDepthMm }` (ίδια σημασιολογία με column).
3. Αντικατέστησε τα 2 inline `sectionChanged ? {...newParams, autoSized:false} : newParams` (grip:~239 + dispatcher:~57) με κλήση του `resolveBeamSectionLock`. Πέρνα `support = resolveActiveBeamSupportType(id)`, `torsion = resolveActiveBeamTorsion(id)`.
4. Toast: βλ. §4 (γενίκευση event).
5. **Jest** (`beam-size-patch.test.ts`): υποδιαστασιολογημένο depth → rejected + clamp στο suggested· επαρκές → lock OK· μη-section edit → pass-through.

### 3.2 ΠΛΑΚΑ
**Πρόβλημα (διπλό):** το `useSlabParamsDispatcher` **δεν κλειδώνει καθόλου** → χειροκίνητο πάχος (α) δεν μένει lock → ο proactive κύκλος το ξαναγράφει (pre-existing gap), ΚΑΙ (β) δεν μπλοκάρεται αν είναι ανεπαρκές.

**Σχέδιο:** NEW `isSlabSectionAdequate` + `resolveSlabSectionLock` στο `sizing/slab-size-patch.ts` (adequacy = `next.thickness ≥ suggested`). **Προσοχή composite `dna`** → `isSlabAutoSized=false` ήδη → pass-through (μην το αγγίξεις). Wiring ΜΟΝΟ 1 σημείο (`useSlabParamsDispatcher`). Επιβεβαίωσε αν `suggestSlabThickness` είναι cantilever-only (αν ναι → αμφιέρειστη πλάκα = εκτός gate, pass-through).

### 3.3 ΠΕΔΙΛΟ (τελευταίο — ΑΒΕΒΑΙΟ, ίσως DEFER / ρώτα Giorgio)
**⚠️ Ανοιχτό ζήτημα:** το `FoundationParams` **δεν φάνηκε** να έχει `autoSized` flag (δεν ήταν στο `autoSized` grep — επιβεβαίωσε στο `bim/types/foundation-types.ts`). Αν λείπει, το footing lock-gate χρειάζεται **νέο field** ή διαφορετικό μηχανισμό → **απόφαση Giorgio πριν υλοποιήσεις**. Επίσης ο `useFoundationParamsDispatcher` είναι **cross-level aware** (γράφει σε foundation scope μέσω `foundation-cross-level-writer` όταν το πέδιλο δεν είναι στον ενεργό όροφο) — το lock-gate πρέπει να ισχύει ΚΑΙ στα δύο μονοπάτια (active-level command + cross-level writer). Πιθανότατα ξεχωριστό sub-slice/συνεδρία.

---

## 4. ΓΕΝΙΚΕΥΣΗ TOAST/EVENT (full SSoT — απόφαση πριν τον κώδικα)
Σήμερα υπάρχει `bim:column-section-rejected` (ειδικό). Για full SSoT, **πρόκρινε** γενίκευση σε ΕΝΑ event:
`bim:member-section-rejected { entityType: 'column'|'beam'|'slab', requestedMm: {w?,d?,thickness?}, keptMm: {...} }` + 1 registrar + i18n keys ανά τύπο (`columnSectionRejected`/`beamSectionRejected`/`slabSectionRejected`, γιατί η διατύπωση διαφέρει: κολώνα=w×d, δοκός=ύψος, πλάκα=πάχος). Επειδή το column wiring είναι **δικό σου** (UNCOMMITTED), μπορείς να το refactor-άρεις χωρίς shared-tree ρίσκο. **Stable toast `id` ανά τύπο** (μηδέν storm στο grip drag). Αν η γενίκευση βγει πολύπλοκη → mirror per-member events (απλό, λιγότερο DRY).

---

## 5. ΚΡΙΣΙΜΑ ΜΑΘΗΜΑΤΑ
- 🚨 **Η πύλη επάρκειας διαφέρει ανά μέλος.** Κολώνα = ν (EC8) + οπλισμός. Δοκός/πλάκα = serviceability (βέλος L/d) + κάμψη + διάτμηση (+στρέψη δοκού). Όλες είναι ΗΔΗ μέσα στους sizers → η adequacy είναι απλά «manual διάσταση ≥ suggested». ΜΗΝ ξαναγράψεις φυσική.
- 🚨 **Convergence:** ο sizer + `*MateriallyDiffers` guard + 50mm quantization κλείνουν τον βρόχο. Το lock-gate δεν προσθέτει νέο reactive trigger (τρέχει command-time, ίδιο με την κολώνα).
- 🚨 **Clamp-during-grip-drag:** το `applyXGripDrag` υπολογίζει από absolute cursor → το clamp στο ελάχιστο επαρκές κάθε frame είναι σταθερό (μηδέν drift). Το toast de-dup με stable `id`.
- **Πλάκα composite `dna`** = ΠΟΤΕ auto → pass-through. **Πέδιλο** = ίσως λείπει `autoSized` field (ρώτα).
- GOL: ≤40γρ/func, ≤500γρ/file, μηδέν `any`, i18n keys ΠΡΩΤΑ.

## 6. ΕΡΓΑΛΕΙΟ ΕΠΑΛΗΘΕΥΣΗΣ (live DB `proj_12788b6a`)
Μοντέλο: 2 κολώνες 400×400 + 2 πέδιλα + δοκάρι + πλάκα-πρόβολος. **Δοκός test:** βάλε χειροκίνητα μικρό ύψος (π.χ. 200mm) σε φορτισμένο δοκάρι → να μπλοκάρει (clamp στο suggested) + toast· βάλε μεγάλο (επαρκές) → lock OK (`autoSized:false`).

## 7. PRE-EXISTING jest fails (ΟΧΙ δικά σου — baseline)
**7 fails:** 6 raft (ADR-476 — 4 `computeRaftBearing` σε `footing-design/__tests__/raft-bearing.test.ts` + 2 raft `runReinforcementChecks` σε `organism/__tests__/reinforcement-checks.test.ts`) + 1 `AssignWallTypeCommand` (undo-before-execute). 1226 pass structural+commands. Αν δεις αυτά → αγνόησέ τα.

## 8. ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (N.15 — ίδιο commit)
Ενημέρωσε: ADR-503 (changelog + status header) · `adr-index.md` · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γραμμές, ΜΟΝΟ τι εκκρεμεί) · MEMORY `reference_two_way_auto_size.md`. **ΜΗΝ** κάνεις commit/push (ο Giorgio).

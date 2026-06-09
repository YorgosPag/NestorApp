# 🧠 KICKOFF — ADR-435 Coordination / Clash Detection (MEP↔MEP↔Structural)

> **Σύνταξη:** Opus 4.8, 2026-06-10 (αμέσως μετά το ADR-434 Gas, που έκλεισε το 8/8 auto-routing). **Στόχος νέας συνεδρίας:** η **πρώτη Coordination stage** του ADR-423 — **Clash Detection** (ανίχνευση συγκρούσεων δικτύων) + (Phase 2) penetrations/sleeves. Επιλογή Giorgio (AskUserQuestion 2026-06-10): μετά το auto-routing, το επόμενο workstream = Coordination/clash. **FULL ENTERPRISE + FULL SSOT, όπως Revit/Navisworks/Solibri.**

---

## ⚠️ ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ — ΔΙΑΒΑΣΕ ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ
1. **Μνήμη:** `~/.claude/projects/C--Nestor-Pagonis/memory/MEMORY.md` + `project_adr423_mep_auto_design.md` (§ GAP analysis: Coordination = «committed stage», clash + penetrations/sleeves — flagged unverified, ΟΧΙ ακόμα υλοποιημένο).
2. **ADR (Code=SoT):** `ADR-423-mep-auto-design-framework.md` §10 (SCOPE LOCKED: Coordination clash+sleeves = COMMITTED). Όλα τα 8 discipline ADRs (426/427/428/430/431/432/433/434) δείχνουν τι entities υπάρχουν να συγκρουστούν.
3. **ADR number = 435** (το 434 = το τρέχον υψηλότερο, gas). **ΜΗΝ adr-index** (shared tree codex).

---

## 🎯 ΤΙ ΕΙΝΑΙ ΤΟ CLASH DETECTION (Revit/Navisworks/Solibri)
Μετά το auto-routing, τα 8 δίκτυα + τα δομικά στοιχεία μπορεί να **τέμνονται στον 3Δ χώρο**:
- **Hard clash:** δύο στερεά καταλαμβάνουν τον ίδιο όγκο (σωλήνας μέσα από δοκό· αεραγωγός μέσα από κολώνα· σωλήνας αερίου τέμνει σωλήνα ύδρευσης).
- **Clearance/soft clash:** παραβίαση ελάχιστης απόστασης (π.χ. σωλήνας αερίου < X mm από ηλεκτρικό· χώρος συντήρησης).
- **Penetration (Phase 2):** σωλήνας/αεραγωγός που περνά νόμιμα μέσα από τοίχο/πλάκα → αυτόματο **sleeve/μανσόν** (όχι clash, αλλά coordination element).

Output (Revit-grade): **read-only clash report** = λίστα `Clash {a, b, type, point, overlapVolume, severity}` + 3Δ markers + 2Δ overlay, **transient** (όχι persisted entities v1· mirror του proposal-store μοτίβου).

---

## 🔑 ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΠΟΦΑΣΗ (proposed — ο επόμενος agent επιβεβαιώνει σε Plan Mode)
**Mirror του auto-design framework:** όπως κάθε discipline = «recognizer + registry entry, ΟΧΙ νέα μηχανή», το clash = **ΕΝΑ broad-phase + narrow-phase engine** πάνω στα ΥΠΑΡΧΟΝΤΑ geometry caches — ΜΗΔΕΝ νέα geometry.

- **Reuse ΥΠΑΡΧΟΝΤΑ primitives (recon πρώτα):** κάθε BIM entity έχει ήδη `geometry.bbox` (BoundingBox3D) — η foundation του broad-phase. `computeMepSegmentGeometry` → bbox/outline· beams/columns/walls/slabs έχουν geometry caches. `utils/geometry/GeometryUtils` + `bim/geometry/shared/polygon-utils` (polygonCentroid, point-in-polygon) ήδη υπάρχουν.
- **Broad-phase:** AABB overlap (bbox-vs-bbox) — O(n log n) με sweep-and-prune ή uniform grid. SSoT helper `aabbOverlap(a,b)`. Φιλτράρει τα 99% non-clashing ζεύγη φθηνά.
- **Narrow-phase:** ακριβής έλεγχος ανά candidate pair. v1: segment(capsule/cylinder)-vs-segment + segment-vs-box(beam/column/slab) αναλυτικά (closest-distance < r1+r2 → hard clash· < r1+r2+clearance → soft). Pluggable `ClashRule` (mirror των pluggable demand/sizing standards): hard vs clearance ανά ζεύγος disciplines (π.χ. fuel↔electrical clearance από κανονισμό).
- **Pair-filtering (SSoT):** ΜΗΝ συγκρίνεις entity με τον εαυτό του / με connected entities (ίδιο MepSystem = νόμιμη επαφή στα fittings). Reuse το membership truth (MepSystem.members) για να αγνοείς legit connections.
- **NEW `systems/coordination/`** (sibling του `systems/mep-design/` & `systems/recognition/`): `clash-types.ts` (Clash, ClashSeverity, ClashRule)· `aabb.ts` (broad-phase)· `clash-narrow-phase.ts` (segment/box analytics — reuse GeometryUtils)· `clash-rules.ts` (pluggable, hard/clearance per discipline-pair)· `detect-clashes.ts` (orchestrator: scene entities → ClashReport)· `index.ts`.
- **Preview/UI = mirror proposal-store:** low-freq `clash-report-store.ts` (⚠️ ADR-040 header) + ghost leaf (3Δ markers στα clash points + 2Δ overlay) + ribbon «Έλεγχος Συγκρούσεων» (Detect/Clear, ΟΧΙ commit — read-only report). 3Δ marker = reuse bim-gizmo-overlay-markers μοτίβο.

---

## 📦 ΚΡΙΣΙΜΑ ΣΗΜΕΙΑ (μαθήματα από τα 8 disciplines — μην τα ξαναπατήσεις)
1. **Geometry caches ΗΔΗ υπάρχουν** — ΜΗΝ ξαναϋπολογίσεις. Κάνε recon: ποιο πεδίο δίνει το 3Δ bbox/solid κάθε entity type (segment/fitting/beam/column/wall/slab/fixture). Το `getEntityConnectors` + `getConnectorHostPlanTransform` (connector-access.ts) είναι το connectivity SSoT.
2. **Connected ≠ clash:** entities στο ίδιο MepSystem που μοιράζονται connector = νόμιμη επαφή. Filter μέσω members.
3. **ADR-040:** το clash overlay (3Δ markers + 2Δ) = leaf· low-freq store (set on Detect, clear on Clear)· STAGE ADR-040 (CHECK 6B/6D) στο Slice UI.
4. **Performance:** broad-phase ΥΠΟΧΡΕΩΤΙΚΟ (n² narrow-phase σε κτίριο = πάγωμα). Uniform grid / sweep-and-prune. Log τι σαρώθηκε (no silent caps).
5. **Pluggable rules:** clearance thresholds (fuel↔electrical, hot↔cold κλπ) = `ClashRule` interface, ΟΧΙ hardcode στη μηχανή. v1 = hard-clash only + 1-2 clearance demos.
6. **i18n el+en** κάθε string· **μηδέν `any`**· αρχεία ≤500 / functions ≤40· **ΜΗΝ commit/push** (Giorgio· N.(-1))· **N.17** ΕΝΑΣ tsc· shared tree codex (git add ΜΟΝΟ δικά σου).

---

## 🧩 SLICING (proposed)
- **Slice 0 — engine headless:** `systems/coordination/` (types + aabb broad-phase + narrow-phase segment/box + rules + `detectClashes` orchestrator) + tests (pure/deterministic: known overlapping pair → hard clash· connected pair → no clash· clearance threshold).
- **Slice 1 — UI/preview:** `clash-report-store` (low-freq) + 3Δ marker leaf + 2Δ overlay + ribbon «Έλεγχος Συγκρούσεων» Detect/Clear + report panel (λίστα clashes, click→zoom). STAGE ADR-040.
- **Slice 2 (future) — Penetrations/sleeves:** legit wall/slab penetration → auto sleeve element + opening reservation.

## ✅ DEFINITION OF DONE (Slice 0+1)
jest πράσινο (νέα coordination suites + μηδέν regression)· tsc 0 στα δικά σου· browser smoke (φτιάξε 2 δίκτυα που τέμνονται → Detect → 3Δ markers + report)· **N.15 docs:** ADR-435 NEW + ADR-423 changelog (Coordination Phase 1) + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY.md (+ `project_adr435_clash.md`). **ΜΗΝ adr-index.** ΜΗΝ commit.

## 🧩 ΚΑΤΑΣΤΑΣΗ ΠΟΥ ΚΛΗΡΟΝΟΜΕΙΣ
- **Auto-routing 8/8 disciplines DONE** (ADR-426→434, όλα v1, preview/commit shared verbatim). Το clash είναι το **επόμενο layer πάνω** (Stage 5→Coordination), ΟΧΙ 9ο δίκτυο.
- **Επόμενα μετά το clash (ADR-423 §10 roadmap):** Stage 6 Μηχανολογική Μελέτη (calc/compliance ΤΟΤΕΕ/ΚΕΝΑΚ — το CORE deliverable)· Stage 7 Deliverables (schematics/tags)· Stage 8 Interop (gbXML/DIALux). Per-discipline polish: HVAC return-air, αέριο LPG/oil, full pressure-drop sizing.
- **ΞΕΚΙΝΑ ΜΕ Plan Mode:** recon των geometry caches (ποιο πεδίο = 3Δ solid/bbox ανά entity type) → επιβεβαίωσε broad/narrow-phase αρχιτεκτονική → slice plan → έγκριση → υλοποίηση.

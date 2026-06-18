# ADR-490 — Structural Warning Overlay (οπτική επισήμανση μέλους με στατικό σφάλμα)

**Status:** ✅ Implemented (UNCOMMITTED 2026-06-18) — browser-verify pending
**Date:** 2026-06-18
**Σχετικά:** ADR-487 (ΟΡΑΜΑ §4 — καθοδηγητική ενημέρωση) · ADR-488 (proactive FEM) · ADR-459 (organism diagnostics) · ADR-481/482 (FEM diagnostics) · ADR-485 (utilization overlay — mirror) · ADR-040 (micro-leaf)

---

## 1. Πρόβλημα

Όταν ο μηχανικός αποσυνδέει κολώνα και το δοκάρι μένει **στον αέρα** (0 στηρίξεις = μηχανισμός), η πληροφορία υπάρχει ήδη (panel «Στατικός Έλεγχος» + diagnostics `beamUnsupportedEnd`/`analyticalModelUnstable`/`staticAnalysisUnstable`), **αλλά τίποτα δεν το δείχνει πάνω στο ίδιο το δοκάρι στην κάτοψη**. Ο μηχανικός πρέπει να εντοπίσει οπτικά «ποιο μέλος» έχει το πρόβλημα.

## 2. Απόφαση (Revit/Robot-grade)

**Status overlay always-on** που επισημαίνει στην κάτοψη κάθε φέρον μέλος με severity error/warning:
- **error** (δοκάρι στον αέρα / μηχανισμός): **κόκκινο halo** γύρω από το footprint + **badge ⚠** (vector) στο κέντρο.
- **warning**: **διακριτικό amber halo** (χωρίς badge).
- **info**: μένει μόνο στο property panel (δεν «μολύνει» την κάτοψη).

**Γιατί αυτές οι επιλογές:**
- **Always-on, ΟΧΙ toggle:** τα στατικά σφάλματα δεν κρύβονται πίσω από διακόπτη (Robot/SAP: «unstable members always red»). Κρύβοντας ένα «δοκάρι στον αέρα» πίσω από toggle αναιρεί τον σκοπό (ADR-487 §4: καθοδηγητική ενημέρωση).
- **Ξεχωριστό overlay, ΟΧΙ βαφή του μέλους:** το fill/χρώμα του μέλους είναι σημασιολογικό (ADR-445 colour identity) και το fill το χρησιμοποιεί ήδη το utilization (ADR-485). Το status είναι ξεχωριστό annotation layer (όπως η Revit χωρίζει physical ↔ warnings).
- **Vector badge (τρίγωνο+θαυμαστικό), ΟΧΙ text glyph:** μηδέν hardcoded string / i18n (N.11), crisp σε κάθε DPR.
- **Actionable = υπάρχον flow:** το badge τραβά το μάτι → ο μηχανικός επιλέγει το μέλος (υπάρχων μηχανισμός) → το `EntityWarningsSection` δείχνει την αιτία + έχει ήδη Διαγραφή/Σύνδεση. Inline κουμπιά + hover-tooltip = **DEFER** (το hover είναι high-freq → ADR-040 ρίσκο).

## 3. SSoT — μηδέν νέα λογική «τι είναι πρόβλημα»

Το overlay είναι **καθαρά οπτική προβολή** των ΥΠΑΡΧΟΝΤΩΝ diagnostics:
- `StructuralDiagnosticsStore.getAll()` (organism) + `AnalysisDiagnosticsStore.getAll()` (FEM) — τα ίδια που τροφοδοτούν το panel.
- NEW pure `collectEntityHighlights(...sets)` → ενώνει τα sets, κρατά τη **χειρότερη** severity ανά entityId (error>warning, info→skip). SSoT για «ποιο μέλος, πόσο σοβαρά».
- NEW SSoT `severityStyle(severity)` (halo χρώμα + badge flag) — δεν υπήρχε severity-color (grep κενό).
- NEW SSoT `resolveMemberFootprintVertices(entity)` (κολόνα `footprint` / δοκάρι `displayOutline ?? outline`) — **εξαγωγή** από το utilization overlay → **migrate** και τα 2 overlays (boy-scout N.0.2).

## 4. ADR-040 (micro-leaf)

NEW `StructuralWarningOverlay` = ξεχωριστό canvas, `pointer-events-none`, z-10, mounted **τελευταίο** στο `canvas-layer-stack-2d-overlays-leaf.tsx` (topmost). Subscribes ΜΟΝΟ εδώ: `ViewMode3DStore` (mode) + τα **δύο low-freq** diagnostics stores (γράφονται μόνο σε structural αλλαγή/ανάλυση — ADR-488 proactive) + active-floor scene. Ο shell δεν αποκτά subscription (CHECK 6C safe). Halo/badge = σταθερά px (annotation).

## 5. Αρχεία (NEW/MOD — δικά μου)

- **NEW** `bim/structural/member-footprint-2d.ts` — `resolveMemberFootprintVertices` + `polygonCentroid`.
- **NEW** `bim/structural/organism/diagnostic-highlight.ts` — `collectEntityHighlights` + `HighlightSeverity`/`EntityHighlight` + **test** (5 jest).
- **NEW** `bim/structural/diagnostic-severity-style.ts` — `severityStyle` + badge χρώματα.
- **NEW** `components/dxf-layout/StructuralWarningOverlay.tsx` — micro-leaf overlay.
- **MOD** `components/dxf-layout/canvas-layer-stack-2d-overlays-leaf.tsx` — mount (topmost).
- **MOD** `components/dxf-layout/StructuralUtilizationOverlay.tsx` — migrate στο footprint SSoT (boy-scout).

## 6. Επαλήθευση

2 κολώνες + δοκάρι → αποσύνδεσε τη μία (μετά την άλλη) → όταν το δοκάρι μένει στον αέρα: **αμέσως κόκκινο halo + ⚠** πάνω του (το engaged-latch ADR-488 ανανεώνει τα diagnostics). Επιλογή δοκαριού → panel «δοκάρι χωρίς στήριξη / μηχανισμός». Όταν ξανα-συνδεθεί → η επισήμανση φεύγει.

## 7. DEFER

- Inline quick-action buttons (Διαγραφή/Σύνδεση) πάνω στο badge + hover-tooltip με αιτία (ADR-040 hover = high-freq → χωριστή μελέτη).
- Legend για τα severity χρώματα.
- 3Δ επισήμανση (τώρα μόνο 2Δ κάτοψη).
- Pulsing/animation (τώρα στατικό — ADR-040 safe).

## 8. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-18 | **Δημιουργία + υλοποίηση.** Always-on warning overlay (κόκκινο/amber halo + badge ⚠) από τα υπάρχοντα diagnostics· 3 SSoT modules (highlight/severity-style/footprint)· utilization migrated στο footprint SSoT· 5 jest GREEN. UNCOMMITTED. |

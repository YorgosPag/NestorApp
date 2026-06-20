# ADR-506 — Auto-διαστασιολόγηση ΠΛΑΤΟΥΣ δοκαριού (width-aware, two-way, Revit-grade)

**Status:** 🟡 IMPLEMENTED — UNCOMMITTED 2026-06-20 · 🔴 browser-verify + commit (Giorgio)
**Date:** 2026-06-20
**Υλοποιεί:** ADR-487 §4 (ζωντανός οργανισμός «σε κάθε κίνηση») + §9 (scope guard: Revit-grade, ΟΧΙ Robot/SAP)
**Σχετικά:** ADR-475 (auto member sizing — depth-only v1, το επεκτείνει), ADR-499 (flexural ceiling + auto-size), ADR-503 (two-way column sizing — το πρότυπο), ADR-504 (practical-span advisory + ΝΟΚ clear-height SSoT — η πηγή του δυναμικού ορίου), ADR-486 (topology-aware beam support), ADR-494 (`projectColumnFootprintOnAxis`), ADR-448/450 (storey context SSoT)

---

## 1. Πρόβλημα (Giorgio)

Ο auto-sizer δοκαριού (ADR-475) ήταν **depth-only**: μεγάλωνε μόνο το ύψος μέχρι σταθερό cap
`BEAM_MAX_PRACTICAL_DEPTH_MM=1500`, αφήνοντας το πλάτος αμετάβλητο. Σε μεγάλα ανοίγματα έβγαζε
δυσανάλογα βαθιά/στενά δοκάρια που **κόβουν το ελεύθερο ύψος κάτω τους** — εκεί που περνούν
πόρτες/κουφώματα. Αίτημα: να αυτο-διαστασιολογείται **και το πλάτος**, με φυσική λογική —
το δοκάρι βαθαίνει μέχρι να αρχίσει να εμποδίζει το κούφωμα από κάτω, και **μετά φαρδαίνει**.

## 2. Spec (κλειδωμένες αποφάσεις Giorgio 2026-06-20)

1. **Trigger = δυναμικό όριο ΝΟΚ.** Το ύψος μεγαλώνει μέχρι `practicalBeamDepthLimitMm(storeyHeightMm, kind)`
   (= ύψος ορόφου − required clear, SSoT ADR-504 `clear-height-under-beam`). Πέρα από αυτό →
   φαρδαίνει το πλάτος. Αντικαθιστά το σταθερό 1500 με `min(1500, ΝΟΚ-όριο)`.
2. **Width cap = πλάτος στηρίζουσας κολώνας.** Το δοκάρι «κάθεται» μέσα στην κολώνα (καθαρός
   κόμβος, Revit-grade). Cap = **κάθετη στον άξονα** προβολή του footprint της κολώνας
   (`perpMax−perpMin`), min επί όλων των στηρίξεων.
3. **Two-way.** Το πλάτος **φαρδαίνει ΚΑΙ στενεύει** στο ελάχιστο επαρκές (floor `MIN_BEAM_WIDTH_MM=150`),
   όπως οι κολώνες (ADR-503). Μηδέν σπατάλη μπετόν.
4. **Independent locks.** Νέο flag `BeamParams.autoSizedWidth` (ανεξάρτητο του `autoSized`=ύψος):
   χειροκίνητη αλλαγή πλάτους κλειδώνει **μόνο το πλάτος**· το ύψος μένει AUTO (και αντίστροφα).
5. **Μονόδρομο (Giorgio, Revit-like).** Η **κολώνα ΔΕΝ μεγαλώνει** από το δοκάρι. Αιτιολογία: η
   κολώνα διαστασιολογείται από αθροιστικό αξονικό + σεισμό (ΕΚ8) όλων των ορόφων — όχι από ένα
   δοκάρι· σύζευξη beam→column δημιουργεί cascade/μη-σύγκλιση + σιωπηλή αλλαγή κανάβου. Αν το
   δοκάρι δεν χωρά ούτε στο (πλάτος κολώνας × βάθος ΝΟΚ) → **υπερβολικό άνοιγμα** → η υπάρχουσα
   πρόταση **ενδιάμεσης κολώνας (ADR-504)** είναι η απάντηση. Η κολώνα κρατά τον δικό της
   two-way sizer (ADR-503) για τους δικούς της λόγους — μονόδρομη εξάρτηση = εγγυημένη σύγκλιση.

## 3. Υλοποίηση

### 3.1 Pure sizer — `member-sizing.ts` (`suggestBeamSection`)
- Οι depth-helpers (`flexuralDepthMm`/`shearDepthMm`/`torsionDepthMm`) παραμετροποιήθηκαν σε
  `widthMm` (default `ctx.widthMm` → backward-compat). `serviceabilityDepthMm` μένει
  width-independent (το βέλος είναι **γεωμετρικό** — το φάρδεμα ΔΕΝ το μειώνει).
- NEW `requiredDepthRaw(ctx, provider, maxRatio, widthMm)` = max-of-checks ∨ MIN.
- **Dispatch:** width-sizing ενεργό **μόνο** όταν `ctx.maxWidthMm` παρόν ΚΑΙ `widthAutoSized !== false`:
  - `sizeWidthFree`: loop `w ∈ [MIN_BEAM_WIDTH_MM, cap] step 50` (cap = `roundDown(maxWidthMm)`) →
    πρώτο `w` όπου `requiredDepth ≤ effectiveDepthCap` (two-way: ξεκινά από MIN → στενεύει· μεγαλώνει
    μέχρι να χωρέσει). Κανένα → `cap` + depth clamped + `governedBy:'width-capped'` (→ ADR-504).
  - αλλιώς `sizeFixedWidth`: depth-only (legacy· locked width ∨ graphless). `depthAutoSized===false`
    → κρατά το stored ύψος.
  - `effectiveDepthCap = min(BEAM_MAX_PRACTICAL_DEPTH_MM, ctx.practicalDepthLimitMm ?? ∞)`.
- `BeamSizingGovernedBy` += `'width-capped'`.

### 3.2 Topology cap — transient store (mirror ADR-486/504)
- NEW `organism/beam-max-width-store.ts` (`BeamMaxWidthStore = createDerivedMapStore<number>()`).
- NEW `organism/derive-beam-max-width.ts` (`buildBeamMaxWidthMap`): per beam → `beamSupportColumnIds`
  → `projectPolygonOnAxis(column.footprint)` → `(perpMax−perpMin)·sceneToMm` → **min** επί στηρίξεων.
  Kind-agnostic (footprint-based). Degenerate/μηδέν στήριξη → absent → depth-only.

### 3.6 SSoT cleanup — `beamAxisSceneFrame` (N.0.2 boy-scout, μηδέν νέο διπλότυπο)
Το axis-frame derivation (`startPoint/endPoint → {ax,ay,ux,uy,lenScene}`) ήταν **inline-διπλασιασμένο**
σε `maxClearSubSpanMm` (ADR-504) + `beamInteriorSupports` (ADR-480/481)· το ADR-506 θα πρόσθετε 3ο
αντίγραφο. Αντ' αυτού NEW pure SSoT `bim/beams/beam-axis-scene-frame.ts` (`beamAxisSceneFrame`,
**params-only/geometry-independent** ώστε ο `beamInteriorSupports` να μη χρειάζεται `geometry.length`)
→ **και τα 3** consumers delegate. Το scene→mm scale το παράγει τοπικά μόνο ο `buildBeamMaxWidthMap`
(μοναδική χρήση). 4 jest. **Μηδέν νέο διπλότυπο** — αντίθετα, αφαιρέθηκαν 2 προϋπάρχοντα.
- Wiring στο `hooks/structural-organism-core.ts` (δίπλα στα Support/Span/Torsion stores).
- NEW resolvers `resolveActiveBeamMaxWidthMm` + `resolveActiveBeamSizingLimits` (active-reinforcement.ts):
  το δεύτερο = ΕΝΑ SSoT που συνδυάζει το ΝΟΚ όριο (από `readActiveStoreyContext` + `practicalBeamDepthLimitMm`)
  + το cap κολώνας → `BeamSizingLimits`.

### 3.3 Context — `structural-code-types.ts` / `section-context.ts`
- `BeamSectionContext` += `practicalDepthLimitMm?`, `maxWidthMm?`, `widthAutoSized?`, `depthAutoSized?`.
- `buildBeamSectionContext(...)` δέχεται trailing `sizing?` extras (conditional spread· τα flags `false`
  μεταφέρονται). Ο reinforce path τα παραλείπει → depth-only (μηδέν regression).

### 3.4 Patch + lock — `beam-size-patch.ts`
- NEW `isBeamWidthAutoSized` + `BeamSizingLimits` interface.
- `buildBeamSizePatch(..., limits?)`: independent flags — `null` μόνο αν **και τα δύο** locked·
  αλλιώς re-size μόνο τα AUTO πεδία (+ `autoSizedWidth:true`/`autoSized:true` αντίστοιχα). Convergence guard.
- `resolveBeamSectionLock(..., limits?)`: διάκριση `widthChanged`/`depthChanged` — depth → υπάρχουσα
  adequacy/rejection· width → `autoSizedWidth:false` (lock πλάτους, **χωρίς** rejection: το πλάτος
  είναι αρχιτεκτονική επιλογή). `isBeamSectionAdequate` κρίνει με `widthAutoSized:false` (fixed manual width).
- Callers: `AutoSizeMembersCommand`, `grip-parametric-commits` (grip resize), `useBeamParamsDispatcher`
  (panel/ribbon) περνούν `resolveActiveBeamSizingLimits(beamId)`.

### 3.5 Type — `beam-types.ts`
- `BeamParams.autoSizedWidth?: boolean` (default AUTO· `false` = κλειδωμένο πλάτος, independent του `autoSized`).

## 4. Συνέπεια — γιατί δεν σπάει η physics
- **Serviceability (βέλος) width-independent:** σωστά — το φάρδεμα δεν μειώνει το βέλος. Άρα όταν το
  βέλος κυριαρχεί και ξεπερνά το ΝΟΚ όριο, το φάρδεμα **δεν** βοηθά → `width-capped` → ADR-504. Σωστή φυσική.
- **Flexure/shear width-dependent:** το φάρδεμα μειώνει την απαιτούμενη βάθος → εκεί δουλεύει το trade-off.

## 5. Tests
- `member-sizing.test.ts`: grow (shear-governed)· shrink two-way· width-capped over-span· ΝΟΚ cap σε depth-only·
  width-locked· depth-locked+width-free. (Υπάρχοντα 14 πράσινα — backward-compat.)
- `beam-size-patch.test.ts`: independent flags (fully-locked→null, width-capped, shrink)· lock width-only
  → `autoSizedWidth:false` & depth stays AUTO· both-change.
- NEW `derive-beam-max-width.test.ts`: perp-projection cap, min-over-supports, point-column→absent, beams-only.
- **44 jest πράσινα** (+ 40 σε section-context/span-model/practical-span/torsion regression).

## 6. DEFER
- Width-sizing με AUTO πλάτος στενεύει στο **ελάχιστο επαρκές** (έως 150mm) όταν υπάρχει στήριξη·
  να επαληθευτεί στο browser ότι δεν εκπλήσσει (αρχιτεκτονικό πλάτος → lock από τον μηχανικό).
- Tie-in: το `governedBy:'width-capped'` μπορεί μελλοντικά να ενεργοποιεί ρητά το ADR-504 advisory
  (σήμερα το advisory βασίζεται στο depth-vs-practical· καλύπτει το ίδιο σενάριο).

## Changelog
- **2026-06-20** — Initial. Width-aware two-way sizing + ΝΟΚ-driven trigger + column-width cap (μονόδρομο)
  + independent `autoSizedWidth` lock. NEW `BeamMaxWidthStore`/`derive-beam-max-width`/`resolveActiveBeamSizingLimits`.
  UNCOMMITTED · 🔴 browser-verify + commit.
- **2026-06-20** — SSoT cleanup (§3.6, Giorgio challenge): NEW `beam-axis-scene-frame.ts` (params-only)
  ενοποίησε το axis-frame derivation που ήταν inline ×2 (`maxClearSubSpanMm`/`beamInteriorSupports`) — και
  τα 3 consumers delegate· μηδέν νέο διπλότυπο, −2 προϋπάρχοντα. 88 jest συνολικά.

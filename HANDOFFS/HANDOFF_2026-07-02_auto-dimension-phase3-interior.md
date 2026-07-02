# HANDOFF — Auto-Dimension Φ3 (Εσωτερική διαστασιολόγηση)

**Ημ/νία:** 2026-07-02
**Feature:** Αυτόματη διαστασιολόγηση κάτοψης (DXF Viewer) — ADR-563
**Κατάσταση:** Φ1 (περιμετρικό) + Φ2 (BIM associativity) **ΥΛΟΠΟΙΗΘΗΚΑΝ, UNCOMMITTED**.
**Επόμενο:** Φ3 — **εσωτερική** διαστασιολόγηση.

> ⚠️ **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** Άγγιξε ΜΟΝΟ τα αρχεία που αφορούν
> το Auto-Dimension· μην πειράξεις άσχετα uncommitted αρχεία. **Ο Giorgio κάνει commit — ΟΧΙ εσύ.**

---

## 0. Κανόνες συνεδρίας (ΑΠΑΡΑΒΑΤΟΙ)

- 🌐 **Απαντάς ΠΑΝΤΑ στα Ελληνικά** (native γλώσσα Giorgio· CLAUDE.md LANGUAGE RULE).
- 🏢 **Enterprise + Full SSoT.** «Όπως οι μεγάλοι» (Revit / ArchiCAD / Cinema 4D-Maxon / Figma-level).
  Αν οι μεγάλοι έχουν καθιερωμένη πρακτική → ακολούθησέ την, μην εφεύρεις δική σου.
- 🔎 **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ γράψεις κώδικα** — ψάξε αν υπάρχει ήδη αντίστοιχος
  κώδικας/helper/store και κάν' τον reuse· ΜΗΔΕΝ διπλότυπα (N.0.2 / N.12).
- 📐 **Plan Mode πρώτα** (N.0.1 ADR-driven, cross-cutting). Στο clarify με τον Giorgio:
  **ξεκίνα με συγκεκριμένο οπτικό/αριθμητικό παράδειγμα** (ASCII), όχι αφηρημένη ερώτηση.
- ❌ **ΜΗΝ τρέξεις `tsc`/typecheck** (N.17). ✅ **jest επιτρέπεται** (στοχευμένα).
- ❌ **ΜΗΝ commit / push** χωρίς ρητή εντολή Giorgio (N.(-1)).

---

## 1. Τι υπάρχει ήδη (Φ1+Φ2) — ΚΑΝ' ΤΟ REUSE, ΜΗΝ ΤΟ ΞΑΝΑΓΡΑΨΕΙΣ

**Pure engine** — `src/subapps/dxf-viewer/systems/dimensions/auto/`:
- `auto-dimension-types.ts` — `AutoDimensionOptions` (tiers detail/axes/overall, sides N/S/E/W,
  referenceBasis smart/faces/axes, includeOpenings, distanceBetweenLines, offsetFromModel),
  `AUTO_DIMENSION_DEFAULTS`, `ReferencePoint {coord, side, tier, sourceEntityId, edge}`,
  `PlannedSegment`, `AutoDimEdge`, helpers `sideMeasuresX`.
- `auto-dimension-reference-extraction.ts` — `extractReferencePoints(elements, options, overall)`.
  Έξυπνη βάση: τοίχοι→όψεις, δομικά→κέντρα/άκρα, ανοίγματα→κέντρα. Reuse `calculateBimEntity2DBounds`.
- `auto-dimension-chain-planner.ts` — `planChains(refPoints, overall, options)`. Dedup με **`snapToGrid`**
  (ADR-049), 3 tiers offset outward, ένα segment/διαδοχικό ζεύγος.
- `auto-dimension-entity-factory.ts` — `buildAutoDimensionEntities(segments, ctx)` → `LinearDimensionEntity[]`.
  `generateDimensionId()` (N.6), associations **`bimExtent`** (Φ2), sanity via `buildDimensionGeometry`.
- `auto-dimension-engine.ts` — `runAutoDimension(elements, options, ctx)` = extract→plan→factory.
  `computeOverallBounds` reuse `unionBounds`.
- `auto-dimension-dialog-store.ts` — `createConfirmStore` wrapper (request/resolve/subscribe/getState).
- `run-auto-dimension-flow.ts` — dialog→engine→commit. Selection ή όλη η κάτοψη.

**Commit:** `bim/scene/add-dimensions-to-scene.ts` → `appendEntitiesToScene(... 'dim-auto', 'Αυτόματη διαστασιολόγηση')`
(batch = 1 undo, persistence, associativity observer αυτόματα).

**UI/wiring:** `ui/dialogs/AutoDimensionOptionsDialog.tsx` (self-subscribing, mount στο `app/DxfViewerDialogs.tsx`
+ lazy στο `dxf-viewer-lazy-components.tsx`)· ribbon button `action:'auto-dimension'` στο `ui/ribbon/data/home-tab-dimensions.ts`
+ icon `dim-auto` (Frame) στο `RibbonButtonIcon.tsx`· routing `if (action==='auto-dimension')` στο `app/dxf-special-actions.ts`.
i18n: `ribbon.commands.autoDimension` + `autoDimension.dialog.*` σε `src/i18n/locales/{el,en}/dxf-viewer-shell.json`.

**Φ2 associativity (follow-on-move):** νέο `associationType:'bimExtent'` + `bimAnchor:{axis,edge}` στο
`types/dimension.ts`· axis-aware branch στο `systems/dimensions/dim-association-service.ts` (reuse
`calculateBimEntity2DBounds`, ενημερώνει μόνο τον μετρούμενο άξονα, διατηρεί την κάθετη). **Reuse το ίδιο
`bimExtent` και για τα εσωτερικά dims της Φ3.**

**Tests (πράσινα, 79):** `npx jest "src/subapps/dxf-viewer/systems/dimensions/auto" "dim-association"`.

**Docs:** `ADR-563-auto-dimension-engine.md`, `ADR-362` Round 28 changelog, `adr-index.md`.

---

## 2. Στόχος Φ3 — Εσωτερική διαστασιολόγηση

Το Φ1+Φ2 καλύπτει ΜΟΝΟ **περιμετρικό** (bounding-box, 4 πλευρές, offset έξω από το μοντέλο). Η Φ3
προσθέτει **εσωτερικές** αλυσίδες: αποστάσεις μεταξύ **εσωτερικών** αξόνων δομικών (κολόνες/τοιχία/
τοίχοι) — ο κάναβος (structural grid) της κάτοψης.

**Πρακτική μεγάλων (ερεύνησέ την ξανά με WebSearch/deep-research πριν σχεδιάσεις):**
- **Revit** — «Intersecting Grids»: dims κατά μήκος κάθε γραμμής κανάβου.
- **ArchiCAD** — interior dimensioning (η αυτόματη exterior ΔΕΝ βγάζει interior — δες τι προτείνουν αντ' αυτού).
- **AutoCAD** — QDIM Continuous/Baseline σε επιλεγμένα εσωτερικά αντικείμενα.

**Ανοιχτές αποφάσεις σχεδιασμού (ρώτα Giorgio με ΣΥΓΚΕΚΡΙΜΕΝΟ ASCII παράδειγμα):**
1. **Πού τοποθετούνται** οι εσωτερικές αλυσίδες; (α) πάνω σε εσωτερική γραμμή αναφοράς ανά «σειρά/στήλη»
   κανάβου, (β) μία οριζόντια + μία κατακόρυφη αλυσίδα από άκρη σε άκρη μέσα από τα κέντρα, (γ) grid-based.
2. **Ανά άξονα** (X και Y ανεξάρτητα) ή grid-cell;
3. **Ποια στοιχεία** ορίζουν εσωτερικό άξονα (μόνο κολόνες/τοιχία; και εσωτερικοί τοίχοι;).
4. **Επιλογή στο dialog** — νέο checkbox «Εσωτερικές διαστάσεις» στο `AutoDimensionOptionsDialog`.

---

## 3. SSoT reuse map για Φ3 (ΕΠΑΛΗΘΕΥΣΕ με grep — μπορεί να έχει αλλάξει)

| Ανάγκη | Reuse |
|---|---|
| Γεωμετρία/κέντρα δομικών | `entity.geometry` (bbox/footprint/axis) + `calculateBimEntity2DBounds` (`bim/utils/bim-bounds.ts`) |
| Dedup/quantize | `snapToGrid` (`systems/grid/grid-snap.ts`, ADR-049) |
| Dim entity | `LinearDimensionEntity` (`types/dimension.ts`) + `generateDimensionId()` |
| Style | `getDimStyleRegistry().getActiveStyle()` |
| Associativity follow-on-move | **`bimExtent`** (Φ2) — ήδη διαθέσιμο· δώσε `bimAnchor:{axis,edge}` |
| Batch commit | `addDimensionsToScene` / `appendEntitiesToScene` |
| Type guards | `isWallEntity/isColumnEntity/isFoundationEntity/isBeamEntity` (`types/entities.ts`) |

**Πιθανή αρχιτεκτονική Φ3 (πρόταση, όχι δέσμευση):** νέο pure module `auto-dimension-interior-planner.ts`
(αδελφός του chain-planner) που παράγει `PlannedSegment[]` με εσωτερική τοποθέτηση dim line, + `interior`
toggle στο `AutoDimensionOptions` + engine option. Ο factory/commit/associativity **δεν αλλάζουν**.

---

## 4. Τι ΝΑ ΜΗΝ κάνεις
- ❌ Μην ξαναγράψεις το engine/dialog/wiring της Φ1/Φ2 (reuse/extend).
- ❌ Μην commit/push (ο Giorgio).
- ❌ Μην τρέξεις tsc.
- ❌ Μην αγγίξεις άσχετα uncommitted αρχεία (shared working tree).
- ❌ Μη δημιουργήσεις διπλότυπο — grep πρώτα.

## 5. Verification Φ3
- jest για το νέο interior planner (+ engine end-to-end).
- Browser: εσωτερικές αλυσίδες σωστά· follow-on-move (μετακίνηση εσωτερικής κολόνας)· 1 Ctrl+Z.

# HANDOFF — ADR-421 SLICE B: fan-out 11 υπόλοιπων τύπων κουφωμάτων

**Ημερομηνία:** 2026-06-07
**Προηγούμενη συνεδρία:** Opus 4.8 (research + ADR-421 + SLICE A = double-door πρότυπο)
**Νέα συνεδρία:** Opus — **FULL ENTERPRISE + FULL SSOT**, Revit-grade
**Working tree:** ΚΟΙΝΟ με άλλον agent — **ΟΧΙ commit/push** (ο Giorgio κάνει commit)
**Γλώσσα:** απαντάς ΠΑΝΤΑ Ελληνικά.

---

## 0. ΠΟΥ ΒΡΙΣΚΟΜΑΣΤΕ

Ο Giorgio θέλει Revit-grade κατάλογο **17 τύπων** κουφωμάτων (από 5 σήμερα). Αποφάσεις κλειδωμένες
(ADR-421 §6): **Μοντέλο B = πλήρες ADR-412 Family/Type** + **17 τύποι** + **parametric 3D mesh** +
**ρητό `operationType`** (IFC4). Εκτέλεση: **Plan Mode + vertical slices**.

- ✅ **SLICE A DONE** (προηγ. συνεδρία): foundation (`operationType` IFC4 SSoT) + **`double-door`
  end-to-end** = το **per-kind ΠΡΟΤΥΠΟ** που θα γενικεύσεις. tsc 0 (scope), 164 tests PASS,
  uncommitted. Δες `ADR-421-bim-opening-types-revit-grade.md` §A1-A10 + changelog.
- 🔜 **SLICE B = ΑΥΤΟ ΤΟ HANDOFF**: fan-out στους **11 υπόλοιπους** τύπους, reusing το πρότυπο A.
- 🔴 **SLICE C** (μετά, ξεχωριστό): ADR-412 opening Family/Type (Model B — named Types + live
  propagation). Χάρτης wiring έτοιμος (δες §6). **ΜΗΝ το κάνεις τώρα** — πρώτα SLICE B.

---

## 1. ΣΕΙΡΑ ΕΡΓΑΣΙΩΝ (υποχρεωτική)

1. **Διάβασε** το ADR-421 (πλήρως — §3 κατάλογος, §4 concerns, §A* SLICE A) + αυτό το handoff.
2. **Plan Mode**: σχεδίασε το fan-out. Είναι **πολλά αρχεία/2+ domains** → N.8: ενημέρωσε τον Giorgio
   αν προτείνεις Orchestrator, αλλιώς Plan Mode + sub-batches. Ο Giorgio έχει ήδη πει «vertical slices».
3. **Υλοποίηση**: ανά οικογένεια, ακολούθησε το **registration checklist §3** (το ίδιο που έκανε το
   double-door). Πρότεινε batching (π.χ. 3-4 families/batch) με tsc + tests ανά batch.
4. **ADR-driven (N.0.1 + N.15)**: μετά → ενημέρωσε ADR-421 changelog/status + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`
   (ΟΜΑΔΑ ADR-421) + MEMORY.md (`project_adr421_opening_types.md`).
5. **ΟΧΙ commit** — ο Giorgio κάνει commit.

---

## 2. ΟΙ 11 ΤΥΠΟΙ (από ADR-421 §3· EXISTING=door/double-door/window/sliding-door/french-door/fixed)

### Πόρτες (IfcDoor)
| kind (πρόταση) | Ελληνικά | IFC `operationType` | 2D plan symbol | 3D mesh |
|---|---|---|---|---|
| `double-sliding-door` | Συρόμενη διπλή | `DOUBLE_DOOR_SLIDING` | 2 rails + 2 panel offsets | 2 συρόμενα φύλλα (offset) |
| `pocket-door` | Χωνευτή (στον τοίχο) | `SLIDING_TO_LEFT/RIGHT` | panel μισό μέσα στον τοίχο (dashed pocket) | φύλλο σε θήκη (μερικώς κρυφό) |
| `bifold-door` | Πτυσσόμενη (φυσαρμόνικα) | `FOLDING_TO_LEFT/RIGHT` | zig-zag φύλλα (V σχήμα) | 2-4 πτυσσόμενα panels σε γωνία |
| `overhead-door` | Γκαραζόπορτα (ρολό/τμηματική) | `ROLLINGUP` | dashed up-swing / sectional γραμμές | οριζόντιες λωρίδες (sectional) |
| `revolving-door` | Περιστρεφόμενη | `REVOLVING` | κύκλος + σταυρός 4 φύλλων | 4 φύλλα + κύλινδρος |

### Παράθυρα (IfcWindow)
| kind (πρόταση) | Ελληνικά | IFC `operationType` | 2D plan symbol | 3D mesh |
|---|---|---|---|---|
| `double-hung-window` | Συρόμενο κατακόρυφα | `SLIDINGVERTICAL` | glazing + βέλος ↕ | 2 sashes (κατακόρυφα) |
| `sliding-window` | Συρόμενο οριζόντια | `SLIDINGHORIZONTAL` | glazing + βέλος ↔ | 2 sashes (offset) |
| `awning-window` | Ανακλινόμενο πάνω | `TOPHUNG` | glazing + ▲ hinge-top mark | top-hinged sash |
| `hopper-window` | Ανακλινόμενο κάτω | `BOTTOMHUNG` | glazing + ▼ hinge-bottom mark | bottom-hinged sash |
| `tilt-turn-window` | Ανοιγο-ανακλινόμενο | `TILTANDTURNRIGHTHAND` | glazing + σχήμα L | dual-mode sash |
| `bay-window` | Προεξέχον (κουτί) | partitioning `TRIPLE_PANEL_*` | προεξέχον πολυγωνικό outline | προεξέχον σώμα |

> **ΣΗΜΕΙΩΣΗ Revit-true:** double-hung/sliding-window & awning/hopper/tilt-turn έχουν **ίδιο plan
> outline** με `window`/`fixed`· διαφέρουν στο **overlay mark** + στο IFC operation + schedule. (Στη
> Revit το ίδιο — η διάκριση είναι στην elevation/3D + tag.) Επομένως πολλά μοιράζονται 2D outline,
> ΟΧΙ overlay. Το `bay-window` έχει διαφορετικό outline (projecting) → ίσως νέος geometry path.

---

## 3. PER-KIND REGISTRATION CHECKLIST (το ΑΚΡΙΒΕΣ πρότυπο του double-door)

Για **ΚΑΘΕ** νέο kind, άγγιξε ΑΥΤΑ (αλλιώς ο tsc σπάει στα exhaustive maps — καλό safety net):

1. **`bim/types/opening-types.ts`** — `OpeningKind` union + `OPENING_KIND_DEFAULTS` (W×H×sill) +
   predicates. **ΠΡΟΣΘΕΣΕ νέα SSoT predicates** όπου ταιριάζει: `isSlidingKind`
   (sliding-door/double-sliding-door/pocket-door/sliding-window/double-hung-window),
   `isFoldingKind` (bifold-door). Επέκτεινε `isGlazedKind` με ΟΛΑ τα window families
   (double-hung/sliding-window/awning/hopper/tilt-turn/bay). `isDoubleLeafKind` μένει
   (french/double-door)· τα συρόμενα-διπλά είναι ξεχωριστό predicate.
2. **`bim/types/opening.schemas.ts`** — `OpeningKindSchema` z.enum member.
3. **`bim/types/opening-operation-types.ts`** — `DEFAULT_OPERATION_BY_KIND` entry (exhaustive) +
   αν χρειάζεται handing variant στο `resolveOperationType` (π.χ. pocket SLIDING_TO_LEFT/RIGHT).
4. **`bim/geometry/opening-geometry.ts`** — **νέοι 2D plan builders** (pure):
   - `buildSlidingPlan` (διπλό/pocket — rails + panel offset· pocket = dashed in-wall extension)
   - `buildFoldingPlan` (bifold — zig-zag V points)
   - `buildRevolvingPlan` (κύκλος + 4 ακτίνες)
   - `buildSashOpeningMark` (awning ▲ / hopper ▼ / tilt-turn L — μικρό triangle/L στο glazing)
   - `buildSlidingArrow` (double-hung ↕ / sliding-window ↔)
   - `bay-window`: projecting outline (ίσως επέκταση `computeOpeningGeometry` με depth param).
   Κράτα τα <40 γρ· αν το αρχείο πλησιάζει 500 γρ → split σε `opening-plan-builders.ts`.
5. **`bim/renderers/OpeningRenderer.ts`** — ⚠️ **ΑΥΤΗ ΤΗ ΦΟΡΑ ΧΡΕΙΑΖΕΤΑΙ EDITS** (νέα overlays):
   `drawKindOverlay` branches + `openingOutlineSubcat`/`openingOverlaySubcat` νέες κατηγορίες
   (sliding-double/pocket/folding/revolving/sash-mark/bay). **CHECK 6D BLOCKING → STAGE ADR-040**
   (ή σχετικό doc) στο ίδιο commit, αλλιώς το pre-commit hook μπλοκάρει.
6. **`bim/renderers/opening-kind-style.ts`** — `OPENING_KIND_STROKE` (exhaustive).
7. **`bim/walls/opening-ghost-renderer.ts`** — `KIND_STROKE` + `KIND_FILL` (exhaustive).
8. **`hooks/tools/useOpeningGhostPreview.ts`** — ghost overlay per νέο kind (αν διαφέρει).
9. **`services/factories/opening.factory.ts`** — `inferOpeningIfcType`: windows
   (double-hung/sliding-window/awning/hopper/tilt-turn/bay) → **IfcWindow**· doors → IfcDoor.
10. **`bim-3d/converters/opening-mesh.ts`** — **3D mesh variants** ανά kind (sliding offset, folding
    σε γωνία, sectional slats, revolving κύλινδρος+4 φύλλα, sash, bay projecting). Κράτα <500 γρ →
    αν μεγαλώσει, split σε `opening-mesh-builders.ts` (per-kind helpers).
11. **`ui/ribbon/data/contextual-opening-tab.ts`** — `OPENING_KIND_OPTIONS` entry.
12. **i18n el+en** — `ribbon.commands.openingEditor.kind.<camelKey>` (`dxf-viewer-shell.json`) +
    `opening.tag.prefix.<kind>` (`dxf-viewer.json`). **N.11: keys ΠΡΩΤΑ, μηδέν hardcoded.**
13. **`ui/components/bim-openings/RenumberOpeningsHost.tsx`** — `kindPrefixes` (exhaustive) +
    **`bim/services/__tests__/opening-renumber-service.test.ts`** `KIND_PREFIXES` fixture.
14. **`bim/schedule/schedule-presets.ts`** — `openingKindToScheduleType` (doors→'door', windows→'window').
15. **`bim/config/bim-to-atoe-mapping.ts`** — `OPENING_MAPPING` (exhaustive· OIK-5.01 doors / 5.02 windows).
16. **Tests** ανά kind: geometry symbol + IFC operation default + ifcType + schedule routing +
    opening-mesh smoke (σωστός αριθμός children).

**EXHAUSTIVE `Record<OpeningKind,…>` maps (ο tsc τα δείχνει ΟΛΑ — μηδέν ξεχασμένο):**
`OPENING_KIND_DEFAULTS`, `OPENING_KIND_STROKE`, ghost `KIND_STROKE`/`KIND_FILL`,
`OPENING_MAPPING`, `kindPrefixes` (host + test fixture), `DEFAULT_OPERATION_BY_KIND`.

**ΚΛΗΡΟΝΟΜΟΥΝΤΑΙ ΔΩΡΕΑΝ (ΟΧΙ αλλαγή):** 6 grips (footprint-driven), wall-cut (kind-agnostic
cutout), mark service/allocator (dynamic i18n prefix), firestore, BOQ grouper, PDF exporter,
operationType auto-fill στο factory.

---

## 4. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ ΑΠΟ ΤΟ SLICE A (διάβασέ τα — είναι το πρότυπο)

| Concern | Αρχείο |
|---|---|
| IFC operation SSoT | `bim/types/opening-operation-types.ts` (enums + DEFAULT_OPERATION_BY_KIND + resolveOperationType) |
| Types/predicates | `bim/types/opening-types.ts` (`isHingedKind`/`isGlazedKind`/`isDoubleLeafKind`, OPENING_KIND_DEFAULTS) |
| zod | `bim/types/opening.schemas.ts` (OpeningKindSchema, OpeningOperationTypeSchema, operationType) |
| 2D geometry | `bim/geometry/opening-geometry.ts` (`buildHingeArc` dual-leaf, `buildOutline`, walk helpers) |
| 2D render | `bim/renderers/OpeningRenderer.ts` (`drawKindOverlay`, subcat helpers) + `opening-kind-style.ts` |
| **3D mesh (πρότυπο)** | `bim-3d/converters/opening-mesh.ts` (`buildOpeningMesh`: basis/frameBars/leafPanels· scene-units convention) + wiring `BimToThreeConverter.ts` (`attachOpeningMeshes`) |
| factory/IFC | `services/factories/opening.factory.ts` (operationType auto-fill, inferOpeningIfcType) |
| ribbon | `ui/ribbon/data/contextual-opening-tab.ts` (OPENING_KIND_OPTIONS) |
| mark/schedule/BOQ | `RenumberOpeningsHost.tsx` (kindPrefixes), `schedule-presets.ts`, `bim-to-atoe-mapping.ts` |
| tests πρότυπα | `__tests__/opening.factory.test.ts`, `bim/types/__tests__/opening-operation-types.test.ts`, `bim-3d/converters/__tests__/opening-mesh.test.ts` |

**Scene-units convention 3D (ΚΡΙΣΙΜΟ, ίδιο με `wall-opening-extrude.ts`):** οριζόντια = `mm × mmFactor`
(scene-units ως meters)· κατακόρυφα (sill/height) = `mm × 0.001` (meters)· placement = `geometry.position`
(scene-units ως meters), `floorY = floorElevationMm×0.001 + buildingBaseElevationM`. Material ids:
`mat-wood` (κάσα/φύλλο), `mat-glass` (υαλοστάσιο) — `getMaterial3D` fallback σε mat-concrete αν λείπει.

---

## 5. ΚΑΝΟΝΕΣ ΠΟΙΟΤΗΤΑΣ (GOL + SSOT — Revit-grade)
- Μηδέν `any`/`as any`/`@ts-ignore`· μηδέν inline styles· μηδέν hardcoded strings (i18n-first, N.11).
- <500 γρ/αρχείο, <40 γρ/function (split builders σε ξεχωριστά modules αν χρειαστεί).
- **FULL SSOT**: νέα predicate (`isSlidingKind`/`isFoldingKind`) μία φορά, reuse σε geometry+render+3D.
  ΜΗΝ κάνεις copy-paste branch σε 3 αρχεία — φτιάξε predicate.
- **ADR-040 (CHECK 6D)**: ο `OpeningRenderer` ΘΑ αλλάξει στο SLICE B → **stage ADR-040** (ή ADR-363/421).
- tsc background + tests ανά batch. Γνωστά pre-existing tsc errors (ΟΧΙ δικά σου): `mesh-to-object3d.ts:124`,
  `DeleteEntityCommand.ts:52` ('roof'), `drawing-preview-generator.ts:116` ('floor-finish'),
  `apply-entity-preview.ts:316` (readonly tuple).
- **ΟΧΙ commit/push** (κοινό tree). `git add` ΜΟΝΟ δικά σου αρχεία όταν στήσεις — αλλά commit ο Giorgio.

---

## 6. SLICE C (ΜΕΤΑ — ΜΗΝ το κάνεις τώρα) — ADR-412 opening Family/Type (Model B)

Ο πλήρης χάρτης wiring υπάρχει στο memory + ADR. Περίληψη (~18 αρχεία, μηδέν fork — το ADR-412
service/store/resolve είναι generic):
- `bim-family-type.ts`: `OpeningTypeParams` + entry στο `BimTypeParamsByCategory`.
- `bim-family-type.schemas.ts`: `OpeningTypeParamsSchema` + branch στο `BimFamilyTypeSchema` discriminatedUnion.
- `bim-family-type-service.ts`: `schemaByCategory.opening`.
- `resolve-effective-params.ts`: `resolveEffectiveOpeningParams`.
- `opening-types.ts` `OpeningEntity`: `typeId?` + `typeOverrides?: Partial<OpeningTypeParams>`.
- 3 commands (Assign/Update/Delete OpeningType) + `useOpeningFamilyTypeController` + 2 ribbon widgets.
- `useFamilyTypeBoqRefeed.ts` guard branch + `family-type-side-effects.ts` opening variant.
- Firestore rules/audit route/enterprise-id: **καμία αλλαγή** (generic).

---

## 7. PROMPT ΓΙΑ ΤΗ ΝΕΑ ΣΥΝΕΔΡΙΑ (σου το δίνει ο Giorgio)

Δες το μήνυμα copy-paste που έδωσε ο agent μετά από αυτό το handoff.

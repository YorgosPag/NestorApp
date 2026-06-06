# HANDOFF — Auto-Type-On-Create (Revit «Generic Wall») για BIM τοίχους

**Ημερομηνία:** 2026-06-06
**Subapp:** `http://localhost:3000/dxf/viewer`
**ADR:** ADR-412 (BIM Family Types) + ADR-414 (Wall Type live preview) + ADR-363 (BIM drawing)
**Εντολή Giorgio:** Υλοποίηση **FULL ENTERPRISE + FULL SSOT**, «όπως οι μεγάλοι (Revit)».
**Mode:** Ξεκίνα σε **Plan Mode** (αρχιτεκτονική απόφαση + 5+ αρχεία/2 domains).
**⚠️ Working tree SHARED με άλλον agent** — μόνο στοχευμένα αρχεία, ΟΧΙ `git add -A`.
**⚠️ COMMIT: ο Giorgio, ΟΧΙ εσύ.** Καμία αυτόματη commit/push.
**Γλώσσα απαντήσεων: Ελληνικά πάντα.**

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (root cause — επιβεβαιωμένο από ανάγνωση κώδικα)

Η εντολή **«Τοίχος σε περιοχή (4 γραμμές)»** (και κάθε manual τοίχος με explicit πάχος)
παράγει τοίχους **untyped / ad-hoc** (χωρίς `typeId`, χωρίς `dna`). Συνέπειες:

1. Πολλοί τοίχοι **ίδιου πάχους** είναι **ασύνδετες** ad-hoc οντότητες.
2. Δεν εμφανίζεται κουμπί «Edit Type» (self-hides για untyped) → **καμία μαζική
   ενημέρωση στρώσεων**. Αλλάζεις στρώσεις σε έναν → instance-level edit
   (`UpdateWallParamsCommand`) → αλλάζει **μόνο αυτός**.
3. Σπάει το θεμελιώδες μοντέλο «type always wins» του ADR-412.

**Γιατί βγαίνουν untyped (η αλυσίδα):**
- `wall-in-region.ts:261` → `buildWallFillingRect` υπολογίζει `thicknessMm`
  **γεωμετρικά** από τη μικρή πλευρά του ορθογωνίου → το περνά ως **explicit
  `thickness` override**.
- `wall-completion.ts:95-96` → explicit thickness ⇒ `dna = null` (manual wall).
- `wall-type-auto-assign.ts:51` → `resolveAutoWallTypeId`: `if (!params.dna) return undefined`
  ⇒ **κανένα `typeId`**.

Το αυθαίρετο πάχος (π.χ. 187mm) σχεδόν ποτέ δεν πέφτει στο category default,
οπότε ακόμη και η non-destructive λογική δεν θα τους έδινε ποτέ built-in type.

## 2. ΤΙ ΚΑΝΕΙ ΤΟ REVIT (το πρότυπο-στόχος)

- **Δεν υπάρχει τοίχος χωρίς τύπο. Ποτέ.** Κάθε wall instance ανήκει σε Wall Type
  από τη στιγμή της δημιουργίας.
- Η δομή στρώσεων (structure/layers) είναι **αποκλειστικά type-level**. Το instance
  κρατά μόνο γεωμετρία/θέση.
- Αυθαίρετο πάχος ⇒ **«Generic - {X}mm»** type (single-layer "Generic" structure).
  Δύο τοίχοι ίδιου πάχους ⇒ **αυτόματα ίδιος τύπος** ⇒ Edit Type μία φορά ⇒ re-flow
  σε όλους.
- Το σχόλιο `wall-completion.ts:90` λέει «Revit Generic Wall pattern» αλλά
  δανειστήκαμε το ΟΝΟΜΑ, όχι τη συμπεριφορά (στο Revit το Generic Wall ΕΙΝΑΙ τύπος).

## 3. ΣΤΟΧΟΣ ΥΛΟΠΟΙΗΣΗΣ

Auto-type-on-create: κάθε νέος τοίχος (region/manual/2-click) με πάχος X που δεν
ταιριάζει σε built-in να αποκτά **deterministic, κοινό** «Generic - {category} - {X}mm»
τύπο. Έτσι: ίδιο πάχος ⇒ ίδιος τύπος ⇒ μαζική ενημέρωση στρώσεων «σαν Revit».
Παραμένει **non-destructive** (ο τύπος προκύπτει ΑΠΟ τον τοίχο, δεν τον επιβάλλει).

## 4. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ (insertion points, με γραμμές)

| Αρχείο | Ρόλος | Γραμμές-κλειδιά |
|---|---|---|
| `bim/family-types/built-in-types.ts` | Built-in catalog (code constants, μη-persisted). `getBuiltInWallTypeId` deterministic id pattern `bimftype-builtin-wall-{category}`. **Πρότυπο για τους auto-types.** | 58, 67-69, 104-135 |
| `bim/family-types/wall-type-auto-assign.ts` | SSoT auto-assign (τρέχει σε creation ΚΑΙ load). Εδώ μπαίνει η νέα λογική «αν δεν ταιριάζει built-in → auto Generic type». | 46-56 |
| `hooks/drawing/wall-completion.ts` | `buildWallEntity` καλεί `resolveAutoWallTypeId` (γρ. 204). `buildDefaultWallParams` αποφασίζει dna=null όταν explicit thickness (γρ. 93-96, 119). | 76-120, 181-206 |
| `bim/walls/wall-in-region.ts` | Region builder. `buildWallFillingRect` δίνει explicit thickness (γρ. 261-269). | 237-270 |
| `hooks/drawing/use-wall-commit.ts` | Καλεί `buildWallFillingRect` (γρ. 206) + `buildWallEntity` (2-click γρ. 84). **Insertion point για το commit-time side-effect αν επιλεγεί persisted.** | 84, 206 |
| `bim/family-types/bim-family-type-store.ts` | Zustand store. `setTypes` merge-άρει built-ins+Firestore. Resolution via `getType(id)` + `version`. **Εδώ θα ζουν οι synthetic auto-types αν επιλεγεί code-generated.** | 50-68 |
| `bim/family-types/bim-family-type-service.ts` | Firestore CRUD. `saveType` → `generateBimFamilyTypeId()` (RANDOM enterprise id, ΟΧΙ deterministic). Path: `companies/{companyId}/bim_family_types/{typeId}`. | 254-296 |
| `core/commands/entity-commands/AssignWallTypeCommand.ts` | Undoable type-link + re-resolve geometry. | όλο |
| `ui/ribbon/components/RibbonWallTypePropertiesWidget.tsx` | «Edit Type» UI — **self-hides για untyped** (γρ. 14, 103). | 51-103 |
| `ui/wall-advanced-panel/sections/WallDnaEditor.tsx` | Layer editor (instance + type consumers). | 11-12 |
| `services/enterprise-id.service.ts` | `generateBimFamilyTypeId` (random). Built-ins ΔΕΝ το χρησιμοποιούν (deterministic strings). | 93 |

Πού φορτώνονται/merge οι built-ins στο store: `useBimFamilyTypes.ts` (sole writer) +
`getAllBuiltInTypes(companyId)` (`built-in-types.ts:321-330`).

## 5. ΑΠΟΦΑΣΕΙΣ ΠΟΥ ΧΡΕΙΑΖΟΝΤΑΙ ΑΠΟ ΤΟΝ GIORGIO (ρώτα με AskUserQuestion σε Plan Mode)

### Q1 — Φύση του auto-type: synthetic (code) vs persisted (Firestore);
- **A. Synthetic deterministic** (όπως built-ins): id `bimftype-auto-wall-{category}-{Xmm}`,
  code-generated, μη-persisted, μπαίνει στο store. ✅ Μηδέν Firestore στη δημιουργία,
  μηδέν race, καθαρό SSOT, deterministic. ⚠️ Πρέπει ο generator να παράγει auto-types
  για τα distinct (category,thickness) των φορτωμένων τοίχων (derive-from-scene).
- **B. Persisted find-or-create** στο commit: πιο Revit-true (άμεσα επεξεργάσιμος),
  αλλά async side-effect σε τώρα-pure path + κίνδυνος duplicate writes σε batch +
  shared tree. Χρειάζεται idempotent signature lookup.
- **C. Υβριδικό (προτεινόμενο):** synthetic deterministic εξαρχής (μηδέν write) +
  **promote-on-edit** → την 1η φορά που ο χρήστης κάνει Edit Type σε auto-type, γίνεται
  persisted user type (`saveType`) και re-link όλων των instances με το ίδιο auto-id.

### Q2 — Granularity: ανά πάχος μόνο («Generic - 200mm») ή ανά category+πάχος;
(Revit: ο τύπος ορίζει το πάχος μέσω structure. Πιθανώς signature = category + thickness,
ή πλήρες DNA signature.)

### Q3 — Read-only auto-type + Duplicate-to-edit, ή απευθείας επεξεργάσιμος;
(Συνδέεται με Q1: αν read-only χάνεται το «ένα edit για όλους»· το C το λύνει με promote.)

### Q4 — Generic DNA από αυθαίρετο πάχος: χρειάζεται helper
`buildGenericWallDna(thicknessMm)` → single core layer, generic material. **SSoT στο
`wall-dna-types.ts`** δίπλα στο `getDefaultDnaForCategory`. Επιβεβαίωσε material/naming.

### Q5 — Migration υπαρχόντων untyped τοίχων: το `resolveAutoWallTypeId` τρέχει ΗΔΗ
στο load path (`wall-persistence-helpers.ts docToEntity`). Επέκταση ⇒ οι παλιοί
αποθηκευμένοι τοίχοι αυτο-typάρονται στο άνοιγμα. Non-destructive (ίδια γεωμετρία). OK;

### Q6 — i18n naming: `builtin.wall.*` υπάρχει. Νέο `auto.wall.generic` με interpolation
πάχους; (Προσοχή N.11: zero hardcoded strings, keys σε el+en JSON πρώτα.)

## 6. ΠΕΡΙΟΡΙΣΜΟΙ / ΚΑΝΟΝΕΣ (μη παραβιάσιμα)

- **FULL SSOT:** μηδέν fork. Deterministic id helper όπως `getBuiltInWallTypeId`
  (ΟΧΙ random `generateBimFamilyTypeId` για synthetic). Generic DNA = ΕΝΑΣ helper.
- **Non-destructive lock (Giorgio, ADR-412/414):** ο auto-type προκύπτει από τον τοίχο,
  resolution δεν αλλάζει γεωμετρία (effective params == cached params on assign).
- **N.6 enterprise-id:** persisted types (αν Q1=B/C-promote) μέσω `saveType` + `setDoc`.
  Synthetic types ΔΕΝ persist-άρονται (όπως built-ins).
- **ADR-040:** το family-type store ΔΕΝ είναι canvas high-freq store → κανονικά εκτός,
  αλλά αν αγγίξεις canvas drawing files (renderers/DxfRenderer/CanvasSection κλπ) →
  CHECK 6B/6D απαιτούν staged ADR. Πιθανότατα ΔΕΝ χρειάζεται.
- **Tests (Google presubmit):** νέα tests για auto-assign + generic-dna + (αν persisted)
  side-effects. Πρότυπα: `wall-type-auto-assign.test.ts`, `built-in-types.test.ts`,
  `family-type-side-effects.test.ts`.
- **N.15:** μετά την υλοποίηση → update `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-412 changelog
  (ΟΧΙ adr-index — shared tree· συνεννόηση). ΟΛΑ στο ίδιο commit (που κάνει ο Giorgio).
- **tsc:** background, non-blocking. Pre-existing error `mesh-to-object3d:124` ΔΕΝ είναι δικό σου.

## 7. ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΟΥ SESSION

1. Μπες **Plan Mode**.
2. Διάβασε ADR-412 (`docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md`)
   + ADR-414. **Code = source of truth** (ADRs ίσως stale → φέρε τις σε συμφωνία).
3. Διάβασε ξανά τα 4 core αρχεία της §4 (wall-type-auto-assign, wall-completion,
   wall-in-region, bim-family-type-store) για να επιβεβαιώσεις ότι τίποτα δεν άλλαξε
   (shared tree!).
4. **AskUserQuestion** τα Q1-Q6 της §5 (ειδικά Q1 = αρχιτεκτονικό κλειδί).
5. Σχεδίασε & δώσε ExitPlanMode για έγκριση πριν γράψεις κώδικα.

## 8. STATUS QUO (επιβεβαιωμένα γεγονότα)

- 5 built-in wall types (1/category: exterior, interior, partition, parapet, fence) —
  `built-in-types.ts:96-102`. Code constants, μη-persisted, read-only, Duplicate-to-edit.
- Region/manual walls → πάντα untyped (η αλυσίδα της §1).
- 2-click walls → typed ΜΟΝΟ αν thickness+dna == category default (αλλιώς untyped).
- Type edits re-flow σε instances με ίδιο `typeId` μέσω store `version` + re-resolution.
- ΚΑΝΕΝΑΣ τύπος δεν δημιουργείται αυτόματα σήμερα — μόνο χειροκίνητο Duplicate-to-edit.

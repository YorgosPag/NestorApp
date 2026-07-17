# ADR-670 — Το commit path των BIM tools γράφει `levelId` στο `layerId`

**Status:** **ΑΝΟΙΧΤΟ** — διάγνωση τεκμηριωμένη (§2)· η απόφαση «ποιο layer» **ΕΚΚΡΕΜΕΙ** (§5, Q1)· καμία γραμμή κώδικα δεν έχει αλλάξει
**Ημερομηνία:** 2026-07-17
**Σχετικά:** ADR-420 (`floorId` = config scope, όχι input), ADR-659 (selection cycling popover — η αφορμή),
ADR-484 (cross-level foundations), CLAUDE.md N.0.2 / N.7.2 / N.12

---

## 1. Η αφορμή

> «Στην εικόνα υπάρχει κτίριο με δύο πλάκες η μία πάνω από την άλλη. Όταν πατάω διπλό κλικ μου δείχνει
> ποιες πλάκες υπάρχουν για να τις επιλέξω, αλλά δεν καταλαβαίνω τι να επιλέξω γιατί π.χ. δεν εμφανίζεται
> πλάκα οροφής ή πλάκα δαπέδου.» — Giorgio, 2026-07-17

Το popover (ADR-659) έδειχνε δύο **πανομοιότυπες** γραμμές:

```
Slab  lvl_bae98ab6-9544-4514-841e-e00328ec02fe  …s04b3
Slab  lvl_bae98ab6-9544-4514-841e-e00328ec02fe  …1cb36
```

Το αίτημα του Giorgio (σημασιολογικές ετικέτες) λύνεται αλλού — είναι **Domain A**, ανεξάρτητο.
Αυτό το ADR αφορά **τι αποκάλυψε** η μεσαία στήλη: το `lvl_…` **δεν είναι όνομα layer**.

## 2. Το εύρημα (μετρημένο με grep, όχι εικασία)

`hooks/drawing/useSlabTool.ts:142`:

```ts
const result = buildSlabEntity(params, currentLevelId);
//                                     ^^^^^^^^^^^^^^ η υπογραφή ζητά layerId
```

Η `buildSlabEntity(params, layerId)` (`slab-completion.ts:144`) περιμένει **`lyr_<uuid>`** —
το `BaseEntity.layerId` (`types/base-entity.ts:105`) το τεκμηριώνει ρητά ως *"stable layer identifier
`lyr_<UUID-v4>`. Required on all entities."* Ο caller περνάει **`lvl_<uuid>`**.

### 2.1 Δεν είναι slab-only — είναι συστημικό

**16 call sites σε 12 αρχεία** (μετρημένα 2026-07-17 με
`grep -rnE "build[A-Za-z]+Entity\([^)]*currentLevelId" hooks/drawing/`):

| Αρχείο | Call sites | Entity |
|---|---|---|
| `use-wall-commit.ts` | 3 (145, 185, 269) | wall (straight/curved/polyline) |
| `use-beam-commit.ts` | 3 (101, 120, 218) | beam |
| `column-commit-build.ts` | 1 (75) | column |
| `useFoundationTool.ts` | 1 (283) | foundation |
| `useSlabTool.ts` | 1 (142) | slab |
| `useOpeningTool.ts` | 1 (160) | opening |
| `useSlabOpeningTool.ts` | 1 (168) | slab-opening |
| `useStairTool.ts` | 1 (150) | stair |
| `use-stair-region-sketch.ts` | 1 (81) | stair (region) |
| `useRailingTool.ts` | 1 (122) | railing |
| `useThermalSpaceTool.ts` | 1 (143) | thermal-space |
| `useWallCoveringTool.ts` | 1 (177) | wall-covering |

⚠️ **`roof`**: το `useRoofTool.ts:59` προωθεί `currentLevelId` ως option προς το `roof-completion.ts`
(που δηλώνει σε σχόλιο ότι είναι *clone* του `slab-completion.ts`). **ΔΕΝ επαληθεύτηκε** αν καταλήγει
στο ίδιο μοτίβο — να ελεγχθεί πριν την υλοποίηση.

### 2.2 Η απόδειξη ότι είναι BUG και όχι σύμβαση

Μέσα στο **ίδιο module family**, το **preview path** το κάνει **σωστά**:

```ts
// column-preview-helpers.ts:165,198 · beam-preview-helpers.ts:161,224
// foundation-preview-helpers.ts:66,137,187 · slab-preview-helpers.ts:37,53
buildColumnEntity(sized, getDefaultLayerId(), sceneUnits)   // ← σωστό lyr_
```

ενώ το **commit path** του ίδιου εργαλείου περνά `currentLevelId`.

> **Δύο code paths του ίδιου feature διαφωνούν.** Το ghost που βλέπεις πριν το κλικ και η οντότητα
> που αποθηκεύεται μετά το κλικ **δεν συμφωνούν στο layerId**. Αυτό είναι υπογραφή copy-paste λάθους
> (ίδιο σχήμα με το incident του N.0.2: `renderGrips()` σε 7 renderers), όχι σχεδιαστικής απόφασης.
> Κανένα σχόλιο/ADR δεν το τεκμηριώνει ως πρόθεση.

### 2.3 Το level-membership ΔΕΝ περνά από το `layerId` — άρα δεν σπάει

Grep για `layerId ===` σε όλο το subapp (40+ hits): **καμία** σύγκριση `layerId` έναντι level/storey.
Ο πραγματικός μηχανισμός «σε ποιον όροφο ανήκει» είναι **δύο, ανεξάρτητοι** από το `layerId`:

1. **Δομικά** — κάθε `Level` έχει δικό του `LevelScene.entities[]`· το `appendEntityToScene()` γράφει
   στο scene του `currentLevelId`.
2. **Persistence** — `BaseEntity.floorId`, γραμμένο από τον persistence hook
   (`create-bim-entity-persistence-hook.ts:150-165`, `bim/persistence/bim-floor-scope.ts`), **όχι** από το tool.
   ADR-420: *"floorId is owned by config scope, not input."*

Το `SlabParams.storeyId` («semantic alias») **δεν γράφεται ποτέ** από το slab tool· οι δύο readers
(`bim-floor-utils.ts:85,127`, `exposed-slab-classifier.ts:66`) κάνουν `params.storeyId ?? entity.floorId`
→ στην πράξη διαβάζεται πάντα το `floorId`.

**Συμπέρασμα:** το `layerId` δεν ήταν ποτέ υποψήφιος μηχανισμός level-membership. Η διόρθωση δεν
απειλεί το φιλτράρισμα ανά όροφο. Ούτε το DXF export (`export/core/dxf-category-layers.ts` re-layer-άρει
τα BIM bodies ανά `EntityType` — αγνοεί το `entity.layerId`).

## 3. Η σημερινή, πραγματική συνέπεια

Ο μοναδικός γνήσιος reader του `entity.layerId` ως **layer** είναι το
`canvas-v2/dxf-canvas/dxf-entity-layer-skip.ts:66-78` — η SSoT gate που αποφασίζει αν σχεδιάζεται μια
οντότητα (Canvas2D **και** WebGL):

```ts
const storeLayer = entity.layerId ? getLayerStoreLayer(entity.layerId) : null;
if (storeLayer) return storeLayer.frozen === true || storeLayer.visible === false;
```

Το `layersById` περιέχει **μόνο** πραγματικά `SceneLayer` (`lyr_…`). Επειδή κανένα BIM entity δεν έχει
ποτέ `lyr_` id, το lookup **αποτυγχάνει πάντα** →

> **Σήμερα, τα «κρύψε/πάγωσε layer» και «color-by-layer» ΔΕΝ έχουν καμία επίδραση σε κανένα BIM entity.**
> Είναι de facto νεκρός κώδικας για ολόκληρο το BIM subsystem.

## 4. Τι κάνουν οι μεγάλοι

- **AutoCAD**: κάθε οντότητα ανήκει σε **layer**· το layer είναι ορθογώνιο προς τη θέση της.
- **Revit**: δεν υπάρχει layer — υπάρχει **Category** (Walls/Floors/Columns), και η ορατότητα ελέγχεται
  per-view μέσω Visibility/Graphics **ανά category**. Το «όροφος» (Level) είναι **άλλος, ανεξάρτητος** άξονας.

**Και στα δύο, «πού είναι» και «τι είναι» είναι ξεχωριστοί άξονες.** Το σημερινό `layerId = levelId`
τους συγχέει: χρησιμοποιεί τον άξονα «τι είναι» για να αποθηκεύσει «πού είναι» — ενώ το «πού είναι»
είναι **ήδη** σωστά αποθηκευμένο αλλού (§2.3). Δηλαδή η τιμή είναι **και λάθος, και περιττή**.

## 5. Ανοιχτά ερωτήματα — ΧΡΕΙΑΖΟΝΤΑΙ ΑΠΟΦΑΣΗ ΠΡΙΝ ΤΗΝ ΥΛΟΠΟΙΗΣΗ

### Q1 — Σε ποιο layer πρέπει να μπουν τα BIM entities; ⬅ **ΤΟ ΚΡΙΣΙΜΟ**

| Επιλογή | Υπέρ | Κατά |
|---|---|---|
| **A. Default layer «0»** (`getDefaultLayerId()`) | Ό,τι κάνει ήδη το preview → μηδενική ασυμμετρία· ελάχιστο diff | **Όλο το κτίριο σε ΕΝΑ layer.** Κρύβεις το «0» → εξαφανίζεται τα πάντα. Το «κρύψε τους τοίχους» παραμένει αδύνατο |
| **B. Layer ανά τύπο** (SLABS/WALLS/COLUMNS…) | Ταιριάζει με το Revit category model **και** με ό,τι ήδη κάνει το DXF export· επιτρέπει «κρύψε όλους τους τοίχους» | Μεγαλύτερη αλλαγή· ποιος δημιουργεί τα layers και πότε; τι γίνεται σε imported DXF με δικά του layers; |
| **C. Το τρέχον layer του χρήστη** (`currentLayerId ?? default`) | Συμπεριφορά AutoCAD | Ο χρήστης σχεδιάζει BIM χωρίς να σκέφτεται layers → απρόβλεπτη διασπορά |

⚠️ **ΠΡΟΣΟΧΗ — αλλαγή συμπεριφοράς, όχι δωρεάν βελτίωση.** Όποια κι αν είναι η επιλογή, η διόρθωση
**ενεργοποιεί** το freeze/hide για τα BIM entities (§3). Αυτό είναι το *σωστό*, αλλά σημαίνει ότι σε
**υπάρχοντα σχέδια** μια ενέργεια που σήμερα δεν κάνει τίποτα, αύριο θα κρύβει κτίρια. Με την **επιλογή A**
αυτό γίνεται με **μία** κίνηση σε **ένα** layer. Δεν είναι λόγος να μην το κάνουμε — είναι λόγος να το
**αποφασίσουμε**, όχι να το ανακαλύψουμε σε production.

### Q2 — Migration υπαρχόντων δεδομένων

Στη Firestore **υπάρχουν ήδη** BIM docs με `layerId: 'lvl_…'` (`slab-firestore-service.ts:180` σώζει ό,τι
του δοθεί — **δεν υπάρχει** validation προθέματος στον factory/validator). Δεν βρέθηκε υπάρχον migration
tooling για BIM collections (το `services/dxf-scene-migration.ts` αφορά raw DXF scene layers).

Απαιτείται one-off script σε ~12 collections: `WHERE layerId LIKE 'lvl_%'` → set/delete.
**ΔΕΝ επαληθεύτηκε** αν υπάρχει admin script runner εκτός subapp που θα το αναλάμβανε.

### Q3 — Guard ώστε να μην επανέλθει

Το `layerId` δεν έχει validation προθέματος πουθενά. Πρόταση: runtime guard στον base factory
(`assembleBimEntity`) που απορρίπτει `layerId` χωρίς `lyr_` prefix + pre-commit ratchet.
**Χωρίς guard, η κατηγορία bug θα ξαναπεράσει** — το απέδειξε ήδη 16 φορές.

## 6. Γιατί κανένα gate δεν το είδε

| Gate | Γιατί ήταν τυφλό |
|---|---|
| **TypeScript** | Και τα δύο ids είναι `string`. Δεν υπάρχουν branded types (`LayerId`/`LevelId`) → ο compiler δεν έχει τι να συγκρίνει |
| **CHECK 3.29** (dxf tsc) | Ίδιος λόγος — δεν είναι type error |
| **CHECK 3.18** (`ssot:discover`) | name/regex-based· σαρώνει μόνο `src/config\|utils\|lib` σε `-maxdepth 1` → **δεν ανοίγει ποτέ** το `src/subapps` |
| **CHECK 3.28** (jscpd) | Θα έπιανε το copy-paste **token-based**, αλλά είναι `--diff` (same-commit) και οι κλώνοι είναι **προϋπάρχοντες** → μέσα στο baseline |

**Το κενό**: `layerId: string` και `levelId: string` είναι ο ίδιος τύπος για τον compiler.
**Branded types θα το είχαν κάνει αδύνατο** — αξίζει να εξεταστεί στο Q3.

## 7. Απόφαση

**ΚΑΜΙΑ ΑΚΟΜΑ.** Η διάγνωση είναι τεκμηριωμένη· το Q1 χρειάζεται απόφαση Giorgio. Καταγράφεται
τώρα ώστε το εύρημα να μη χαθεί (N.0.2: μεγάλο duplicate → τεκμηρίωσέ το άμεσα).

**Ρητά ΕΚΤΟΣ αυτού του ADR** (ανεξάρτητο, προχωρά κανονικά): οι σημασιολογικές ετικέτες του popover
(Domain A) — «Πλάκα δαπέδου 150 mm +3.00». Δεν εξαρτάται από το `layerId`: το popover απλώς **παύει**
να δείχνει τη μεσαία στήλη.

## 8. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-17 | Δημιουργία. Διάγνωση από ερώτημα Giorgio για το popover (§1). Εύρος μετρημένο με grep: 16 call sites / 12 αρχεία (§2.1). Απόδειξη preview≠commit (§2.2). Επιβεβαίωση ότι το level-membership δεν κινδυνεύει (§2.3). Q1 (ποιο layer) ανοιχτό. |

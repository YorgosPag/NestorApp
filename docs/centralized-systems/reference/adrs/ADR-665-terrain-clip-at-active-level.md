# ADR-665: Κοπή Αναγλύφου στη Στάθμη Ενεργού Ορόφου — Per-Scope Clipping Planes

## Status
🔵 **PROPOSED — 2026-07-16** · 🟢 **M2 IMPLEMENTED — 2026-07-28** (§M2: η τομή απέκτησε poché χώματος, **χωρίς** stencil) — Το τοπογραφικό ανάγλυφο στο 3Δ κόβεται αυτόματα από οριζόντιο επίπεδο στο υψόμετρο του **ενεργού ορόφου**· το κτίριο **δεν** κόβεται ποτέ από αυτό το επίπεδο. Εισάγει τον κανόνα ότι τα clipping planes είναι **per-scope** (`'default'` | `'topo'`) — αλλαγή συμβολαίου για κάθε consumer του `applyClippingPlanes`. Διορθώνει παράλληλα υπαρκτό bug: οι ισοϋψείς (`LineSegments`) δεν κόβονταν **ποτέ** από καμία τομή.

**Related:**
- **ADR-452** (Οριζόντια Τομή / View Range 3Δ) — **ο ιδιοκτήτης των clip planes**. Το `SectionSceneController` παραμένει ο μοναδικός ιδιοκτήτης· εδώ αποκτά δεύτερο scope. Ο τύπος `computeCutPlaneWorldY` και οι σταθερές (`CUT_PLANE_KEEP_EPSILON_M`) επαναχρησιμοποιούνται αυτούσιοι. **Το συμβόλαιο του `applyClippingPlanes` αλλάζει εδώ** → pointer entry στο ADR-452.
- **ADR-455** (Κατακόρυφες Τομές X/Y) — ο composer (`composeCutEntries` / `composeClipPlanes` / `axisCutCompositionKey`, `MAX_CLIP_PLANES = 6`) επαναχρησιμοποιείται **αυτούσιος**. Η κοπή του εδάφους μοντελοποιείται σκόπιμα ως `ResolvedAxisCut{axis:'z'}` ακριβώς για να μη γραφτεί δεύτερη λογική σύνθεσης.
- **ADR-650** (Τοπογραφικές Αποτυπώσεις & Ισοϋψείς) — ο ιδιοκτήτης του *pipeline δεδομένων* (points → TIN → contours). Το M4 έφερε το ανάγλυφο στο 3Δ, το M10d τις draped ισοϋψείς + διαφάνειες. Εδώ **δεν** αλλάζει τίποτα στο pipeline — μόνο η προβολή. Pointer entry στο ADR-650.
- **ADR-399** (Scope «Όλοι οι όροφοι») — το προηγούμενο για το γιατί το `'all'` scope μηδενίζει το FFL offset· το ακολουθούμε: σε `'all'` **καμία** κοπή.
- **ADR-040** (Canvas Performance / micro-leaf) — τα topo scene layers είναι imperative, zero React state. Διατηρείται: το `reapplyClipPlanesUnder` είναι σύγχρονο και subtree-scoped.
- **ADR-662** (Μετάβαση Τοπογραφικού → Ribbon) — εκεί ζουν τα ribbon toggles (`contextual-topo-surface-tab.ts`) που επεκτείνονται εδώ.
- **CLAUDE.md N.18 / ADR-584** — τα δύο terrain layers είναι δομικά αδέρφια· `jscpd:diff` πριν το «done».

---

## Context

### Το περιστατικό (Giorgio, 2026-07-16)

Ο Giorgio άνοιξε το 3Δ σε τρεις ορόφους διαδοχικά:

| Όροφος | Τι είδε |
|---|---|
| **Θεμελίωση** | Ανάγλυφο + ισοϋψείς — σωστό, θέλεις να δεις πού σκάβεις |
| **Ισόγειο** | Ανάγλυφο + κάτοψη — οριακά χρήσιμο |
| **1ος Όροφος** | **Μόνο χώμα.** Το κτίριο θαμμένο. Μηδενική χρησιμότητα |

Η ερώτηση ήταν αρχιτεκτονική, όχι bug report: *«είναι σωστό να εμφανίζονται τα ανάγλυφα σε όλα τα επίπεδα στο 3Δ; Τι κάνουν οι μεγάλοι παίκτες; Θα μπορεί να εργάζεται σωστά ένας μηχανικός στον 1ο όροφο;»*

### Τι κάνουν οι μεγάλοι παίκτες

| Λογισμικό | Μοντέλο |
|---|---|
| **Revit** | Το Toposolid ανήκει σε Level (συνήθως το χαμηλότερο), αλλά **η 3Δ όψη δεν είναι ποτέ level-scoped**. Ελέγχεται από **Visibility/Graphics → κατηγορία Topography** + **Section Box** για κοπή. Το View Range κόβει σε **κάτοψη**, όχι σε 3Δ. |
| **ArchiCAD** | Το Mesh ζει στο «Site» story· στο 3D Window ελέγχεται από **3D Filter / Marquee**, όχι από ορόφους. |
| **Civil 3D** | Surface Styles — απόκρυψη triangles / διατήρηση contours ανά όψη. |

**Ο κοινός κανόνας: το ανάγλυφο ΔΕΝ ελέγχεται από τα checkbox των ορόφων. Ελέγχεται από κατηγορία ορατότητας + κοπή.** Ο όροφος στο 3Δ σημαίνει «κόψε την κάμερα εκεί», όχι «φιλτράρισε αντικείμενα».

### Τι ισχύει σήμερα στον κώδικα — η αρχιτεκτονική είναι ήδη σωστή

Ο έλεγχος επιβεβαίωσε ότι **η ορατότητα του αναγλύφου δεν είναι — και σωστά δεν πρέπει να είναι — συζευγμένη με τον όροφο**:

- Τα roots `'topo-terrain'` / `'topo-contours'` προσαρτώνται **απευθείας στο `scene`**, αδέρφια του `bimLayer.group` (`scene-manager-construct.ts:134,139`). Το `applyFloorVisibility` διατρέχει **μόνο** τα `bimLayer.group.children` και φιλτράρει με `userData.levelId` — τα terrain meshes δεν έχουν ποτέ `levelId`, άρα δεν τα αγγίζει.
- Το `Terrain3DState` δεν έχει πεδίο ορόφου. Ένα global flag για όλο το έργο.
- Το `TerrainContourLayer` γράφει ρητά στο docblock ότι φτιάχτηκε ακριβώς για να **διορθώσει** το per-floor στοίβαγμα («οι ΙΔΙΕΣ ισοϋψείς ξανασχεδιάζονταν σε κάθε όροφο και στοιβάζονταν σε σκάλα»).

Άρα το «εμφανίζεται σε όλα τα επίπεδα» **είναι σωστό** και δεν αλλάζει. Το πρόβλημα είναι ότι **τίποτα δεν το κόβει**.

### Το πραγματικό κενό

Το πλήρες 3Δ clipping υπάρχει ήδη (ADR-452/455) και το terrain mesh **είναι ήδη clippable** (`MeshStandardMaterial` / `MeshBasicMaterial`, εντός allowlist). Αλλά:

1. **Το `resolveCutPlaneWorldY()` επιστρέφει `null` όταν `!rs.cutPlaneActive`** — ο χρήστης πρέπει να ενεργοποιήσει χειροκίνητα την τομή. Στα στιγμιότυπα ήταν σβηστή → χώμα παντού.
2. **Η τομή του ADR-452 κόβει ΚΑΙ το κτίριο.** Ο Giorgio θέλει το κτίριο **ακέραιο** και μόνο το χώμα κομμένο — δηλαδή **διαφορετικά planes ανά scope**, κάτι που ο applicator δεν μπορεί να εκφράσει.
3. **Οι ισοϋψείς δεν κόβονται ΠΟΤΕ** (bug): ο applicator ξεκινά με `if (!(obj as THREE.Mesh).isMesh) return;` και οι ισοϋψείς είναι `LineSegments`. Με οποιαδήποτε ενεργή τομή, οι πορτοκαλί γραμμές **αιωρούνται άκοπες στον αέρα** πάνω από το κομμένο χώμα.

---

## Decision

**Το ανάγλυφο κόβεται αυτόματα από οριζόντιο επίπεδο στο FFL του ενεργού ορόφου. Το κτίριο δεν κόβεται ποτέ από αυτό το επίπεδο.**

Κάτω από το επίπεδο το χώμα μένει — στη «Θεμελίωση» βλέπεις τα πέδιλα μέσα στο έδαφος, που είναι ακριβώς η χρήσιμη άποψη. Πάνω από αυτό κόβεται.

Απόφαση Giorgio μεταξύ τριών εναλλακτικών (αυτόματη απόκρυψη / αυτόματη διαφάνεια / κοπή): **κοπή**, ως το μόνο Revit-grade.

### Δ1 — Ο applicator γίνεται **scope-aware** (ΟΧΙ resolver callback)

```ts
export type ClipScope = 'default' | 'topo';
export type ScopeClipPlanes = Readonly<Record<ClipScope, THREE.Plane[] | null>>;
export function applyClippingPlanes(root: THREE.Object3D, planes: ScopeClipPlanes): void;
```

Το `seatTopoLayerRoot` σφραγίζει `root.userData['topoClipScope'] = true`· ο applicator κάνει explicit recursive `walk(obj, scope)` που **κληρονομεί** το scope προς τα κάτω.

**Γιατί marker και όχι name-matching:** τα ονόματα (`'topo-terrain'`) είναι καλλωπιστικά και θα έσπαγαν σιωπηλά σε μετονομασία.

**Γιατί κληρονομιά και όχι `(obj) => Plane[]` callback:** ένα callback σημαίνει closure invocation + ancestor walk ανά αντικείμενο. Η κληρονομιά είναι O(n) χωρίς parent walks, και το `Record` είναι memoisable + τετριμμένα unit-testable.

**Ο `root` μπορεί να είναι όλο το scene ή ένα μόνο layer root** — αυτό είναι που επιτρέπει το `reapplyClipPlanesUnder` (Δ4).

### Δ2 — Το allowlist γίνεται **per-scope** — το κρίσιμο σημείο

| Scope | Allowlist |
|---|---|
| `'default'` | Σημερινό mesh-only — **byte-for-byte αμετάβλητο** |
| `'topo'` | mesh allowlist **+ `LineBasicMaterial` + `LineDashedMaterial`** |

**Γιατί όχι global:** το `bim-3d/` έχει ~20 χρήστες `LineBasicMaterial` (gizmo handles, `Dimension3DRenderer`, `FocusOutlineRenderer`, `TempAlignmentLineOverlay`, `DxfToThreeConverter`, διαγράμματα). Global allowlisting θα άρχιζε **σιωπηλά** να τα κόβει όλα. Το per-scope allowlist διορθώνει το bug των ισοϋψών **ακριβώς εκεί που υπάρχει** και δεν αγγίζει τίποτε άλλο.

Το fat-line `LineMaterial` μένει εξαιρεμένο **σε κάθε scope** (τεκμηριωμένο shader compile failure σε αυτό το build). Τα `LineSegments2`/`Line2` επεκτείνουν `Mesh` στο three.js → πιάνονταν ήδη από το `isMesh` και εξαιρούνται μέσω του type allowlist· η προσθήκη `isLine` **δεν** τα επαναφέρει.

### Δ3 — Terrain-exclusive materials (το three.js clipping είναι **per-material**)

`getTerrainMaterial3D('shaded')` → `withFaceMode(mat)` → σε faceMode `'none'`/`'hidden-line'` επέστρεφε **shared singletons που κρατάει κάθε BIM mesh**. Γράψιμο `clippingPlanes` εκεί **θα έκοβε το κτίριο** — ακριβώς η απαίτηση που παραβιάζεται.

**Απόφαση:** το terrain **συνεχίζει να τιμά το `faceMode` όπως σήμερα**, αλλά παίρνει **πάντα αποκλειστικά instances** (`withTerrainFaceMode` + `TERRAIN_FACE_CACHE`) με byte-identical παραμέτρους → **μηδενική οπτική αλλαγή**, μόνο άλλη ταυτότητα instance.

Δεν ξανανοίγουμε κλεισμένη οπτική απόφαση («πρέπει μια data surface να τιμά τον άξονα FACES;») μέσα σε ένα clipping fix. Αν ο Giorgio το θελήσει αργότερα, είναι μονόγραμμη αλλαγή στο `withTerrainFaceMode` + δικό του milestone.

`getConsistentVariant` είναι **ασφαλές** — cache με κλειδί `base.uuid`, και το terrain base (`elem-terrain:shaded`) είναι ήδη αποκλειστικό. Άρα 2 περιπτώσεις, όχι 3.

### Δ4 — Ο controller παραμένει ο **μοναδικός** ιδιοκτήτης

Τα topo layers **δεν** γράφουν ποτέ `clippingPlanes` πίσω από την πλάτη του controller — αυτό θα έσπαγε και το SSoT και το fast path. Αντ' αυτού:

```ts
reapplyClipPlanesUnder(root: THREE.Object3D): void   // «ξανά-βεβαίωσε την κατάστασή σου σε αυτό το subtree»
```

Το layer **κατέχει τη γεωμετρία του**, ο controller **κατέχει τα planes**· το layer λέει μόνο «έκανα rebuild». Απαραίτητο επειδή ένα φρέσκο material ξεκινά με `clippingPlanes = null` και **τίποτε άλλο δεν θα τα ξαναβάλει** (ο controller δεν ακούει το `TopoPointStore`, άρα μια επεξεργασία αποτύπωσης είναι αόρατη γι' αυτόν).

Σύγχρονο + subtree-scoped ⇒ κανένα subscription-order race, καμία scene-wide `needsUpdate` καταιγίδα.

**Πού ζει το `onRebuilt` (2026-07-17):** στην **`TopoSceneLayer`** — την abstract βάση στο `topo-scene-layer-support.ts` που κληρονομούν **και τα δύο** topo layers (`TerrainSceneLayer`, `TerrainContourLayer`). Η βάση κατέχει ολόκληρο τον κύκλο ζωής: seating, subscriptions, visibility gate, `rebuild()` → `rebuildGeometry()` → `onRebuilt(root)`, `sameInputs()`, `dispose()`. Τα subclasses δίνουν **μόνο** ό,τι διαφέρει πραγματικά — παραγωγή περιεχομένου + απελευθέρωσή του.

Αυτό είναι το σημείο που η re-assertion **δεν μπορεί να ξεχαστεί**: υπάρχει **ένα** `rebuild()` σε όλη την ιεραρχία, άρα κανένα μελλοντικό exit path κανενός layer δεν γίνεται να παρακάμψει το `onRebuilt`. Πρώτη υλοποίηση την έγραψε ως **twin** και στα δύο layers — το CHECK 3.28 (jscpd, ADR-584/N.18) το έκοψε στο commit, σωστά: δύο αντίγραφα ενός invariant ασφαλείας είναι ακριβώς ο μηχανισμός που σαπίζει.

⚠️ Τα subclasses καλούν `this.start()` ως **τελευταία** εντολή του constructor τους, ποτέ η βάση: ένα build από τον constructor της βάσης θα έτρεχε **πριν** τους field initializers του subclass, που θα έσβηναν αμέσως μετά την κατάσταση που μόλις παρήγαγε.

### Δ5 — Fast path: **η αλλαγή ορόφου είναι δωρεάν**

Το `clipCompositionKey` κωδικοποιεί την **παρουσία** της terrain τομής (`|tc0`/`|tc1`), **όχι** τη θέση της. Αλλαγή ορόφου = ίδιο composition, άλλο constant → **χτυπάει το fast path** → mutate `plane.constant` in place, **χωρίς** per-mesh `needsUpdate` (η τεκμηριωμένη 50-157ms RAF jank του ADR-452).

Ο controller ήδη ακούει `useActiveStoreyStore`. Προστίθενται `useViewMode3DStore` (floor3DScope) και **`subscribeTerrain3D`** — το terrain store είναι vanilla `createExternalStore`, **ΟΧΙ** zustand, και δεν το άκουγε κανείς· χωρίς αυτό το toggle δεν θα πυροδοτούσε τίποτα.

### Δ6 — Η κοπή ως `ResolvedAxisCut`

```ts
export function resolveTerrainCut(): ResolvedAxisCut | null;  // { axis: 'z', worldCoordM, sign: 1 }
```

Σκόπιμα στο σχήμα του ADR-455 ώστε `composeCutEntries` / `composeClipPlanes` / `axisCutCompositionKey` να ισχύουν **αυτούσια**. **Μηδέν νέα λογική σύνθεσης.**

Το `terrainPlanes = composeClipPlanes([terrainPlane, ...cutPlanes], cachedPlanes, cropPlanes)` — **terrain πρώτο**, ώστε να επιβιώνει του σκληρού ορίου των 6 planes ακόμα και κάτω από πλήρες 6-plane section box.

### Δ7 — Ο τύπος

```
worldY = computeCutPlaneWorldY(floorElevationMm, 0, buildingBaseElevationM) + CUT_PLANE_KEEP_EPSILON_M
```

`cutPlaneMm = 0` επειδή **η τομή ΕΙΝΑΙ η στάθμη** (όχι offset από αυτήν). Το ε (1mm) είναι η **υπάρχουσα** σταθερά του ADR-452, που γίνεται `export` — **όχι** δεύτερη σταθερά 1mm. Ίδιο σκεπτικό: οικόπεδο διαμορφωμένο ακριβώς στο FFL θα τρεμόπαιζε στο `dot == 0`.

---

## Δ8 — Φ2: Clip Scope Guard (2026-07-28)

### Ο κίνδυνος που το Δ2 δημιούργησε και δεν είχε όργανο

Το Δ2 έκανε το `LineBasicMaterial` clippable **μόνο** στο `'topo'` — και το scope
**κληρονομείται προς τα κάτω** (Δ1). Τα δύο μαζί δίνουν μια σιωπηλή αστοχία: **αρκεί ένα
υποδέντρο να βρεθεί κάτω από topo root για να αρχίσει να κόβεται από την κοπή του εδάφους.**
Ο ίδιος ο applicator το γράφει ρητά — «~20 άλλοι `LineBasicMaterial` καταναλωτές … 
**`DxfToThreeConverter`** … a global allowlist would silently start clipping every one of them».

Ο κίνδυνος ήταν δηλαδή **ήδη γνωστός και γραμμένος**· αυτό που έλειπε ήταν όργανο που να τον
**πιάνει όταν συμβεί**. Ένα σχόλιο δεν είναι δικλείδα.

### Γιατί η ζημιά είναι δυσανάλογη με το μέγεθος του λάθους

Το υπόστρωμα DXF περνά από **GPU clipping**· τα Canvas2D overlays (λαβές, hover, επιλογή,
HUD) **όχι** — προβάλλονται από τον `screen-projection-clip.ts` (ADR-717). Άρα μια διαρροή
scope εμφανίζεται ως: **το 2Δ σχέδιο κόβεται σε μια ζώνη της οθόνης ενώ οι κίτρινες γραμμές
επιλογής συνεχίζουν κανονικά**. Η ασυμμετρία μοιάζει με σφάλμα **προβολής** και στέλνει τη
διάγνωση στο near/far plane — που είναι λάθος δρόμος (βλ. handoff: για κάμερα που κοιτά προς
τα κάτω, το far κόβει την **κορυφή** της οθόνης, ποτέ τη βάση).

### Η απόφαση

Ένα υποδέντρο μπορεί να **κλειδώσει** το scope του (`lockClipScope`, `userData['clipScopeLock']`)
— καθρέφτης του `seatTopoLayerRoot`: εκεί ένα root **δηλώνει** scope, εδώ **απαιτεί** scope. Ο
`walk` κουβαλά το κλείδωμα δίπλα στο scope· διαφορά ⇒ καταγραφή στον `clip-scope-guard`.

**Λύνει την ΚΛΑΣΗ, όχι το δείγμα**: ο φύλακας δεν ξέρει τίποτα για DXF. Οποιοδήποτε υποδέντρο
(gizmo, dimensions, focus outline, diagrams) μπορεί να κλειδωθεί με την ίδια μία γραμμή.

### Τι ΔΕΝ κάνει — σκόπιμα

**Παρατηρεί· δεν επιβάλλει.** Το resolved scope εξακολουθεί να κυβερνά, άρα η συμπεριφορά είναι
**αμετάβλητη** (κλειδωμένο με test). Δύο λόγοι: (α) το σφάλμα που το γέννησε είναι **διαλείπον
και μη επιβεβαιωμένο** — επιβολή χωρίς αναπαραγωγή είναι μαντεψιά· (β) η επιβολή θα μπορούσε να
ακυρώσει μελλοντική *σκόπιμη* απόθεση σχεδίου πάνω σε έδαφος. **Η προαγωγή σε επιβολή είναι
ξεχωριστή απόφαση, ΜΕΤΑ από επιβεβαιωμένη αναπαραγωγή.**

### Κόστος

Μία ανάγνωση `userData` + μία σύγκριση ανά σχεδιάσιμο, **μόνο** όταν αλλάζει το set των planes —
**ποτέ ανά καρέ**. Η ακριβή δουλειά (διαδρομή, μήνυμα) γίνεται μόνο πάνω σε διαρροή. Console
warn **μία φορά ανά υπογραφή** (ένα drag του slider ξανα-εφαρμόζει συνεχώς). Δακτύλιος 64
εγγραφών + `window.__bim3dClipGuard.dump() / .download() / .reset()` — ίδιο μοτίβο με το
`bim3d-perf-diag`, γιατί ένα διαλείπον σφάλμα **δεν πιάνεται με χειροκίνητο capture**: ο
δακτύλιος γεμίζει μόνος του και κατεβαίνει **μετά** το συμβάν.

---

## Αποφάσεις ορίων

### «Όλοι οι όροφοι» → **καμία κοπή**

`computeTerrainClipWorldY` επιστρέφει `null` όταν `allFloors`.

1. Δεν υπάρχει ενεργή στάθμη — «το υψόμετρο του ενεργού ορόφου» είναι απροσδιόριστο.
2. Το `resolveCutPlaneWorldY` **ήδη** μηδενίζει το FFL offset σε αυτό το scope (ADR-399), ακριβώς επειδή το active-storey frame είναι εκεί χωρίς νόημα.
3. Σημασιολογικά «Όλοι οι όροφοι» **είναι** η άποψη οικοπέδου: ολόκληρο κτίριο + ολόκληρο έδαφος είναι ακριβώς αυτό που θέλει ο μηχανικός. Κοπή του λόφου στο FFL του ισογείου ενώ φαίνονται τρεις όροφοι από πάνω θα ήταν αυθαίρετη.
4. Δίνει στον χρήστη escape hatch μηδενικού κόστους που **υπάρχει ήδη** στο UI.

### Default `autoClipAtActiveLevel: true`

1. Το `visible` είναι **ήδη `false` by default** → η default *αποδιδόμενη* σκηνή μένει byte-identical με σήμερα. **Τίποτα δεν αλλάζει σιωπηλά.**
2. Το αναφερθέν ελάττωμα είναι «ο μηχανικός στον 1ο όροφο βλέπει μόνο χώμα» — το άκοπο ανάγλυφο δεν είναι feature που επέλεξε κανείς.
3. Opt-out = ένα κλικ. Opt-in-σε-χαλασμένη-άποψη = support ticket.

### **ΟΧΙ** stencil cap στην v1 — η τομή θα είναι κούφια

1. **Κόστος.** Το `renderAxisCutCap` ξανα-αποδίδει όλη τη BIM σκηνή `2×(1+N_χρωμάτων)` φορές/frame, και η ενεργοποίηση σημαίνει flip του `isStencilActive()` → **όλη η σκηνή** παρακάμπτει το SSAO/EffectComposer pipeline. Ένα *display toggle* («δείξε το ανάγλυφο») που υποβαθμίζει σιωπηλά το render path όλου του viewport είναι απαράδεκτη ανταλλαγή.
2. **Η ανησυχία «χαρτί» είναι υπερβολική εδώ.** Το `getTerrainMaterial3D` αποδίδει **ήδη** κάθε style `DoubleSide` (σκόπιμα — ανοιχτό TIN). Κομμένο έδαφος δείχνει την **κάτω επιφάνειά** του, όχι διάτρητο κενό. Διαβάζεται ως κέλυφος, όχι ως λεπίδα.
3. **Το σωστό cap δεν είναι αυτό το cap.** Μια Revit-grade τομή χώματος θέλει **poché με διαγράμμιση**· ο `SectionStencilRenderer` είναι χτισμένος γύρω από BIM per-material colour passes → θα έβγαζε γκρι πλάκα, όχι χώμα.

→ **ADR-665 M2**, με δικό του perf budget. **Η v1 στέλνει κούφια (double-sided) τομή εδάφους.**

---

# M2 — Poché χώματος στην τομή του εδάφους

**Status M2:** 🟢 **IMPLEMENTED — 2026-07-28**. Το blueprint γράφτηκε πρώτο (N.0.1 Φάση 1) και
υλοποιήθηκε **χωρίς απόκλιση** από τις αποφάσεις του· τα δύο σημεία που άλλαξαν στην πορεία (και τα
δύο προς το αυστηρότερο) είναι σημειωμένα στο M2.12.

Η v1 έστειλε κούφια τομή. Ο μηχανικός βλέπει την **κάτω επιφάνεια** του TIN, δηλαδή κέλυφος —
όχι **χώμα**. Το M2 κλείνει αυτό, **χωρίς** να χαλαρώσει καμία από τις τρεις ενστάσεις της v1.

## M2.0 — Γιατί οι τρεις ενστάσεις της v1 απλώς **δεν ισχύουν** εδώ

Και οι τρεις (§«ΟΧΙ stencil cap στην v1») είναι ενστάσεις κατά **του stencil**, όχι κατά **του cap**:

| Ένσταση v1 | Γιατί εξαφανίζεται |
|---|---|
| «`renderAxisCutCap` ξανα-αποδίδει τη σκηνή `2×(1+N)` φορές/frame» | Δεν υπάρχει render pass. Ο cap είναι **γεωμετρία** — κόστος όταν αλλάξει η στάθμη, **μηδέν** ανά καρέ. |
| «flip του `isStencilActive()` ⇒ όλο το viewport χάνει SSAO/EffectComposer» | Το `isStencilActive()` διαβάζει `combinedPlanes`, που **δεν** περιέχει το terrain plane. Μένει `false`. **Καμία γραμμή του δεν αλλάζει στο M2.** |
| «ο stencil renderer είναι BIM per-material colour passes → γκρι πλάκα» | Ο cap παίρνει **δικό του** υλικό με το αρχιτεκτονικό σύμβολο χώματος, world-space κλίμακα. |

Το stencil χρειάζεται όταν **δεν ξέρεις το σχήμα της τομής** (αυθαίρετο κλειστό στερεό). Εδώ το
ξέρουμε **αναλυτικά**: οριζόντιο επίπεδο σε γνωστό `worldY` × **height field** (ένα Z ανά ΧΥ).

🔴 **Ο `SectionStencilRenderer` ΔΕΝ ενεργοποιείται για το έδαφος. Αν κάποιος μελλοντικά νομίσει
ότι χρειάζεται, η απάντηση είναι «όχι — διάβασε το M2.1», όχι «ενεργοποίησέ τον».**

## M2.1 — Ο αλγόριθμος: per-triangle half-space clip (ΟΧΙ ισοϋψής + CDT)

Η προφανής λύση — «βγάλε την ισοϋψή στο υψόμετρο κοπής, κλείσ' την με την περίμετρο,
τριγωνοποίησε με CDT» — είναι **λάθος**, με τρεις ανεξάρτητες πηγές σφάλματος:

1. η ισοϋψής **δεν κλείνει** όταν τερματίζει στην περίμετρο του TIN (ανοιχτός δακτύλιος)·
2. τρύπες vs νησίδες απαιτούν σωστό winding — και η αλυσοποίηση γίνεται σε **μη-προσανατολισμένες**
   ακμές, οπότε το πρόσημο του shoelace **δεν** μπορεί να τα ξεχωρίσει (το ίδιο επιχείρημα με το
   `topo-surface-area`, ADR-662 §12)·
3. το CDT είναι τρίτη τριγωνοποίηση δίπλα σε αυτήν που ήδη έχουμε.

**Η σωστή:** κόψε **κάθε τρίγωνο του TIN χωριστά** με το ημιεπίπεδο. Το βαθμωτό πεδίο είναι
`f = elevation − levelElevMm`· κρατάμε το **ΠΑΝΩ** μέρος (`f ≥ 0`), γιατί αυτό είναι το χώμα που
αφαιρέθηκε — και η οριζόντια προβολή του **είναι** η επιφάνεια της τομής:

> cap = { (x,y) : z_TIN(x,y) ≥ levelZ }, προβεβλημένο στο `z = levelZ`.

Ένα τρίγωνο κομμένο από ημιεπίπεδο δίνει **0, 3 ή 4** κορυφές, πάντα **κυρτό** ⇒ fan-triangulation
είναι εξ ορισμού σωστή. **Μηδέν chaining, μηδέν CDT, μηδέν ανοιχτοί δακτύλιοι, σωστό εξ ορισμού
σε τρύπες και σε πολλαπλά νησιά** (κάθε νησί συνεισφέρει τα δικά του τρίγωνα· δεν χρειάζεται
κανείς να ξέρει ότι είναι νησί).

**Ο κόφτης ΥΠΑΡΧΕΙ ΗΔΗ** (N.18): `cut-fill-geometry.clipToSign` — Sutherland–Hodgman **σε βαθμωτό
πεδίο** (όχι σε clip edge), γραμμένος για τη «γραμμή daylight» του cut/fill. Το πεδίο μας είναι
`elev − levelZ` αντί για `Δz` — **ίδια ερώτηση, άλλο πεδίο**. Άρα γενικεύεται (M2.2), δεν
ξαναγράφεται.

### Εναλλακτική που εξετάστηκε και απορρίφθηκε: **clamp του πεδίου** (Houdini `HeightField Clip`)

Το height-field-native αντίστοιχο θα ήταν `z' = min(z, levelZ)` — το πλάτωμα *γίνεται* ο cap,
watertight εξ ορισμού, χωρίς δεύτερο mesh. **Απορρίπτεται** για δύο λόγους:
(α) για να μην παραμορφωθούν τα τρίγωνα που διασχίζουν τη στάθμη χρειάζεται **ακριβώς το ίδιο**
per-triangle split — άρα είναι ο ίδιος αλγόριθμος **συν** επανατριγωνοποίηση του κάτω μέρους·
(β) το πλάτωμα θα ήταν συνεχές με την επιφάνεια, με το **ίδιο** υλικό και τα ίδια vertex colours
(υψομετρική ράμπα) — δηλαδή θα έχανε ακριβώς αυτό που θέλουμε: ότι η τομή είναι **χώμα**, όχι
συνέχεια της ανάλυσης. Καταγράφεται εδώ ώστε να μην ξανα-προταθεί.

### GPU-side εναλλακτική

Η βιβλιογραφία («An Efficient Geometric Algorithm for Clipping and Capping Solid Triangle Meshes»,
SciTePress 2017) κάνει το clip στη GPU και **επιστρέφει τις ακμές τομής στη CPU** για να χτίσει
τον cap — δηλαδή το ακριβό μέρος (ο cap) μένει CPU ούτως ή άλλως, και προϋποθέτει **κλειστό
manifold στερεό**, που το TIN δεν είναι. Για ένα height field με ~10⁴ τρίγωνα και συχνότητα
ανοικοδόμησης **«όταν αλλάξει ο όροφος»**, ένα readback ανά rebuild είναι καθαρή ζημιά.
**Απορρίπτεται τεκμηριωμένα**, όχι από άγνοια.

## M2.2 — SSoT: ο κόφτης γενικεύεται, δεν αντιγράφεται

Νέο καθαρό module `systems/topography/planar-scalar-clip.ts`:

```ts
export function clipPolygonAtScalarZero<TVertex extends Point2D>(
  polygon: readonly TVertex[],
  sign: 1 | -1,
  fieldOf: (v: TVertex) => number,
  atCrossing: (p: Point2D) => TVertex,
): TVertex[];
```

Το `cut-fill-geometry.clipToSign` γίνεται **thin adapter** πάνω του (`fieldOf: v => v.dz`,
`atCrossing: p => ({...p, dz: 0})`), οπότε υπάρχει **ένα** αντίγραφο του αλγορίθμου. Ο generic
τύπος + τα δύο callbacks αποφεύγουν κάθε ενδιάμεση κατανομή αντικειμένων — ο cut/fill τρέχει
αυτόν τον βρόχο **ανά τρίγωνο**, δεν αντέχει adapter που κάνει `map()`.

Το «σημείο στο μηδέν» εξακολουθεί να έρχεται από το **`marching-triangles.crossEdge`** — την ίδια
γραμμική παρεμβολή που ρωτά ο εξαγωγέας ισοϋψών. Τρίτη πηγή lerp δεν υπάρχει.

**Επαναχρησιμοποιούνται αυτούσια** (κανένα δεν ξαναγράφεται): `getTopoSurface` (η ΜΙΑ TIN) ·
`crossEdge` · `polygonArea` · `getActiveWorldToDisplayProjector` (ADR-650 §M10f — **υποχρεωτική**
γέφυρα για ό,τι κάθεται στη σκηνή) · `getActiveVerticalDatumMm` · `TERRAIN_DISPLAY_DROP_MM` ·
`resolveTerrainClipWorldY` · `planMmToWorld` · `TopoSceneLayer` · `disposeObjectTree` ·
το σύστημα hatch του `section-hatch-cap`.

## M2.3 — Πού είναι η στάθμη, σε **υψόμετρο επιφάνειας** (η αντιστροφή που ξεχνιέται)

Το `resolveTerrainClipWorldY()` δίνει **three-world Y σε μέτρα**. Το πεδίο του TIN είναι
**WORLD canonical mm υψόμετρο**. Ανάμεσά τους στέκονται δύο display μετασχηματισμοί:

```
worldY(m) = (elevMm − datumMm)/1000 − TERRAIN_DISPLAY_DROP_MM/1000
⇒ levelElevMm = worldY·1000 + TERRAIN_DISPLAY_DROP_MM + datumMm
```

Το `TERRAIN_DISPLAY_DROP_MM` (50 mm, ADR-650 M10d) **μετράει**: ο λόφος σχεδιάζεται 5 cm
χαμηλότερα, άρα το επίπεδο τον κόβει 5 cm **ψηλότερα** σε όρους αποτύπωσης. Παράλειψή του =
ο cap ξεκολλά από την ακμή της τομής κατά 5 cm. Ζει ως καθαρή, testable συνάρτηση στο
`terrain-clip-math.ts` — δίπλα στο `computeTerrainClipWorldY`, όχι σε δεύτερο σπίτι.

Οι **κορυφές** του cap γράφονται σε world Y = `clipWorldY` **ακριβώς** — δηλαδή ο cap **δεν**
παίρνει το drop. Σωστό, γιατί το drop είναι ήδη ενσωματωμένο στη θέση όπου το επίπεδο κόβει το
ανάγλυφο (το ίδιο το `seatTopoLayerRoot` το τεκμηριώνει: «A plane at world-Y = FFL cuts at
world-Y = FFL»). Ο cap συναντά την κομμένη ακμή σε **μία καμπύλη**, όχι σε επιφάνεια ⇒ κανένα
z-fighting.

## M2.4 — Το υλικό: **ένα νέο `earth` key**, όχι δεύτερο σύστημα hatch

Το `section-hatch-cap.ts` είναι ήδη πλήρες σύστημα poché (`rc`/`steel`/`masonry`/`wood`/
`insulation`) με `CanvasTexture` ανά υλικό. Το M2 προσθέτει **key `earth`** — τίποτε άλλο.

⚠️ **Παγίδα που εντοπίστηκε στον audit:** το `getHatchCapMaterial()` επιστρέφει **stencil** cap
material (`createCutCapMaterial`, `NotEqual(0)→Replace`, `depthTest:false`). Είναι **άχρηστο για
πραγματική γεωμετρία**. Άρα το επαναχρησιμοποιήσιμο SSoT είναι η **υφή**, όχι το υλικό:
`getSectionHatchTexture(key)` γίνεται export και το `earth` υλικό χτίζεται στο
`terrain-materials-3d.ts`, όπου ζουν **όλα** τα υλικά του εδάφους.

Το `earth` **δεν** επιστρέφεται ποτέ από το `resolveHatchKey` (κανένα prefix υλικού δεν το δείχνει),
άρα καμία stencil διαδρομή δεν το αγγίζει — και το `setHatchRepeat`, που **μεταλλάσσει κοινή υφή**
ανά καρέ, δεν το πειράζει ποτέ.

**Το σύμβολο:** το αρχιτεκτονικό «φυσικό έδαφος» — ομάδες κοντών παράλληλων γραμμών στις 45°,
εναλλάξ κατεύθυνσης σε πλέγμα (η ύφανση του AutoCAD `EARTH` / BS 1192, η καθιερωμένη ελληνική &
γερμανική πρακτική για αδιατάρακτο έδαφος σε τομή). Φόντο: **ο τόνος του ίδιου του εδάφους** —
`MATERIAL_DEFS['elem-terrain'].color` μέσω του `trueColorToHex`, **παραγόμενο, όχι αντιγραμμένο**·
η τομή είναι το **ίδιο** χώμα με τον λόφο, όχι ουδέτερο γκρι.

**Άφωτο (`MeshBasicMaterial`) + `DoubleSide`**, για τους δύο λόγους που το ADR έχει **ήδη**
αποφασίσει για τις styles ανάλυσης (`terrain-materials-3d`): (α) το poché είναι **σχεδιαστική
σύμβαση**, πρέπει να διαβάζεται αληθινά ανεξάρτητα από τον φωτισμό· (β) η τεκμηριωμένη παγίδα M10c
— φωτισμένο υλικό στην επιφάνεια αποτύπωσης βγήκε **κατάμαυρο** έξω από το frustum του σκιόφωτος.
`DoubleSide` γιατί η κάμερα κατεβαίνει κάτω από την τομή. `depthTest` **μένει true** — αλλιώς ο cap
θα ζωγράφιζε πάνω από το κτίριο. Η διαφάνεια ακολουθεί το `surfaceOpacity[style]` του εδάφους μέσω
του υπάρχοντος `applyTerrainOpacity`: διάφανος λόφος με αδιαφανή τομή διαβάζεται λάθος.

**Το hatch σε world-space, μέσω ψημένων UV** — όχι `texture.repeat`. Ο cap γράφει
`uv = (x_world_m / TILE_M, z_world_m / TILE_M)` στη γεωμετρία του. Δύο κέρδη έναντι του
`setHatchRepeat`: (α) η διαγράμμιση **δεν κολυμπά** στο zoom και δεν εξαρτάται από το μέγεθος του
bbox — αληθινή προβολή κατόψεως, ακριβώς το παράπονο των χρηστών σε screen-space poché· (β) καμία
μετάλλαξη κοινής υφής ⇒ καμία σύγκρουση με τα stencil passes που τη μεταλλάσσουν ανά καρέ.

## M2.5 — Πού κρεμιέται: **τρίτο αδερφάκι** `TerrainCutCapLayer`

Νέο `TopoSceneLayer<TerrainCapInputs>`, δίπλα στο `TerrainSceneLayer` και το `TerrainContourLayer`.
Κριτήριο (όπως ζητήθηκε): **τα inputs**. Ο cap εξαρτάται από το `resolveTerrainClipWorldY()` —
ενεργός όροφος + `floor3DScope` — που **κανένα** από τα άλλα δύο δεν ακούει. Το `sameInputs()`
είναι key-driven, οπότε το `levelWorldY` μπαίνει ως κανονικό input χωρίς καμία αλλαγή στη βάση.

Επιπλέον συνδρομές (πάνω από τις κοινές survey/visibility/geo-ref): `useActiveStoreyStore`,
`useViewMode3DStore`. Ο visibility gate της βάσης δίνει **δωρεάν** το «κρυμμένο ανάγλυφο ⇒ κανένας
cap». `levelWorldY === null` (allFloors / `autoClip=false`) ⇒ κανένας cap, από τον ίδιο δρόμο.

## M2.6 — 🔴 Το λεπτότερο σημείο: **ποιο επίπεδο κόβει τον cap**

Ο cap **ΔΕΝ** πρέπει να κόβεται από το επίπεδο που τον γέννησε (κάθεται ακριβώς πάνω του ⇒
`dot ≈ 0` ⇒ θα αυτοεξαφανιζόταν), αλλά **ΠΡΕΠΕΙ** να κόβεται από section box / axis cuts / crop.

Αυτό το σύνολο planes **υπάρχει ήδη και έχει όνομα**: είναι ακριβώς το `combinedPlanes`, δηλαδή το
scope **`'default'`**:

```
terrainPlanes = compose([terrainPlane, ...cutPlanes], cached, crop)   ← ο ΛΟΦΟΣ
combinedPlanes = compose([            ...cutPlanes], cached, crop)   ← το ΚΤΙΡΙΟ **και ο CAP**
```

⇒ **Κανένα τρίτο scope, καμία νέα λογική σύνθεσης, καμία γραμμή στον `SectionSceneController`.**
Ο κανόνας διατυπώνεται καθαρά: *«είμαι η επιφάνεια που παρήγαγε η τομή του εδάφους· η τομή που με
έφτιαξε δεν με τρώει, κάθε τομή του κτιρίου με κόβει.»*

Ο marker γίνεται **τρικατάστατος** στο `section-clip-applicator.scopeOf`:
`true → 'topo'` · `false → 'default'` (ρητό reset) · `undefined → κληρονομιά`. Το
`seatTopoLayerRoot` δέχεται το scope ως παράμετρο (default `'topo'`, ώστε τα δύο υπάρχοντα layers
να μείνουν byte-for-byte). Ρητό `false` αντί για «απλώς μην σφραγίσεις»: αν κάποιος αύριο βάλει
τον cap κάτω από topo root, η δρομολόγηση **δεν** αλλάζει σιωπηλά.

## M2.7 — Stencil parity (κλείνει το Open Question #2 για meshes)

Το `hideNonParityMeshes` κρύβει overlays + όσα `bimId` meshes απορρίπτει το `keepMesh`· ένα mesh
**χωρίς** `bimId` μένει **ορατό**. Άρα και το terrain mesh **και** ο νέος cap συμμετέχουν σε
parity counting σχεδιασμένο για **κλειστά manifold στερεά** — ανοιχτή επιφάνεια γράφει αδέσποτο
stencil και μπορεί να αλλοιώσει τα caps του κτιρίου όταν υπάρχει ενεργό section box.

Λύση: ρητός δείκτης `userData['sectionParityExclude'] = true`, τον οποίο αναγνωρίζει το
**υπάρχον** `isSectionParityOverlay` (επέκταση, όχι δεύτερο predicate). Μπαίνει στο cap mesh **και**
στο terrain mesh — ο cap διορθωμένος με τον λόφο ακόμη μέσα θα ήταν μισοδουλειά.
**Δεν** χρησιμοποιείται το `bimEdgeOverlay` για τον σκοπό αυτό (θα ήταν ψέμα) ούτε
`depthTest:false` (θα σχεδίαζε πάνω από το κτίριο).

## M2.8 — Πού πάμε **πιο πέρα** από τους μεγάλους (μετρημένο, όχι ρητορικό)

| Προϊόν | Τι κάνει σήμερα στην **τομή εδάφους σε 3Δ** |
|---|---|
| **ArchiCAD** | **Καμία** ενσωματωμένη λύση για cut surface σε Mesh. Η επίσημη οδηγία της Graphisoft είναι **χειροκίνητο workaround**: ζωγράφισε Morph, κάνε Solid Element Operation «Intersection» με το Mesh. |
| **Revit** | Το section box σε 3Δ βάφει το «Coarse Poche Material». Το cut pattern εμφανίζεται **μόνο σε Coarse detail level**, και σε shaded άποψη η διαγράμμιση πρακτικά χάνεται — για να τη δεις γυρνάς σε Hidden Line. Δηλαδή **ένα** καθολικό poché + hatch που δεν επιβιώνει στη σκιασμένη 3Δ. |
| **Civil 3D** | Το poché εδάφους ζει σε **section/profile sheet** (2D annotation) — όχι στο ζωντανό 3Δ viewport. |

**Εμείς:** αληθινό 3D cap χώματος, με το αρχιτεκτονικό σύμβολο σε **world-space** κλίμακα, που
**ακολουθεί ζωντανά την αλλαγή ορόφου**, σε **σκιασμένη** άποψη, σε **οποιοδήποτε** detail level,
με **μηδέν κόστος ανά καρέ** και **χωρίς** να υποβαθμίσει το SSAO/EffectComposer pipeline.
Δεν είναι υπερβολή: είναι τρία μετρήσιμα σημεία πάνω από την πρακτική τους.

## M2.9 — Κόστος

Το cap είναι γεωμετρία, όχι render pass:

- **ανά καρέ:** 0. Ένα επιπλέον draw call για ένα mesh. Ο `isStencilActive()` μένει `false`.
- **ανά rebuild** (αλλαγή ορόφου / αποτύπωσης / γεωαναφοράς / ορατότητας): ένα πέρασμα O(τρίγωνα),
  σκέτη αριθμητική, **καμία** επανατριγωνοποίηση (τα κομμάτια βγαίνουν ήδη τριγωνοποιημένα).
- **αλλαγή διαφάνειας:** μηδέν επαναπαραγωγή — μεταλλάσσεται το υλικό (η ίδια fast path που έχουν
  ήδη τα δύο αδέρφια, `sameInputs`).

Σημείωση εντιμότητας: η αλλαγή ορόφου είναι **δωρεάν για το clipping** (Δ5, mutate
`plane.constant`), αλλά **όχι** για τον cap — αυτός ξαναχτίζεται. Είναι γεγονός συχνότητας χρήστη,
όχι καρέ· το κόστος μετακινείται εκεί που ήδη ξαναχτίζουμε ισοϋψείς.

## M2.10 — Επαλήθευση (jest· **ποτέ `tsc`** — N.17)

| Test | Κλειδώνει |
|---|---|
| `planar-scalar-clip.test.ts` (ΝΕΟ) | Κυρτότητα/πληρότητα του ημιεπίπεδου clip· κορυφή **ακριβώς** στο μηδέν μπαίνει και στα δύο μισά (watertight)· `sign` συμμετρία· εκφυλισμένα (<3 κορυφές) |
| `cut-fill.test.ts` (ΥΠΑΡΧΟΝ) | **Δικλείδα μη-παλινδρόμησης της γενίκευσης** — ο cut/fill τρέχει τώρα τον κοινό κόφτη· οι όγκοι μένουν βυτ-για-βυτ ίδιοι |
| `terrain-cut-cap-geometry.test.ts` (ΝΕΟ) | **Το anchor εμβαδού (§M2.9):** `capArea + belowArea == topoSurfaceAreas(tin).plan2DMm2`, με το `belowArea` από το **αντίθετο** πρόσημο και το ολικό από **ανεξάρτητο** SSoT ⇒ κάθε «απλοποίηση» του κόφτη σκάει. Επίπεδο **πάνω** από τον λόφο ⇒ κενό cap· **κάτω** ⇒ πλήρες cap == plan area· **τρύπα** και **δύο νησιά** ⇒ σωστό άθροισμα· idempotency |
| `terrain-clip-math.test.ts` (ΕΠΕΚΤΑΣΗ) | Η αντιστροφή του M2.3 — round-trip `worldY → elevMm → worldY`· το drop **συμμετέχει** (τεστ που σκάει αν κάποιος το βγάλει)· datum ≠ 0 |
| `section-clip-applicator.test.ts` (ΕΠΕΚΤΑΣΗ) | Ο τρικατάστατος marker: `false` σε παιδί topo root ⇒ **`'default'`** planes· `undefined` ⇒ κληρονομιά· `true` ⇒ `'topo'` |
| `section-parity-overlay.test.ts` | `sectionParityExclude` εξαιρεί· απουσία του δεν αλλάζει τίποτα (κανένα υπάρχον mesh δεν επηρεάζεται) |

Χειροκίνητα: **1ος όροφος + ανάγλυφο ορατό** ⇒ ο λόφος κομμένος με **χώμα** στην τομή, κτίριο
ακέραιο · εναλλαγή ορόφων ⇒ ο cap ακολουθεί · **«Όλοι οι όροφοι»** ⇒ κανένας cap · toggle off ⇒
κανένας cap · zoom in/out ⇒ η διαγράμμιση **δεν κολυμπά** · ενεργό section box ⇒ ο cap κόβεται
**μαζί** με το κτίριο και τα caps του κτιρίου **δεν** αλλοιώνονται.

## M2.11 — Ρητά **εκτός** M2

- **`faceMode`**: ο cap **δεν** τιμά τον άξονα FACES. Το terrain **ήδη δεν ξαναχτίζεται** σε αλλαγή
  faceMode (Open Question #1), οπότε ένας cap που τον τιμούσε θα **διαφωνούσε** με τον λόφο
  (κρυμμένες παρειές, ορατή τομή). Λύνεται μαζί με το OQ#1, όχι πριν.
- **Κατακόρυφες τομές (X/Y) του εδάφους δεν παίρνουν cap.** Εκεί το σχήμα της τομής **δεν** είναι
  height field ως προς τον άξονα κοπής, άρα το επιχείρημα του M2.1 δεν ισχύει — θα χρειαζόταν
  αληθινό στερεό. Ρητά εκτός.
- **Οι ισοϋψείς δεν αποτυπώνονται στον cap** (Civil 3D δεν το κάνει ούτε αυτό).

## M2.12 — Τι υλοποιήθηκε, και τα δύο σημεία που η υλοποίηση **έσφιξε**

| Αρχείο | Ρόλος |
|---|---|
| `systems/topography/planar-scalar-clip.ts` **(ΝΕΟ)** | Ο **ΕΝΑΣ** κόφτης ημιεπιπέδου σε βαθμωτό πεδίο. |
| `systems/topography/cut-fill-geometry.ts` | Το `clipToSign` έγινε **thin adapter** (πεδίο `Δz`). Το `cut-fill.test.ts` πέρασε **αμετάβλητο** ⇒ μηδενική αλλαγή συμπεριφοράς. |
| `systems/topography/terrain-cut-cap-geometry.ts` **(ΝΕΟ)** | TIN + `levelElevMm` → τρίγωνα του cap σε WORLD mm + `planAreaMm2` (το anchor) + το συμπληρωματικό `terrainBelowLevelPlanAreaMm2`. |
| `systems/topography/vertical-datum.ts` | `surfaceElevationAtWorldYMm()` — η αντιστροφή του M2.3 (datum **+ drop**). |
| `bim-3d/converters/terrain-cap-to-three.ts` **(ΝΕΟ)** | WORLD mm → `BufferGeometry` στη στάθμη, με **ψημένα world-space UV**. |
| `bim-3d/systems/section/section-hatch-cap.ts` | Key **`earth`** + `getSectionHatchTexture()` + `SECTION_HATCH_TILE_M`. |
| `bim-3d/materials/terrain-materials-3d.ts` | `getTerrainCutCapMaterial3D(opacity)` — άφωτο, DoubleSide, ίδιο `applyTerrainOpacity`. |
| `bim-3d/scene/terrain/topo-scene-layer-support.ts` | `TopoLayerSeating` (drop + clip scope) · `CUT_CAP_SEATING` · **`SingleMeshTopoLayer`** (βλ. παρακάτω). |
| `bim-3d/scene/terrain/TerrainCutCapLayer.ts` **(ΝΕΟ)** | Το τρίτο αδερφάκι. |
| `bim-3d/systems/section/section-clip-applicator.ts` | Ο marker έγινε **τρικατάστατος**. |
| `bim-3d/systems/section/section-parity-overlay.ts` | `SECTION_PARITY_EXCLUDE_KEY` + `excludeFromSectionParity()`. |
| `scene-manager-construct.ts` / `ThreeJsSceneManager.ts` | Κατασκευή + `dispose()`, καθρέφτης του contour layer. |
| `.ssot-registry.json` | Δύο νέα modules (tier 3): `planar-scalar-clip`, `terrain-cut-cap`. |

### Απόκλιση 1 — μη-πεπερασμένο πεδίο **απορρίπτει ολόκληρο το πολύγωνο**

Το blueprint υπέθετε ότι αρκεί να θεωρηθεί «έξω» μια κορυφή με μη-πεπερασμένο `f`. **Λάθος, και το
έπιασε το τεστ:** η ΑΚΜΗ που την ακουμπά ζητά παρεμβολή μεταξύ πεπερασμένου και NaN, που δίνει NaN
**συντεταγμένη** — δηλαδή το σφάλμα μεταναστεύει από το πεδίο στη ΓΕΩΜΕΤΡΙΑ, και μία NaN κορυφή
αρκεί για να γίνει NaN το `Box3` της σκηνής και να σβήσει όλο το 3Δ (ADR-537). Ο κόφτης πλέον
προϋπολογίζει τα πεδία και **απορρίπτει ολόκληρο το πολύγωνο** αν έστω ένα δεν είναι πεπερασμένο.
Οι όγκοι cut/fill δεν επηρεάζονται (εκεί το `dz` είναι εγγυημένα πεπερασμένο· η παλιά διαδρομή
κατέληγε ούτως ή άλλως σε μηδενική συνεισφορά, μέσω του φίλτρου εμβαδού).

### Απόκλιση 2 — `SingleMeshTopoLayer` (το CHECK 3.28 είχε δίκιο)

Το `TerrainCutCapLayer` γεννήθηκε **δίδυμο** του `TerrainSceneLayer`: ίδιο πεδίο `mesh`, ίδια έδραση
(add + parity-exclude + σκιές + bookkeeping), ίδιο `clearContent`. Ο κανονικός τρόπος με τον οποίο
γεννιέται sibling clone — αντιγράφεις τον αδερφό «επειδή κάνει ήδη το σωστό». Εξήχθη σε κοινή βάση
`SingleMeshTopoLayer`, με μοναδική παράμετρο ό,τι γνήσια διαφέρει (**σκιές**: το ανάγλυφο τις θέλει,
το poché όχι). Κέρδος πέρα από το anti-clone: το `excludeFromSectionParity` ζει τώρα **στη βάση**,
οπότε ένας μελλοντικός τρίτος καταναλωτής — που θα έχει ακριβώς το ίδιο σχήμα — δεν χρειάζεται να το
θυμηθεί μόνος του.

Ίδιο μοτίβο με το Δ4 (2026-07-17), όπου το `onRebuilt` είχε γραφτεί ως twin και το ίδιο check το
έκοψε. **Δεύτερη φορά στο ίδιο ADR** — τα topo layers είναι δομικά αδέρφια, και το προεπιλεγμένο
λάθος εκεί είναι πάντα η αντιγραφή.

---

## Επιπτώσεις — τι αλλάζει ορατά

| # | Αλλαγή | Σοβ. |
|---|---|---|
| 1 | Το ανάγλυφο κόβεται τώρα by default **όταν το ανάψεις** | Σκόπιμο (§Default) |
| 2 | **Οι ισοϋψείς κόβονται τώρα και από το section box / axis cuts** — πριν αιωρούνταν άκοπες. Διόρθωση bug, αλλά **ορατή αλλαγή** σε κάθε υπάρχουσα άποψη με ενεργή τομή + ορατό ανάγλυφο | Μεσαία |
| 3 | `getTerrainMaterial3D` σε `'none'`/`'hidden-line'` επιστρέφει αποκλειστικά clones (+2 materials μνήμη· pixel-identical) | Χαμηλή |
| 4 | `clipActive` γίνεται true με terrain-only τομή → το `applyState` δεν κάνει πλέον early-return. **Επαληθευμένα ασφαλές:** με `enabled=false, mode≠'box'` το slow path καταλήγει στην ίδια τελική κατάσταση με το disabled branch (`sectionBox.setVisible(false)`, `cachedPlanes=[]`, `restoreEdgeCut`) | Χαμηλή |
| 5 | Αλλαγή υπογραφής `applyClippingPlanes` — **ένα** production call site (`section-scene-controller.ts:251`) + ένα test file | Χαμηλή |

## Out of scope

- **Point cloud (`topo-pointcloud`) δεν κόβεται** — δεν καλεί `seatTopoLayerRoot` (θέτει μόνο του `root.name`) → κανένας marker· και το `PointsMaterial` δεν είναι σε κανένα allowlist. Σκόπιμο: το νέφος είναι display-only τεκμήριο (ADR-650 §6).
- **Poché / διαγράμμιση χώματος στην τομή** → M2. ✅ **Έγινε (2026-07-28)** — και **χωρίς** stencil:
  βλ. §M2, όπου και οι τρεις ενστάσεις της v1 καταρρέουν επειδή η τομή υπολογίζεται αναλυτικά.
- **Κατακόρυφη κοπή εδάφους** (X/Y) — τα axis cuts του ADR-455 ήδη το κόβουν μέσω του `topo` scope· δεν προστίθεται ξεχωριστός έλεγχος.

## Open Questions

1. **Το `faceMode` δεν κάνει rebuild το terrain.** Τα topo layers ακούν `TopoPointStore` / `terrain-3d-store` / cut-fill / geo-ref — **όχι** `bim-render-settings`. Άρα μια αλλαγή faceMode αφήνει το terrain με stale material instance μέχρι κάποιο άλλο rebuild. **Προϋπάρχον** (ισχύει και σήμερα, χωρίς αυτό το ADR) και εκτός scope — καταγράφεται εδώ γιατί το `withTerrainFaceMode` το κάνει πιο ορατό.
2. ~~**Stencil parity + terrain.**~~ ✅ **ΕΚΛΕΙΣΕ (2026-07-28, §M2.7) — για meshes.** Το
   `hideNonParityMeshes` δεν εξαιρούσε το terrain mesh (δεν έχει `bimId`), οπότε ένα ανοιχτό
   `DoubleSide` TIN συμμετείχε σε parity counting σχεδιασμένο για κλειστά manifold στερεά και
   μπορούσε να αλλοιώσει caps όταν section geometry τέμνει το έδαφος. Το M2 έφερε το mesh του cap
   στο **ίδιο** μονοπάτι, άρα το θέμα έπαψε να είναι θεωρητικό — και λύθηκε με ρητό δείκτη
   `sectionParityExclude`, που τον αναγνωρίζει το υπάρχον `isSectionParityOverlay` και τον
   σφραγίζει η `SingleMeshTopoLayer` **στη βάση**, σε ανάγλυφο και cap μαζί.
   ⚠️ **Μένει ανοιχτό για γραμμές:** οι ισοϋψείς είναι `LineSegments`, που δεν φτάνουν καν στο
   `isSectionParityOverlay` (θέλει `Mesh`/`Sprite`). Δεν εντοπίστηκε ζημιά από αυτές· καταγράφεται
   ώστε να μη θεωρηθεί ότι το OQ#2 έκλεισε ολόκληρο.

---

## Επαλήθευση

Jest (καθαρές συναρτήσεις κατά προτίμηση· **ποτέ `tsc`** — N.17):

| Test | Κλειδώνει |
|---|---|
| `terrain-clip-math.test.ts` (ΝΕΟ) | Κάθε `null` guard· FFL 0 → 0.001 (**το ισόγειο ΕΙΝΑΙ τομή**)· υπόγειο −3000 → −2.999· δύο όροφοι → δύο διαφορετικά Y |
| `terrain-materials-3d.test.ts` (ΝΕΟ) | **Το regression του Δ3**: γράψιμο `clippingPlanes` στο terrain αφήνει το `mat-concrete.clippingPlanes` null ← «το κτίριο μένει ακέραιο» ως εκτελέσιμο assertion· parameter parity· cache stability |
| `section-clip-applicator.test.ts` (ΕΠΕΚΤΑΣΗ) | Εγγόνι κληρονομεί scope· `LineSegments` **εντός** topo κόβεται, **το ίδιο ακριβώς εκτός topo ΔΕΝ** ← η δικλείδα ότι gizmo/dimensions μένουν άθικτα· `LineMaterial` ποτέ· idempotency |
| `clip-scope-guard.test.ts` (ΝΕΟ, Δ8) | Υγιής σκηνή → **καμία** καταγραφή (αλλιώς ο φύλακας είναι θόρυβος)· διαρροή → path/material/scopes/planeCount· **η συμπεριφορά μένει αμετάβλητη** (το resolved scope κυβερνά)· κληρονομιά κλειδώματος σε εγγόνι· warn **μία** φορά ανά υπογραφή ενώ ο δακτύλιος κρατά όλα τα συμβάντα |
| `axis-cut-composer.test.ts` (ΕΠΕΚΤΑΣΗ) | `expect(next[0].plane).toBe(prev[0].plane)` (συμβόλαιο fast path)· terrain πρώτο επιβιώνει του ορίου 6 |
| `terrain-3d-store.test.ts` (ΕΠΕΚΤΑΣΗ) | Default `true`· ίδια τιμή = no-op **χωρίς notify** (κάθε notify = scene rebuild) |

Χειροκίνητα: **Θεμελίωση** → πέδιλα μέσα στο χώμα· **1ος Όροφος** → λόφος κομμένος στο FFL, **κτίριο ολόκληρο**· εναλλαγή ορόφων → η τομή ακολουθεί χωρίς flicker· «Όλοι οι όροφοι» → άκοπο· toggle off → άκοπο· **faceMode = Hidden Line + ανάγλυφο ορατό + clip on → το κτίριο ΔΕΝ κόβεται** (το regression του Δ3)· ισοϋψείς σταματούν στην τομή.

---

## Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-28 | 🟢 **M2 IMPLEMENTED** — η τομή του εδάφους έπαψε να είναι κούφια. Poché χώματος ως **γεωμετρία** (per-triangle half-space clip του TIN), **χωρίς** stencil: και οι τρεις ενστάσεις της v1 ήταν ενστάσεις κατά *του stencil*, όχι κατά *του cap*, και καταρρέουν όταν η τομή υπολογίζεται αναλυτικά (§M2.0). Ο `isStencilActive()` μένει **αμετάβλητος** ⇒ SSAO/EffectComposer ανέπαφα. Ο κόφτης **γενικεύτηκε** σε ΕΝΑ module (`planar-scalar-clip`) που μοιράζονται cut/fill και cap — ίδιος αλγόριθμος, άλλο πεδίο· το `cut-fill.test.ts` πέρασε αμετάβλητο. Ο cap κάθεται στο scope **`'default'`** («η κοπή που με έφτιαξε δεν με τρώει, κάθε τομή του κτιρίου με κόβει») μέσω **τρικατάστατου** marker — κανένα τρίτο scope, καμία γραμμή στον `SectionSceneController`. Anchor: `cap + below == topoSurfaceAreas().plan2DMm2` από **ανεξάρτητη** διαδρομή, με τρύπες και δύο νησιά. Έκλεισε το **Open Question #2** για meshes. Δύο σφιξίματα στην πορεία (§M2.12): μη-πεπερασμένο πεδίο απορρίπτει **ΟΛΟ** το πολύγωνο (τεστ έπιασε διαρροή NaN από το πεδίο στη ΓΕΩΜΕΤΡΙΑ μέσω της παρεμβολής)· και το CHECK 3.28 έκοψε ξανά sibling clone → `SingleMeshTopoLayer`, **δεύτερη φορά στο ίδιο ADR** μετά το Δ4. 54 σουίτες / 474 tests πράσινα· `jscpd:diff` καθαρό σε 12 αρχεία. **Εκκρεμεί ζωντανή οπτική επιβεβαίωση.** |
| 2026-07-28 | **Δ8 / Φ2 — clip scope guard** (`clip-scope-guard.ts` ΝΕΟ + `walk` κουβαλά κλείδωμα + `DxfToThreeConverter.buildLineGroup` κλειδώνει `'default'`). Αφορμή: αναφορά Giorgio ότι στο 3Δ οι οντότητες κόβονται πριν τη βάση του viewport ενώ οι κίτρινες γραμμές επιλογής φτάνουν κάτω. **Το σφάλμα αποδείχθηκε διαλείπον** (έφυγε μόνο του στη διάρκεια της διάγνωσης) και **δεν επιβεβαιώθηκε** ως διαρροή scope — γι' αυτό μπήκε **όργανο, όχι διόρθωση**. Η pixel-ανάλυση του στιγμιότυπου απέκλεισε near/far plane (κάμερα κλίση 54.4° κάτω, βάθος εδάφους 7.45–14.9 vs near 0.1 / far 1000), μέγεθος καμβά (το βαθμιδωτό φόντο συνεχές μέσα από την κοπή) και frustum culling (δύο ανεξάρτητα χαρακτηριστικά κομμένα στο **ίδιο pixel** ⇒ ανά-fragment). **Καμία αλλαγή συμπεριφοράς**· 883 tests / 108 σουίτες πράσινα. Λεπτομέρειες + επόμενα βήματα: `HANDOFFS/3d-wireframe-clipped-before-viewport-bottom.md`. |
| 2026-07-17 | Δ4 — το `onRebuilt` + όλος ο κύκλος ζωής των topo layers ανέβηκαν στην abstract **`TopoSceneLayer`** (`topo-scene-layer-support.ts`), που κληρονομούν `TerrainSceneLayer` + `TerrainContourLayer`. Η πρώτη υλοποίηση τα είχε ως twins· το **CHECK 3.28 (jscpd/N.18)** το μπλόκαρε στο commit. Ανέβηκαν μαζί: visibility gate, `lastInputs`, `dispose()`, και το `sameInputs()` — τώρα key-driven (`Object.keys`) αντί για χειρόγραφη λίστα πεδίων, ώστε ένα νέο geometry input να μην μπορεί να μείνει σιωπηλά εκτός σύγκρισης και να σερβίρει stale γεωμετρία. |
| 2026-07-16 | 🔵 PROPOSED — αρχική καταγραφή. Ερώτηση Giorgio από στιγμιότυπα 3 ορόφων· έρευνα big-player (Revit/ArchiCAD/Civil 3D)· απόφαση Giorgio υπέρ κοπής (έναντι απόκρυψης/διαφάνειας). Ευρήματα: το clipping υπάρχει ήδη πλήρες (ADR-452/455) — λείπει το per-scope· terrain material leak σε faceMode `'none'`/`'hidden-line'`· **υπαρκτό bug: οι ισοϋψείς δεν κόβονταν ποτέ** (`isMesh` guard vs `LineSegments`). |

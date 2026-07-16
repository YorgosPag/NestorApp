# ADR-665: Κοπή Αναγλύφου στη Στάθμη Ενεργού Ορόφου — Per-Scope Clipping Planes

## Status
🔵 **PROPOSED — 2026-07-16** — Το τοπογραφικό ανάγλυφο στο 3Δ κόβεται αυτόματα από οριζόντιο επίπεδο στο υψόμετρο του **ενεργού ορόφου**· το κτίριο **δεν** κόβεται ποτέ από αυτό το επίπεδο. Εισάγει τον κανόνα ότι τα clipping planes είναι **per-scope** (`'default'` | `'topo'`) — αλλαγή συμβολαίου για κάθε consumer του `applyClippingPlanes`. Διορθώνει παράλληλα υπαρκτό bug: οι ισοϋψείς (`LineSegments`) δεν κόβονταν **ποτέ** από καμία τομή.

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
- **Poché / διαγράμμιση χώματος στην τομή** → M2.
- **Κατακόρυφη κοπή εδάφους** (X/Y) — τα axis cuts του ADR-455 ήδη το κόβουν μέσω του `topo` scope· δεν προστίθεται ξεχωριστός έλεγχος.

## Open Questions

1. **Το `faceMode` δεν κάνει rebuild το terrain.** Τα topo layers ακούν `TopoPointStore` / `terrain-3d-store` / cut-fill / geo-ref — **όχι** `bim-render-settings`. Άρα μια αλλαγή faceMode αφήνει το terrain με stale material instance μέχρι κάποιο άλλο rebuild. **Προϋπάρχον** (ισχύει και σήμερα, χωρίς αυτό το ADR) και εκτός scope — καταγράφεται εδώ γιατί το `withTerrainFaceMode` το κάνει πιο ορατό.
2. **Stencil parity + terrain.** Το `hideNonParityMeshes` (`section-parity-scene.ts:51`) δεν εξαιρεί το terrain mesh (δεν έχει `bimId`) και το `mainScene` που περνά στα cap passes είναι όλο το `deps.scene`, όχι το `getBimGroup()`. Ένα ανοιχτό DoubleSide TIN που συμμετέχει σε stencil parity counting (σχεδιασμένο για κλειστά manifold στερεά) μπορεί να αλλοιώσει caps όταν section geometry τέμνει το έδαφος. **Προϋπάρχον** (το terrain είναι ήδη στο scene) — το `isStencilActive()` μένει αμετάβλητο ώστε terrain-only τομή να μην ανοίγει καν αυτό το path.

---

## Επαλήθευση

Jest (καθαρές συναρτήσεις κατά προτίμηση· **ποτέ `tsc`** — N.17):

| Test | Κλειδώνει |
|---|---|
| `terrain-clip-math.test.ts` (ΝΕΟ) | Κάθε `null` guard· FFL 0 → 0.001 (**το ισόγειο ΕΙΝΑΙ τομή**)· υπόγειο −3000 → −2.999· δύο όροφοι → δύο διαφορετικά Y |
| `terrain-materials-3d.test.ts` (ΝΕΟ) | **Το regression του Δ3**: γράψιμο `clippingPlanes` στο terrain αφήνει το `mat-concrete.clippingPlanes` null ← «το κτίριο μένει ακέραιο» ως εκτελέσιμο assertion· parameter parity· cache stability |
| `section-clip-applicator.test.ts` (ΕΠΕΚΤΑΣΗ) | Εγγόνι κληρονομεί scope· `LineSegments` **εντός** topo κόβεται, **το ίδιο ακριβώς εκτός topo ΔΕΝ** ← η δικλείδα ότι gizmo/dimensions μένουν άθικτα· `LineMaterial` ποτέ· idempotency |
| `axis-cut-composer.test.ts` (ΕΠΕΚΤΑΣΗ) | `expect(next[0].plane).toBe(prev[0].plane)` (συμβόλαιο fast path)· terrain πρώτο επιβιώνει του ορίου 6 |
| `terrain-3d-store.test.ts` (ΕΠΕΚΤΑΣΗ) | Default `true`· ίδια τιμή = no-op **χωρίς notify** (κάθε notify = scene rebuild) |

Χειροκίνητα: **Θεμελίωση** → πέδιλα μέσα στο χώμα· **1ος Όροφος** → λόφος κομμένος στο FFL, **κτίριο ολόκληρο**· εναλλαγή ορόφων → η τομή ακολουθεί χωρίς flicker· «Όλοι οι όροφοι» → άκοπο· toggle off → άκοπο· **faceMode = Hidden Line + ανάγλυφο ορατό + clip on → το κτίριο ΔΕΝ κόβεται** (το regression του Δ3)· ισοϋψείς σταματούν στην τομή.

---

## Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-17 | Δ4 — το `onRebuilt` + όλος ο κύκλος ζωής των topo layers ανέβηκαν στην abstract **`TopoSceneLayer`** (`topo-scene-layer-support.ts`), που κληρονομούν `TerrainSceneLayer` + `TerrainContourLayer`. Η πρώτη υλοποίηση τα είχε ως twins· το **CHECK 3.28 (jscpd/N.18)** το μπλόκαρε στο commit. Ανέβηκαν μαζί: visibility gate, `lastInputs`, `dispose()`, και το `sameInputs()` — τώρα key-driven (`Object.keys`) αντί για χειρόγραφη λίστα πεδίων, ώστε ένα νέο geometry input να μην μπορεί να μείνει σιωπηλά εκτός σύγκρισης και να σερβίρει stale γεωμετρία. |
| 2026-07-16 | 🔵 PROPOSED — αρχική καταγραφή. Ερώτηση Giorgio από στιγμιότυπα 3 ορόφων· έρευνα big-player (Revit/ArchiCAD/Civil 3D)· απόφαση Giorgio υπέρ κοπής (έναντι απόκρυψης/διαφάνειας). Ευρήματα: το clipping υπάρχει ήδη πλήρες (ADR-452/455) — λείπει το per-scope· terrain material leak σε faceMode `'none'`/`'hidden-line'`· **υπαρκτό bug: οι ισοϋψείς δεν κόβονταν ποτέ** (`isMesh` guard vs `LineSegments`). |

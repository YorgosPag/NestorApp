# ADR-695 — DXF Scene Fit/Projection SSoT (`src/lib/dxf-scene/`)

**Status**: Accepted
**Date**: 2026-07-25
**Σχετικά**: ADR-033 (Floorplan Processing), ADR-312 (Property Showcase Φ3), ADR-340 (Raster background layers), ADR-370 (BIM read-only visualization), ADR-584 (jscpd anti-duplication)

---

## 1. Context

### 1.1 Το εύρημα

Token-based σάρωση (`jscpd`, N.18 / CHECK 3.28) πάνω σε ολόκληρο το `src/` ανέδειξε ως
μεγαλύτερο πραγματικό clone (**323 tokens / 53 γραμμές**) το ζεύγος:

```
src/components/shared/files/media/floorplan-dxf-renderer.ts:252
src/services/thumbnail-generator.ts:151
```

Το ίχνος οδήγησε σε **έξι** ανεξάρτητα αντίγραφα της **ίδιας** μαθηματικής:
«χώρεσε ένα Y-UP CAD σχέδιο μέσα σε ένα Y-DOWN raster viewport».

| # | Αρχείο | fit | προβολή | bounds | γεωμετρία |
|---|---|---|---|---|---|
| 1 | `components/shared/files/media/floorplan-dxf-renderer.ts` | inline | ×12 inline | `computeActualBounds` | switch |
| 2 | `services/thumbnail-generator.ts` | inline (+padding) | ×12 inline | `calculateBounds` | switch |
| 3 | `components/shared/files/media/bim-canvas-transform.ts` | inline | — | — | — |
| 4 | `components/projects/tabs/FloorplanViewerTab.tsx` | inline | ×7 inline | — | switch |
| 5 | `components/shared/files/media/floorplan-pdf-renderer.ts` | inline | — | — | — |
| 6 | `components/shared/files/media/overlay-renderer/transform.ts` | συνάρτηση | συνάρτηση | — | — |

Το #6 **αυτο-δήλωνε** την παράβαση στο σχόλιό του: *«Mirrors the math used by
`renderDxfToCanvas` and the raster renderer»*. Το #3 επίσης: *«Aligns … with the pixel
space produced by `renderDxfToCanvas`»*. Το #5 επίσης: *«Uses the SAME fit-and-center
math as `renderDxfToCanvas` so overlays align»*. Τρία αρχεία ήξεραν ότι αντιγράφουν και
κανένα δεν κεντρικοποίησε.

### 1.2 Γιατί το `ssot:discover` (CHECK 3.18) δεν το είχε πιάσει

Είναι name/regex-based και σαρώνει `src/config` + `src/utils` + `src/lib` σε `-maxdepth 1`.
Τα έξι αρχεία ζουν σε `components/`, `services/`, `subapps/` — **δέντρα που ο scanner δεν
ανοίγει ποτέ**. Ίδιο σχήμα με το i18n `0` του N.11: το πράσινο σήμαινε «κανείς δεν κοίταξε».
Το `jscpd` (token-based) τα είδε ανεξάρτητα ονόματος — ακριβώς ο λόγος ύπαρξης του ADR-584.

### 1.3 Η απόκλιση ήταν ήδη πραγματική (δύο bugs)

Copy-paste χωρίς SSoT σημαίνει ότι τα αντίγραφα **αποκλίνουν σιωπηλά**:

1. **`FloorplanViewerTab` — λάθος τόξα.** Περνούσε DXF **μοίρες** κατευθείαν στο
   `ctx.arc()` (που δέχεται **ακτίνια**) και με **αντεστραμμένες** τις γωνίες
   (`endAngle, startAngle, false`). Τα άλλα δύο αντίγραφα έκαναν σωστά
   `deg→rad, -startRad, -endRad, true`. **Κάθε τόξο σε αυτή την καρτέλα σχεδιαζόταν λάθος.**

2. **`thumbnail-generator` — λάθος κάδρο.** Το bounds walk του αγνοούσε `lwpolyline`,
   `rectangle` και το descender box των `textNode` οντοτήτων, ενώ ο gallery renderer τα
   μετρούσε. Το ίδιο σχέδιο καδραριζόταν **διαφορετικά** ανά επιφάνεια.

---

## 2. Decision

Ένα ουδέτερο, dependency-free σπίτι: **`src/lib/dxf-scene/`**. Ίδια κλήση με την προαγωγή
του `createExternalStore` στο `src/lib/state/` — οι καταναλωτές απλώνονται σε `components/`,
`services/` και `subapps/` bridges, οπότε **μόνο** ένα ουδέτερο επίπεδο μπορεί να εισαχθεί
και από τα τρία χωρίς παραβίαση layering.

### 2.1 Τα τέσσερα modules

| Module | Ευθύνη |
|---|---|
| `scene-fit-transform.ts` | fit + zoom + pan + paddingRatio, `projectX/projectY/worldToScreen/screenToWorld`, `rectBoundsToScene` |
| `scene-bounds.ts` | περπάτημα οντοτήτων → world bounding box |
| `canvas-scene-painter.ts` | stroke pass για `line / polyline / circle / arc` |
| `scene-text-content.ts` | flat `text` **και** `textNode` AST → string |

### 2.2 Κανονικοί τύποι (ΜΗΝ τους ξανα-γράψεις πουθενά)

```
fitW      = canvasW * (1 - 2 * paddingRatio)
baseScale = min(fitW / drawingW, fitH / drawingH)
scale     = baseScale * zoom
offsetX   = (canvasW - drawingW * scale) / 2 + pan.x
offsetY   = (canvasH - drawingH * scale) / 2 + pan.y
screenX   = (worldX - bounds.min.x) * scale + offsetX
screenY   = (bounds.max.y - worldY) * scale + offsetY   ← Y flip
```

Η γενίκευση είναι **ακριβής**, όχι προσεγγιστική:
- `paddingRatio = 0, zoom, pan` → **byte-exact** ο παλιός gallery fit.
- `paddingRatio = 0.05, zoom = 1, pan = 0` → **byte-exact** ο παλιός thumbnail fit.

Προστέθηκε `EXTENT_EPSILON = 1e-9` φράχτης στα drawing extents (ήδη υπήρχε **μόνο** στο
`buildBimViewTransform`). Για κάθε πραγματικό σχέδιο `max(1e-9, d) === d`, άρα είναι
**ουδέτερος** στο κανονικό μονοπάτι· εμποδίζει `Infinity` scale να δηλητηριάσει τα
ορίσματα του `ctx.arc()` σε εκφυλισμένα bounds.

### 2.3 Τι ΔΕΝ κεντρικοποιήθηκε — και γιατί

**Το βάψιμο κειμένου μένει ανά επιφάνεια.** Δεν είναι παράλειψη· είναι πραγματική
απόκλιση συμπεριφοράς:

| Επιφάνεια | Font floor | Αιτία |
|---|---|---|
| gallery (`floorplan-dxf-renderer`) | **κανένα** | ADR-370: σταθερό δάπεδο «παγώνει» το μέγεθος· σε χαμηλό zoom τα γράμματα σταματούν να μικραίνουν και γίνονται δυσανάγνωστη μάζα |
| thumbnail (`thumbnail-generator`) | `max(6, …)` | στα 300×200 το καθαρά zoom-scaled font καταρρέει σε sub-pixel |
| project tab (`FloorplanViewerTab`) | `max(8, …)` | ιστορικό δικής της επιφάνειας |

Επίσης διαφέρει το baseline (`textNode` → `top` / TL attachment, DXF-imported → `alphabetic` / BL)
και η ανάλυση χρώματος (mode ink override → run TrueColor → entity → layer).
Άρα: **γεωμετρία = κοινή, στυλ = τοπικό**. Ο painter επιστρέφει `false` για
`text/mtext` ώστε ο καλών να αναλάβει το δικό του πέρασμα.

**Ο `services/dxf-raster/svg-from-dxf-scene.ts` ΔΕΝ αγγίχθηκε.** Είναι σκόπιμα
dependency-free επειδή καθρεφτίζεται **byte-for-byte** στο
`functions/src/shared/svg-from-dxf-scene.ts`: το Firebase κάνει deploy το `functions/lib/**`,
που **δεν μπορεί** να αναλύσει το δέντρο του Next.js (`functions/tsconfig.json` κάνει
`include: ["src"]` μόνο). Το αντίγραφό του είναι **τεκμηριωμένο deployment mirror, όχι παράβαση**.

### 2.4 Συγκλίσεις συμπεριφοράς (σκόπιμες)

1. **`computeSceneBounds` = ένωση (superset)** των δύο παλιών walks. Το thumbnail
   πλέον μετρά `lwpolyline`, `rectangle` και το text descender. Είναι **αυστηρή
   βελτίωση**: ένα bounds walk που αγνοεί έναν τύπο τον κόβει σιωπηλά έξω από το viewport.
2. **`FloorplanViewerTab` τόξα διορθώθηκαν** από την ένωση (βλ. §1.3).
3. Το `FloorplanViewerTab` κρατά **σκόπιμα** την top-left στοίχισή του: παίρνει το `scale`
   από το SSoT και μηδενίζει τα offsets κεντραρίσματος, αντί να ξανα-παράγει fit.

---

## 3. Consequences

### Θετικά
- Οι πέντε επιφάνειες **δεν μπορούν** πια να αποκλίνουν κατά pixel: geometry pass, overlay
  pass, thumbnail και BIM bridge διαβάζουν τον **ίδιο** `FitTransform`.
- Δύο πραγματικά bugs έφυγαν χωρίς ξεχωριστή εργασία.
- `overlay-renderer/transform.ts` έγινε thin re-export shim → **μηδέν churn** στους 6
  καταναλωτές του και στα υπάρχοντα mocks των tests.

### Όρια
- Το βάψιμο κειμένου παραμένει τριπλό (τεκμηριωμένο, §2.3). Ενοποίηση θα απαιτούσε
  option-bag για font policy — δεν αξίζει για 3 καλούντες.
- Ο `lwpolyline` **μετριέται** στα bounds αλλά **δεν σχεδιάζεται** από κανένα 2D πέρασμα
  (προϋπήρχε· δεν το άλλαξα για να μην εισαχθεί ορατή νέα γεωμετρία). ⚠️ Ανοιχτό ερώτημα.

---

## 4. File impacts

### Νέα αρχεία
- `src/lib/dxf-scene/scene-fit-transform.ts`
- `src/lib/dxf-scene/scene-bounds.ts`
- `src/lib/dxf-scene/canvas-scene-painter.ts`
- `src/lib/dxf-scene/scene-text-content.ts`
- `src/lib/dxf-scene/__tests__/` ×4 (28 tests)

### Modified
- `src/components/shared/files/media/floorplan-dxf-renderer.ts` (349 → 218 γρ.)
- `src/services/thumbnail-generator.ts` (400 → 267 γρ.)
- `src/components/projects/tabs/FloorplanViewerTab.tsx` (−108 γρ.)
- `src/components/shared/files/media/bim-canvas-transform.ts`
- `src/components/shared/files/media/floorplan-pdf-renderer.ts`
- `src/components/shared/files/media/overlay-renderer/transform.ts` (→ shim)
- `.ssot-registry.json` (νέο module `dxf-scene-fit-transform`, 367 → 368)

### Boy Scout (N.0.2)
- `thumbnail-generator.ts`: το «create + size + get 2D ctx + fill» ήταν διπλό μεταξύ DXF και
  PDF thumbnail → `createFilledCanvas()`. Εντοπίστηκε από το ίδιο το CHECK 3.28.

---

## 5. Verification

| Έλεγχος | Αποτέλεσμα |
|---|---|
| `npx jest src/lib/dxf-scene` | ✅ 28/28 |
| `npx jest src/components/shared/files/media/__tests__` | ✅ 34/34 |
| `npm run jscpd:diff` (9 αρχεία) | ✅ καθαρό |
| `npm run test:registry-golden` | ✅ 96/96 |

**Δεν έτρεξε `tsc`** — απαγορεύεται σε πράκτορες (N.17). Η type-safety επικυρώνεται από τον
περιοδικό έλεγχο του Giorgio + το pre-commit hook.

### Regression anchors
Τα tests **καρφώνουν τους αριθμούς** που παρήγαγαν οι έξι επιφάνειες πριν την ένωση
(κεντράρισμα, zoom, pan, padding, Y-flip, αντιστροφή `screenToWorld`, μετατροπή γωνιών
τόξου). Αν κάποιος αλλάξει τους τύπους, thumbnails και overlays ξε-στοιχίζονται σιωπηλά —
αυτά τα tests είναι το καλώδιο παγίδευσης.

---

## 6. Changelog

| Date | Change |
|---|---|
| 2026-07-25 | Initial. Εντοπισμός 6 αντιγράφων μέσω jscpd· δημιουργία `src/lib/dxf-scene/` (4 modules + 28 tests)· μετάβαση 6 καταναλωτών· διόρθωση 2 πραγματικών bugs (τόξα `FloorplanViewerTab`, bounds thumbnail)· καταχώρηση στο `.ssot-registry.json`. |

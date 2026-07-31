# ADR-741: «Πού είναι η περιοχή σχεδίασης;» — μία απάντηση για όλο τον καμβά

**Κατάσταση:** ACCEPTED — υλοποιημένο (2026-07-31)
**Σχετικά:** ADR-040 (micro-leaf καμβάς), ADR-186 (adaptive ticks), ADR-624 (ghost harness), ADR-650 §M10e (spread-then-override), ADR-736 (attach-image ghost), ADR-639 Στάδιο 5 (WebGL γραμμές), ADR-732 (floorplan painter), ADR-294 (SSoT ratchet), ADR-584 / CHECK 3.28 (δομικά δίδυμα)

---

## 1. Το εύρημα

Η ερώτηση **«ποιο ορθογώνιο της οθόνης είναι η περιοχή σχεδίασης;»** απαντιόταν σε
**πέντε** σημεία, με **δύο ασύνδετες αναγνώσεις του ΙΔΙΟΥ αντικειμένου**
(`COORDINATE_LAYOUT.MARGINS`) και μία τρίτη, ανεξάρτητη πηγή:

| Σημείο | Γραφή | Πηγή |
|---|---|---|
| `CoordinateTransforms` (world↔screen, zoom) | `{ left, top }` | σταθερές |
| `useFitToView` · `transform-ghost-matrix` · `webgl-line-ortho-camera` · `useDxfViewerCallbacks` | `{ left, top }` | σταθερές |
| `axis-cut-line-renderer` · `axis-cut-grip` | `{ left, bottom }` | σταθερές |
| `cursor/utils.isPointInRulerArea` | `RULER_LEFT_WIDTH` + `MARGINS.bottom` | σταθερές |
| `LayerRenderer` (το μόνο clip) | `rulerSettings.width/height` | **runtime settings** |
| ο κοινός ghost harness (`useCanvasGhostPreview`) | — | **δεν ρωτούσε καθόλου** |

Τα δύο στρατόπεδα — `{left, top}` και `{left, bottom}` — **δεν τέμνονταν ποτέ**, και
περιέγραφαν το **ίδιο** ορθογώνιο.

Επιπλέον υπήρχαν δύο ακόμη λανθάνουσες απαντήσεις: `RULER_LEFT_PAD = 30` και
`RULER_BOTTOM_PAD = 30` στο `subapps/dxf-viewer/constants.ts`, **με μηδέν καταναλωτές**
σε όλο το `src/` — δύο hardcoded «30» χωρίς προέλευση, έτοιμα να χρησιμοποιηθούν από τον
επόμενο.

## 2. Η ρίζα: ένα όνομα που έλεγε ψέματα

**Το `MARGINS.top` ΕΙΝΑΙ το ύψος του ΚΑΤΩ χάρακα.**

Ο τύπος του `worldToScreen` είναι:

```
screenY = (height − top) − worldY·scale − offsetY
```

Στην αρχή του κόσμου (`worldY = 0`, `offsetY = 0`) δίνει `screenY = height − 30`, που
είναι **ακριβώς** η άνω ακμή της ζώνης του κάτω χάρακα (`RulerRenderer` →
`y = height − rulerHeight`). Το `top` δεν ήταν «άγκυρα αντιστροφής Y» όπως ισχυριζόταν
το σχόλιό του — ήταν το ύψος του κάτω χάρακα με λάθος όνομα.

**Επειδή είναι κι αυτό `30`, το λάθος ήταν αριθμητικά αόρατο.** Το όνομα, όμως, γέννησε
τα δύο στρατόπεδα ανάγνωσης: όποιος διάβαζε «top» έγραφε `{left, top}`, όποιος κοίταζε
την οθόνη έγραφε `{left, bottom}`.

**Συνέπεια:** η αρχή του κόσμου κάθεται στην **κάτω-αριστερή γωνία της περιοχής
σχεδίασης**. Άρα «πού είναι η άγκυρα του μετασχηματισμού;» και «πού είναι η περιοχή
σχεδίασης;» **δεν είναι δύο ερωτήσεις** — είναι η ίδια, ρωτημένη δύο φορές.

## 3. Η απόφαση

Νέο `src/subapps/dxf-viewer/rendering/core/drawing-area.ts` — **η μία πηγή**:

- `DRAWING_AREA_CHROME` — οι ζώνες των χαράκων (`leftRulerWidth`, `bottomRulerHeight`).
  Δεξιά και πάνω είναι **0**: δεν υπάρχουν χάρακες εκεί. Η ρύθμιση
  `globalRuler.horizontal.position` έχει default `'top'` αλλά **αγνοείται** από τον
  renderer — είναι νεκρή και λέει ψέματα.
- `getDrawingAreaRect(viewport)` — το ορθογώνιο, με τα `right`/`bottom`/`centerX`/`centerY`
  **έτοιμα**: κάθε καλών που τα ξαναϋπολόγιζε μόνος του ήταν μία ακόμη ευκαιρία απόκλισης.
- `clipToDrawingArea(ctx, viewport)` — ο caller κατέχει το `save()`/`restore()` (ίδιο
  συμβόλαιο με το `canvas-hatch-fill`).
- `getLeftRulerBand()` / `getBottomRulerBand()` / `isPointInRulerBand()` — οι ζώνες των
  χαράκων ως **συμπλήρωμα** της περιοχής σχεδίασης.

Το `COORDINATE_LAYOUT` **δεν διαγράφεται**: μένει ως **προβολή** για τους ~10 υπάρχοντες
καταναλωτές, με το `MARGINS.top` σημειωμένο `@deprecated` και με ειλικρινή προέλευση
(`bottomRulerHeight`).

### Περιορισμοί που δεν είναι διαπραγματεύσιμοι

- ⚠️ **Καμία εξάρτηση από React/DOM/settings.** Το `CoordinateTransforms` φτάνει σε
  **server API routes** (`route.ts` → `dxf-scene-builder` → … → `bounds-operations`), οπότε
  το module είναι καθαρή αριθμητική.
- ⚠️ **ΜΗΝ «απλοποιήσεις» σμικρύνοντας το ίδιο το `viewport`.** Αν περάσεις `height − 30`
  στο `worldToScreen`, ο τύπος γίνεται `(height − 30 − 30)` και **όλο το σχέδιο ανεβαίνει
  30 px**. Το inset ζει στο `drawing-area.ts` ως ονοματισμένο ορθογώνιο· το `viewport`
  μένει πάντα το πλήρες μέγεθος του καμβά.
- Σε εκφυλισμένο viewport (0×0 πριν το layout) τα `width`/`height` **περιορίζονται σε 0**:
  ένα αρνητικό `rect()` είναι σιωπηλά έγκυρο στο Canvas 2D και θα έδινε **αντεστραμμένο
  clip** — δηλαδή θα ζωγράφιζε ακριβώς εκεί που δεν έπρεπε.

## 4. Πρότυπο (τι κάνουν οι μεγάλοι)

- **Figma** (`viewport.bounds`): «*User actions such as resizing the window **or
  showing/hiding the rulers/UI** will change the bounds of the viewport*» — το viewport
  είναι **εξ ορισμού** καθαρό από chrome, ώστε καμία διαδρομή να μη μπορεί να δει τα
  περιθώρια.
- **Krita** (`KisCoordinatesConverter`): μία αρχή κατέχει **και** τους μετασχηματισμούς
  **και** την ορατή περιοχή· το `KisZoomManager` κρατά τους `KoRuler` **συγχρονισμένους
  από αυτήν**. Οι χάρακες είναι **καταναλωτές**, ποτέ δεύτερος ορισμός.

Γι' αυτό ο `RulerRenderer` παίρνει πλέον τις ζώνες του από `getLeftRulerBand()` /
`getBottomRulerBand()` και **δεν** τις υπολογίζει από `settings.width/height`: δεν μπορεί
να ζωγραφίσει ζώνη διαφορετική από αυτήν που κόβει το clip.

## 5. Δύο σιωπηλά σφάλματα που φάνηκαν μόλις υπήρξε ένας ορισμός

Κανένα από τα δύο δεν ήταν ορατό όσο η απάντηση ήταν διάσπαρτη.

1. **`LayerRenderer` — η unified διαδρομή δεν έκοβε καθόλου.** Η legacy διαδρομή είχε το
   (μοναδικό στο subapp) σωστό clip· η unified δεν είχε κανένα, οπότε τα color layers
   **χύνονταν πάνω στους χάρακες**. Ήταν η «έκτη απάντηση»: καμία.

2. **`useCanvasGhostPreview` — τα ghosts ζωγράφιζαν πάνω στους χάρακες.** Ο `PreviewCanvas`
   (z15) είναι **άλλος καμβάς**, πάνω από τον κύριο (z10) όπου οι χάρακες ζωγραφίζονται ως
   pass **μετά** τις οντότητες. Λανθάνον από το **ADR-624**· φάνηκε μόλις ένα ghost έγινε
   αρκετά μεγάλο ώστε να φτάσει τα 30 px (**ADR-736** — η εικόνα πιάνει ~1/3 του ορατού
   πλάτους· τα 8 σύμβολα-ghosts ήταν λίγα εκατοστά και δεν έφταναν ποτέ).
   Το clip μπαίνει **μία φορά στο harness**, όχι στα 9 delegates.

## 6. Παράπλευρο: οι δύο χάρακες ήταν ο ίδιος αλγόριθμος (N.18 / CHECK 3.28)

Οι `renderHorizontalRuler` / `renderVerticalRuler` έτρεχαν τον **ίδιο** αλγόριθμο με
αναποδογυρισμένο άξονα. Το CHECK 3.28 τους σήμανε ως δίδυμα σε **τρεις διαδοχικούς
γύρους** — κάθε φορά που εξαγόταν ένα κομμάτι, το επόμενο έβγαινε στην επιφάνεια. Αυτό
είναι η ένδειξη ότι η διπλή γραφή δεν ήταν σε κάποιο κομμάτι, ήταν στη **δομή**.

Ενοποιήθηκαν σε `renderRulerTicks(…, orientation)`. Οι διαφορές τους ζουν ονοματισμένες
σε ένα σημείο (`rulerAxisOps`: `limit`, `minLabelPos`, `world()`, `tickPath()`,
`drawLabel()`)· **ό,τι δεν είναι εκεί είναι κοινό εξ ορισμού και δεν μπορεί να αποκλίνει.**

Επίσης καθάρισαν δύο ακόμη «30» με λάθος προέλευση:
- η πρώτη ετικέτα του οριζόντιου χάρακα διαβάζει τώρα `getLeftRulerBand().width`·
- το αισθητικό κενό στην πάνω ακμή του κατακόρυφου πήρε **δικό του όνομα**
  (`VERTICAL_RULER_LABEL_TOP_GAP`) — δανειζόταν το `MARGINS.top`, δηλαδή ήταν η **τρίτη**
  σημασία φορτωμένη στο ίδιο πεδίο.

## 7. Τι δεν άλλαξε

- Οι αριθμητικές τιμές: `30` / `30`, όπως πριν. **Καμία οπτική μετατόπιση** — εκτός από τα
  δύο σφάλματα του §5, όπου το σωστό αποτέλεσμα είναι πλέον το ζωγραφισμένο.
- Το `COORDINATE_LAYOUT` και τα re-exports του (`constants.ts`,
  `systems/rulers-grid/config.ts`) εξακολουθούν να υπάρχουν, ως προβολές με `@deprecated`.
  Η προηγούμενη γραφή τους έδειχνε **η μία στην άλλη σε κύκλο**, χωρίς να οδηγεί ποτέ στην
  πηγή.

## 8. Επαλήθευση

- `rendering/core/__tests__/drawing-area.test.ts` — η γεωμετρία και οι εκφυλισμένες
  περιπτώσεις.
- `rendering/core/__tests__/drawing-area-ssot.test.ts` — κοκκινίζει αν το
  `DRAWING_AREA_CHROME` αποκλίνει από τα `RULERS_GRID_CONFIG.DEFAULT_RULER_WIDTH/HEIGHT`.
- `hooks/tools/__tests__/useCanvasGhostPreview.test.tsx` — επιβεβαιώνει τη σειρά
  `save → clip(30,0,970,770) → draw → restore`, δηλαδή ότι το delegate **δεν μπορεί** να
  γράψει πάνω στους χάρακες.
- 122 suites / 1194 tests πράσινα. **ΟΧΙ tsc** (N.17 — το CI το κάνει, CHECK 3.29).

## 9. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-07-31 | Αρχική έκδοση. Νέο `drawing-area.ts` SSoT· μετανάστευση 5+3 σημείων· διόρθωση των δύο clip σφαλμάτων (§5)· ενοποίηση των δύο ruler renderers (§6)· αφαίρεση `RULER_LEFT_PAD`/`RULER_BOTTOM_PAD` (μηδέν καταναλωτές). |
| 2026-07-31 | Οι καταναλωτές: `useFitToView`, `transform-ghost-matrix`, `webgl-line-ortho-camera`, `useDxfViewerCallbacks`, `CanvasLayerStack`, `useCanvasGhostPreview` (+ το clip του §5.2). Στο `floorplan-background` το `CadCoordinateAdaptation.margins: {left, top}` έγινε `chrome: DrawingAreaChrome` — το υποσύστημα είχε αντιγράψει το λάθος όνομα μαζί με την τιμή. **Παράπλευρα (CHECK 3.28):** οι `_applyScreenTransform`/`_applyCadTransform` ήταν **ταυτόσημοι** στους δύο παρόχους (243 tokens) → νέο `providers/provider-canvas-transforms.ts`. Δεν ήταν καλλωπισμός: ο CAD μετασχηματισμός ορίζει **πού κάθεται η αρχή του κόσμου** για το υπόβαθρο, οπότε διόρθωση άγκυρας στο ένα αντίγραφο θα άφηνε το άλλο πίσω — και η απόκλιση θα φαινόταν μόνο σε **έναν** τύπο αρχείου. |

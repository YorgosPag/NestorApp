# ADR-681 — Grid cascade band + BIM background pattern (κάτοψη)

**Status**: Accepted
**Date**: 2026-07-20
**Domains**: `rendering/ui/grid`, `bim/renderers`, `bim/utils`

---

## 1. Αφορμή

Αναφορά Giorgio (screenshot 2026-07-20 09:33): **«οι γραμμές πλέγματος είναι πάνω από τις
οντότητες και είναι πολύ πυκνό»**. Δύο ξεχωριστά προβλήματα σε ένα στιγμιότυπο.

Το πρώτο **δεν** ήταν z-order: το `GridUnderlayCanvas` είναι ήδη z0 και το `DxfCanvas` z10
(`CanvasLayerStack.tsx:296-373`). Το πλέγμα φαινόταν «από πάνω» επειδή τα BIM σώματα
είναι ημιδιαφανή (alpha ~0.22) και το άφηναν να διαβάζεται από μέσα τους.

---

## 2. Πρόβλημα Α — υπερβολική πυκνότητα πλέγματος

### 2.1 Ρίζα (δύο ανεξάρτητα σφάλματα στην ίδια συνάρτηση)

`computeAdaptiveLevels` (`rendering/ui/grid/grid-adaptive.ts`):

1. **Σύγχυση δύο ρόλων.** Το `fadeMaxPx` οδηγούσε ΚΑΙ το fade window (πόσο ορατή είναι η
   δευτερεύουσα γραμμή) ΚΑΙ τη ζώνη cascade (πότε αραιώνει το πλέγμα):
   `targetMajorMin = fadeMaxPx`, `targetMajorMax = fadeMaxPx * subDivisions`. Με το
   shipped fade window των 10px → κύριες στα 10-50px, δευτερεύουσες στα **2-10px**.
2. **Λάθος επίπεδο στη ζώνη.** Η ζώνη περιόριζε το **major**. Ο αλγόριθμος σταματά στο
   κάτω άκρο, οπότε `minor = major / subDivisions` έπεφτε πολύ κάτω από τη ζώνη — ακόμα
   και με «σωστή» ζώνη `[5,100]` οι δευτερεύουσες κατέληγαν στα **1-5px**.

Το (2) εντοπίστηκε **μόνο** μέσω mutation testing: τα πρώτα tests πέρασαν και με το bug,
επειδή έλεγχαν το major αντί για το minor.

### 2.2 Διπλοτυπία (SSoT)

Υπήρχε **δεύτερη**, ποτέ καλούμενη υλοποίηση: `GridCalculations.calculateAdaptiveLevels`
(`systems/rulers-grid/grid-calculations.ts`). **Μόνο** αυτή ξεχώριζε σωστά τη ζώνη cascade
από το fade window — αλλά ήταν εκτός render path (μόνο re-exports σε `utils.ts:27`,
`ruler-calculations.ts:20`). Ο ζωντανός renderer έτρεχε τη λανθασμένη έκδοση.

### 2.3 Απόφαση

- Η ζώνη cascade γίνεται **ρητή είσοδος** (`minSpacingPx` / `maxSpacingPx`), ανεξάρτητη
  του fade window.
- Η ζώνη περιορίζει το **MINOR** level — είναι το λεπτότερο από τα δύο σχεδιαζόμενα και
  άρα αυτό που ορίζει την αντιληπτή πυκνότητα. Το major παράγεται ως
  `minor * subDivisions`.
- Defaults **10-50px minor** ⇒ 50-250px major με 5 υποδιαιρέσεις (AutoCAD `GRIDDISPLAY` /
  Fusion 360 αίσθηση). **Engineering constant**, ΟΧΙ user preference — δεν αντλείται από
  `behavior.minGridSpacing/maxGridSpacing` του `rulers-grid/config.ts`, που είναι τιμές
  ruler/snap με **άλλη σημασιολογία** (χρησιμοποιούνται από το `calculateAdaptiveSpacing`,
  το οποίο παραμένει ενεργό και αμετάβλητο).
- Το διπλότυπο `calculateAdaptiveLevels` **αφαιρέθηκε** (N.18 — όχι sibling clones). Η
  σωστή σημασιολογία μεταφέρθηκε ΜΕΣΑ στο ζωντανό path αντί να μείνει ως δίδυμο.

### 2.4 Αρχεία

| Αρχείο | Αλλαγή |
|---|---|
| `rendering/ui/grid/grid-adaptive.ts` | ζώνη cascade ως είσοδος· minor-driven cascade |
| `rendering/ui/grid/GridTypes.ts` | `minGridSpacing`/`maxGridSpacing` + defaults 10/50 |
| `rendering/ui/grid/GridRenderer.ts` | pass-through της ζώνης |
| `hooks/canvas/useCanvasSettings.ts` | καλωδίωση (ήταν **τελείως** ασύνδετη) |
| `rendering/ui/grid/LegacyGridAdapter.ts`, `rendering/canvas/core/CanvasSettings.ts`, `app/test-harness/dxf-canvas/DxfCanvasHarness.tsx` | συμπλήρωση συμβολαίου |
| `systems/rulers-grid/grid-calculations.ts` | **αφαίρεση** διπλότυπου |

---

## 3. Πρόβλημα Β — πλέγμα ορατό μέσα από τα σώματα

### 3.1 Τι κάνουν οι μεγάλοι παίκτες

Εξετάστηκε αν υπάρχει «έξυπνη» λύση (punch-out του πλέγματος κάτω από τα footprints με
`destination-out`). **Κανένας μεγάλος παίκτης δεν το κάνει** — ήταν επινόηση του agent και
απορρίφθηκε τεκμηριωμένα. Revit / ArchiCAD / AutoCAD κάνουν όλοι το ίδιο απλό πράγμα: το
πλέγμα είναι drawing aid στο βάθος και τα σώματα το σκεπάζουν επειδή είναι **αδιαφανή**.

Στο Revit το cut fill είναι **δύο** στρώσεις, όχι μία:
- **background pattern** — συμπαγές, στο χρώμα του φύλλου· αυτό αποκρύπτει.
- **foreground pattern** — το hatch/tint που φέρει την ταυτότητα υλικού.

Το έργο είχε **μόνο** foreground (tint 0.22 + hatch ως stroke, καμία αδιαφανής βάση —
`material-hatch-paint.ts:41-51`), εξ ου και η διαφάνεια.

### 3.2 Απόφαση

Νέο SSoT `fillBimBodyPath()` στο `bim/utils/bim-body-fill.ts`: γεμίζει το **τρέχον path**
δύο φορές — αδιαφανής βάση στο **ζωντανό** χρώμα καμβά (`resolveDxfCanvasBackgroundHex()`),
μετά το υπάρχον ημιδιαφανές tint.

**Συνέπεια σχεδιασμού**: πάνω σε κενό καμβά το σύνθετο αποτέλεσμα είναι **pixel-identical**
με πριν — αλλάζει μόνο ό,τι βρίσκεται από **κάτω** από το σώμα, που είναι ακριβώς το
ζητούμενο. Δεν χρειάστηκε άρση του `FILL_BOOST_MAX_ALPHA = 0.6`
(`config/adaptive-entity-color.ts:107`): το tint παραμένει ημιδιαφανές, αδιαφανής είναι
μόνο η **νέα βάση**. Το σχόλιο «το σώμα δεν γίνεται ποτέ opaque» παραμένει αληθές για το tint.

### 3.3 Ποια στοιχεία αποκρύπτουν

Διάκριση με βάση το υπάρχον `CutState` (`config/bim-view-range.ts:34`):

| CutState | Αδιαφανής βάση | Λόγος |
|---|---|---|
| `cut` | ✅ | τεμνόμενο από το επίπεδο κοπής |
| `projection` | ✅ | π.χ. πλάκα κάτω από το επίπεδο — κρύβει ό,τι είναι πιο κάτω |
| `beyond` | ❌ | εκτός view range· σχεδιάζεται ως αχνή ένδειξη, δεν αποκρύπτει |
| `hidden` | — | δεν σχεδιάζεται |

**Εφαρμόστηκε σε**: `WallRenderer`, `ColumnRenderer`, `SlabRenderer`.

**ΣΚΟΠΙΜΑ ΕΚΤΟΣ**:
- **`BeamRenderer`** — το δοκάρι είναι overhead (πάνω από το επίπεδο κοπής, dashed).
  Revit/ArchiCAD: ό,τι είναι πάνω από τον παρατηρητή ΔΕΝ παίρνει background pattern.
  Σχόλιο-φράχτης προστέθηκε στο αρχείο· **μην «ευθυγραμμιστεί»** με τα υπόλοιπα.
- **`SlabOpeningRenderer`** — άνοιγμα = τρύπα· αδιαφανής βάση θα ακύρωνε τον σκοπό του.

### 3.4 Συμβατότητα με cutouts

Το `punchHostedOpenings` (`WallRenderer`, ADR-363 Φ2.5) χρησιμοποιεί
`globalCompositeOperation='destination-out'`, άρα αφαιρεί **και** τη νέα αδιαφανή βάση —
τα ανοίγματα εξακολουθούν να δείχνουν σωστά ό,τι βρίσκεται από κάτω. Καμία αλλαγή.

---

## 4. Επαλήθευση

- **Νέο test suite**: `rendering/ui/grid/__tests__/grid-adaptive.test.ts` (6 tests) —
  ο φάκελος `__tests__` **δεν υπήρχε**.
- **Mutation-verified ×3** (η πρακτική που αποκάλυψε το σφάλμα §2.1.2):
  1. επαναφορά `targetMajorMin = fadeMaxPx` → 1 fail
  2. `majorWorldStep = minorWorldStep` (σπάσιμο σχέσης επιπέδων) → 1 fail
  3. ζώνη οδηγούμενη από `fadeMaxPx` → 1 fail
- **Regression**: `npx jest src/subapps/dxf-viewer/bim` → **1004 suites / 11.413 tests
  πράσινα**.
- **N.18**: `jscpd:diff` στα 6 αρχεία → **0 clones**.
- **ΟΧΙ tsc** (CLAUDE.md N.17 — ο έλεγχος τύπων γίνεται από Giorgio / pre-commit / CI 3.29).

### 4.1 Εκκρεμεί οπτική επιβεβαίωση

Η αλλαγή §3 είναι **ορατή συμπεριφορά**: ένα εισαγμένο DXF/σκαναρισμένη κάτοψη κάτω από
τοίχο **δεν θα φαίνεται πια μέσα από αυτόν**. Αυτό είναι η ρητά επιλεγμένη συμπεριφορά
Revit (εντολή Giorgio: «όπως οι μεγάλοι παίκτες»), αλλά αξίζει οπτική επιβεβαίωση σε
project με underlay πριν θεωρηθεί κλειστό.

---

## 5. Το άλμα πυκνότητας μεταξύ δύο κλικ της ρόδας (Φάση 2)

### 5.1 Το σύμπτωμα

Παράπονο Giorgio: «ανάμεσα σε δύο διαδοχικά κλικ της ρόδας, από μια ξεκούραστη οθόνη με
κανονικές γραμμές μεταβαίνει σε οθόνη με πάρα πολλές γραμμές. Κουράζει, τρομάζει, ενοχλεί.»

Μετρημένο από τα δύο screenshots (`101831.jpg` / `101844.jpg`, ζωντανές ρυθμίσεις
`size=45`, `subDivisions=5`, fade window 9/10px):

| Καρέ | scale | minor | major | minorOpacity |
|---|---|---|---|---|
| 101831 | 1.1645 | **10.48 px** | 52.40 px | **1.0000** |
| 101844 | 0.99027 | **44.56 px** | 222.81 px | **1.0000** |

**4.25× αλλαγή πυκνότητας σε ένα κλικ**, με το cross-fade να επιστρέφει opacity `1.0`
και στις δύο πλευρές.

### 5.2 Η ρίζα — τρίτη εκδήλωση του ΙΔΙΟΥ σφάλματος

Ο μηχανισμός cross-fade (`smoothstep` + temporal lerp) ήταν **γραμμένος και σωστός**,
αλλά **μονίμως ανενεργός**: το fade window ήταν `[smoothFadeMinPx=2, smoothFadeMaxPx=10]`
ενώ μετά τη Φάση 1 το minor ζει στο `[10,50]`. Τα δύο διαστήματα **δεν τέμνονται**, άρα το
`t` του smoothstep έβγαινε **πάντα 1** — επαληθεύτηκε σε **61 δείγματα zoom**, τόσο με τα
defaults `[2,10]` όσο και με τα `[9,10]` του πάνελ.

Είναι η **ίδια ρίζα με τη Φάση 1, για τρίτη φορά**: *δύο συζευγμένα μεγέθη ρυθμίζονται
ανεξάρτητα και ξεσυγχρονίζονται.*

1. ζώνη cascade παραγόμενη από το `fadeMaxPx` (Φάση 1)
2. ζώνη στο **major** αντί στο **minor** (Φάση 1)
3. **fade window εκτός εμβέλειας του minor** (Φάση 2 — εδώ)

### 5.3 Η λύση — SSoT audit, ΟΧΙ νέος μηχανισμός

Ο υποχρεωτικός grep audit (εντολή Giorgio) βρήκε ότι **ο μηχανισμός υπάρχει ήδη μέσα στο
ίδιο repo**: `bim-3d/scene/grid/cinema4d-grid-material.ts` (ADR-558, εντολή Giorgio
«κάν' το όπως το C4D»):

```glsl
float lodFade = lod - lodFloor;                       // 0 μόλις μετά το βήμα → 1 λίγο πριν
float minorC = lineCoverage(p, cellMinor, ...) * (1.0 - lodFade);   // το cross-fade
float majorC = lineCoverage(p, cellMajor, ...);                     // major πάντα πλήρες
```

**Καμία επινόηση** — η πρακτική MAXON μεταφέρθηκε αυτούσια στο 2Δ:

```ts
const maxSpacingPx = minSpacingPx * subDivisions;                              // ΠΑΡΑΓΟΜΕΝΟ
const lodFade = clamp01(Math.log(maxSpacingPx / minorScreenPx) / Math.log(subDivisions));
return { majorScreenPx, minorScreenPx, minorOpacity: 1 - lodFade };
```

**Γιατί εξαφανίζεται το άλμα** (αριθμητική, όχι εντύπωση): στο κάτω άκρο της ζώνης το minor
έχει ήδη σβήσει (opacity 0) και στην οθόνη μένουν μόνο οι major γραμμές. Το βήμα του cascade
προάγει **αυτό ακριβώς το επίπεδο** σε «minor», στην **ίδια απόσταση** και με πλήρη opacity.
Η ορατή απόσταση γραμμών πριν το βήμα == μετά το βήμα.

### 5.4 Τρία knobs έγιναν ένα

Η συνέχεια ισχύει **μόνο** αν η ζώνη καλύπτει ακριβώς μία περίοδο cascade. Άρα το πάνω άκρο
**δεν είναι ελεύθερο** — είναι δομική συνέπεια. Καταργήθηκαν ως ανεξάρτητες ρυθμίσεις:

| Knob | Τύχη |
|---|---|
| `smoothFadeMinPx` / `smoothFadeMaxPx` | **ΚΑΤΑΡΓΗΘΗΚΑΝ** — παράγονται από τη ζώνη· τα 2 slider αφαιρέθηκαν από το πάνελ, τα 4 i18n κλειδιά διαγράφηκαν |
| `maxGridSpacing` (grid render path) | **ΚΑΤΑΡΓΗΘΗΚΕ** — `= minGridSpacing * majorInterval` |
| `minGridSpacing` | **ΜΕΝΕΙ** — ο μοναδικός knob πυκνότητας (αντίστοιχο του C4D `uMinCellPx`) |
| `smoothFadeDurationMs` | **ΜΕΝΕΙ** — temporal lerp, ορθογώνιο προς το window |

⚠️ Το `behavior.minGridSpacing/maxGridSpacing` του `rulers-grid/config.ts` είναι **άλλη
σημασιολογία** (ruler/snap) και **παραμένει ανέπαφο** — όπως και το `calculateAdaptiveSpacing`.

Η `migrateAdaptiveFadeDefaults` ξαναγράφτηκε: **αφαιρεί** τα δύο καταργημένα κλειδιά από
persisted blobs, ώστε να μη διαιωνίζονται μέσω `deepMerge` πίσω στο Firestore.

### 5.5 Επαλήθευση Φάσης 2

Μετρική: **αντιληπτή πυκνότητα μελανιού** = `1/major + (1/minor − 1/major) × opacity`
(οι major θέσεις σχεδιάζονται πάντα αδιαφανείς, οι υπόλοιπες minor στο `opacity`).

| Έλεγχος | Νέο | Παλιό |
|---|---|---|
| Άλμα ακριβώς στο σύνορο cascade | **0.0098 %** | 397.7 % |
| Μέγιστη μεταβολή ανά βήμα, σάρωση 4 δεκάδων | **0.68 %** | 397.7 % |
| Ανομοιομορφία ρυθμού fade ανά κλικ ρόδας | **0.0 %** | (log) 43.6 % αν γίνει γραμμικό |

- **Test suite**: 6 → **10 tests** (νέα: cross-fade ζωντανό, συνέχεια στο σύνορο, συνέχεια
  σε σάρωση, ομοιόμορφος ρυθμός σε log χώρο, degenerate inputs).
- **Mutation-verified ×5** — και οι 5 μεταλλάξεις σκοτώθηκαν:
  1. `minorOpacity: 1` (το ακριβές shipped bug) → 4 fail
  2. ανεστραμμένη φορά (`lodFade` αντί `1 - lodFade`) → 3 fail
  3. band top `= min × sub × 2` (αποσύζευξη ζώνης/περιόδου) → 4 fail
  4. γραμμικό fade αντί log χώρου → **επέζησε αρχικά** → προστέθηκε anchor ρυθμού → 1 fail
  5. αφαίρεση degenerate guard → 1 fail
- **Regression**: `npx jest` σε `rulers-grid` + `rendering` + `hooks/canvas` +
  `ui/components/dxf-settings` → **84 suites / 858 tests πράσινα**.
- **N.18**: τα 5 clones που ανέφερε το `jscpd:diff` **προϋπάρχουν στο HEAD** (επαληθεύτηκε
  με σάρωση των εκδόσεων HEAD: ίδια 5 clones)· και τα 3 σχετικά hunks είναι **καθαρές
  διαγραφές** → **0 νέα clones**, κανένα SKIP.
- **ΟΧΙ tsc** (N.17).

### 5.6 Το υπόλοιπο της έμφασης — τέταρτη εκδήλωση (ΔΙΟΡΘΩΘΗΚΕ, §5.7)

Στο βήμα του cascade, τα 4/5 των γραμμών που ήταν «major» γίνονται «minor», άρα αλλάζουν
**χρώμα/πάχος** ακαριαία. **Η απόσταση δεν αλλάζει** — το παράπονο του Giorgio ήταν η
πυκνότητα, που λύθηκε. Το ίδιο υπόλοιπο υπάρχει **και στον C4D shader** (γραμμή 99, 9/10
των γραμμών αλλάζουν ρόλο στο decade step). Δεν «διορθώνεται» χωρίς επινόηση εκτός της
πρακτικής των μεγάλων παικτών — άρα **σκοπίμως δεν αγγίχτηκε**.

---

## 5.7 Η έμφαση major/minor — τέταρτη εκδήλωση της ίδιας ρίζας

### Τι έδειξαν τα screenshots 104618 / 104637

Μετά το §5, ο Giorgio έστειλε δύο νέα διαδοχικά κλικ. Το cross-fade **δούλευε**:

| | 104618 (s=5.2264) | 104637 (s=6.1459) |
|---|---|---|
| minor | 47.0px (**9.0m**) op 0.96 | 11.1px (1.8m) op **0.06** |
| major | 235.2px (45.0m) | 55.3px (**9.0m**) |

Το ίδιο πλέγμα των **9m** υπάρχει και στα δύο καρέ — στο πρώτο ως minor, στο δεύτερο ως
major. Ζουμ ×1.176 → αντιληπτή πυκνότητα ×**1.097** (ο παλιός κώδικας: ×4.25). ✅

**ΑΛΛΑ** οι φωτεινές (major-styled) γραμμές πήγαν από κάθε 235px σε κάθε 55px = **×4.25**.
Ο συντελεστής δεν εξαφανίστηκε — **μετακόμισε από την πυκνότητα στην έμφαση**. Το §5.6 το
είχε χαρακτηρίσει «διακριτική αλλαγή χρώματος/πάχους»· η αριθμητική έδειξε ότι ήταν ο ίδιος
συντελεστής 4.25. **Λάθος χαρακτηρισμός, διορθώνεται εδώ.**

### Η ρίζα, ξανά

`minorGridWeight` και `majorGridWeight` ήταν **δύο ανεξάρτητα slider**. Ο **λόγος** τους
καθορίζει αν η εναλλαγή ρόλου διαβάζεται ως γεγονός, και κανείς δεν τον φύλαγε. Ο Giorgio
έτρεχε `0.5` / `2` = **×4**.

| Εκδήλωση | Συζευγμένη δυάδα που ξέφυγε |
|---|---|
| 1 (§1.1.1) | ζώνη cascade ↔ fade window |
| 2 (§1.1.2) | ζώνη ↔ επίπεδο που περιορίζει (major αντί minor) |
| 3 (§5.2) | fade window ↔ εμβέλεια minor |
| **4 (εδώ)** | **πάχος minor ↔ πάχος major** |

### Η λύση — αρχή MAXON, όχι αριθμοί MAXON

Νέο SSoT `config/grid-emphasis.ts`: `GRID_MAJOR_EMPHASIS_RATIO = 1.5` +
`deriveMajorGridWeight()`. Το `majorGridWeight` **καταργήθηκε** ως ανεξάρτητη ρύθμιση
(render contract, persisted settings, slider). Ο renderer το παράγει σε **5 σημεία**
(lines/dots/crosses/adaptive/legacy) και το `grid-calculations.ts` σε ένα.

Χρώματα: `GRID_MAJOR #888888` → `#989898`, `GRID_MINOR #bbbbbb` → `#b0b0b0` —
απόσταση **51 → 24**.

**Γιατί 1.5 και όχι οι τιμές του C4D**: ο C4D έχει 1.0/0.7 = **1.43**, χρώματα ~10/255 και
major **σκουρότερο** — δουλεύει επειδή το 3Δ πλέγμα είναι *φόντο που πρέπει να υποχωρεί*.
Το δικό μας είναι **όργανο μέτρησης** σε κάτοψη: ο χρήστης μετράει τετράγωνα, άρα το major
πρέπει να παραμένει ευανάγνωστο. Υιοθετούμε την **αρχή** (λόγος αρκετά μικρός ώστε η
εναλλαγή ρόλου να μην είναι γεγονός), όχι τις **τιμές** (που θα έκαναν το major αόρατο).

⚠️ **Ειλικρινής ασυμμετρία**: το fade window παράγεται επειδή η συνέχεια **αποδεικνύεται**
(§5.3). Ο λόγος 1.5 είναι **αντιληπτική σταθερά** — δεν υπάρχει θεώρημα πίσω του. Γι' αυτό
ζει μόνος του σε ένα αρχείο: αλλαγή house style = μία επεξεργασία.

### Επαλήθευση §5.7

- **Νέο suite** `config/__tests__/grid-emphasis.test.ts` (4 tests).
- **Mutation-verified ×4**, όλες νεκρές: ratio→4 (το shipped σφάλμα) → 1 fail·
  ratio→1.0 (major αδιάκριτο) → 2 fail· αγνόηση minor weight → 2 fail·
  αφαίρεση NaN/0 guard → 1 fail.
- **Regression**: 43 suites / 497 tests· **1 προϋπάρχον κόκκινο** —
  `config/__tests__/bim-object-styles.test.ts` (σύγκρουση χρωμάτων παλέτας BIM).
  **ΔΕΝ είναι δικό μας**: το `bim-object-styles.ts` δεν εισάγει καθόλου `UI_COLORS`, και τα
  δύο αρχεία είναι αμετάβλητα στο git, **και** το test αποτυγχάνει πανομοιότυπα με το δικό
  μας `color-config.ts` αναιρεμένο στην έκδοση HEAD (επαληθεύτηκε εμπειρικά).
- **ΟΧΙ tsc** (N.17).

---

## 6. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-20 | Αρχική έκδοση — cascade band (minor-driven) + αφαίρεση διπλότυπου + Revit background pattern σε wall/column/slab |
| 2026-07-20 | **Φάση 3** (§5.7) — έμφαση major **παράγεται** από minor (`grid-emphasis.ts`, ratio 1.5)· `majorGridWeight` καταργήθηκε ως ρύθμιση + slider· χρώματα grid 51 → 24 απόσταση· άλμα έμφασης ×4.25 → ×1.5· mutation-verified ×4 |
| 2026-07-20 | **Φάση 2** — cross-fade C4D (§5): fade window + band top **παράγονται** από τον ενιαίο anchor `minGridSpacing`· 3 knobs → 1· 2 slider + 4 i18n κλειδιά καταργήθηκαν· άλμα πυκνότητας 397.7 % → **0.0098 %**· mutation-verified ×5 |

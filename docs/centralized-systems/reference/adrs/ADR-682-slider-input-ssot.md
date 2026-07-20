# ADR-682 — Slider SSoT: ένα primitive, τρία semantic wrappers, πληκτρολογήσιμη τιμή

**Status**: Accepted
**Date**: 2026-07-20
**Domains**: `components/ui`, `dxf-viewer/ui/components/shared`, `dxf-viewer/bim-3d/animation`, `dxf-viewer/bim-3d/panels`

---

## 1. Αφορμή

Οι sliders του έργου ήταν **de-facto κεντρικοποιημένοι αλλά ΑΔΗΛΩΤΟΙ**: υπήρχε ήδη ένα
Radix primitive (`src/components/ui/slider.tsx`) και ένα wrapper (`SliderInput`), αλλά
**κανένα ADR** δεν τα περιέγραφε και **κανένα registry module** δεν τα φύλαγε. Άρα:

- τίποτα δεν εμπόδιζε το επόμενο πάνελ να γράψει ωμό `<input type="range">` — και όντως
  το είχαν κάνει το `Lighting3DPanelTab` και το `TimelineEditor`·
- υπήρχε **νεκρό διπλότυπο** (`ui/components/dxf-settings/controls/LineWidthControl.tsx`):
  δικό του `useState` + debounce + Radix `Slider`, **μηδέν καλούντες** (`grep` → 0
  αναφορές). Κλασικό sibling clone του `SliderInput` (N.18).

Και μια **ψευδής αναφορά** στο header του `SliderInput`: έγραφε `ADR-342-ext`, ενώ το
**ADR-342 είναι `voice-input-field-ssot`** — άσχετο. Δηλαδή το αρχείο επικαλούνταν
τεκμηρίωση που δεν το αφορούσε ποτέ. Το ADR-682 είναι η **πρώτη** πραγματική του δήλωση.

> Το ίδιο σχήμα με το N.11/N.12 του CLAUDE.md: *το «κανένα εύρημα» σήμαινε «κανείς δεν
> κοίταξε», όχι «καθαρό».*

---

## 2. Η ιεραρχία των τριών επιπέδων

```
@radix-ui/react-slider                       ← τρίτο μέρος· ΚΑΝΕΙΣ δεν το εισάγει απευθείας
        │
        ▼
src/components/ui/slider.tsx                 ← PRIMITIVE — το ΜΟΝΑΔΙΚΟ σημείο import
  (tokens: track/range/thumb, focus ring, disabled, dark mode, ARIA/keyboard Radix)
        │
        ├── SliderInput            (settings panel — label + πληκτρολογήσιμη τιμή + step)
        ├── SectionSliderShell     (on-canvas τομές — ADR-452 / ADR-455)
        └── TimelineScrubber       (playhead — ADR-366 §C.1.b)
```

| Επίπεδο | Αρχείο | Ευθύνη |
|---|---|---|
| primitive | `src/components/ui/slider.tsx` | εμφάνιση + συμβόλαιο αλληλεπίδρασης· **τίποτα σημασιολογικό** |
| semantic | `dxf-viewer/ui/components/shared/SliderInput.tsx` | βαθμωτή **παράμετρος ρυθμίσεων**: label, μονάδα, typed τιμή, step/min/max |
| semantic | `dxf-viewer/components/dxf-layout/SectionSliderShell.tsx` | **επίπεδο κοπής** πάνω στον καμβά: ViewCube accent theme, toggle, readout pill, compact mode |
| semantic | `dxf-viewer/bim-3d/animation/TimelineScrubber.tsx` | **playhead**: timecode readout `mm:ss.mmm`, waypoint ticks, ms βήμα |

### 2.1 ΓΙΑΤΙ αυτά τα τρία ΔΕΝ ενοποιούνται σε ένα

Το ερώτημα τέθηκε ρητά («γιατί τρία wrappers και όχι ένα;») και απαντήθηκε **αρνητικά**:

- **Πρακτική μεγάλων παικτών.** Figma, Shopify **Polaris**, IBM **Carbon**: ένα
  αδιάφορο primitive (`Slider`/`RangeSlider`) και **semantic variants** από πάνω. Κανένα
  design system δεν έχει ένα mega-component με 20 props για κάθε χρήση.
- **Ο playhead δεν είναι slider παραμέτρου.** Cinema 4D, After Effects, Premiere: ο
  playhead είναι **δικό του control** — timecode αντί για αριθμητική τιμή, keyframe
  markers ζωγραφισμένα πάνω στο track, χρονική (όχι γενικού σκοπού) σημασιολογία στο
  βήμα. Το να τον περνούσαμε από το `SliderInput` (label/unit/reset) θα ήταν **λάθος**
  κεντρικοποίηση: *ίδιο widget, διαφορετικό νόημα.*
- **Η τομή ζει πάνω στον καμβά**, όχι σε πάνελ: accent theme ViewCube, hover states,
  toggle, compact λειτουργία. Καμία από αυτές τις ανάγκες δεν έχει το settings slider.

Το κοινό είναι **η ζωγραφική και η αλληλεπίδραση** — και αυτό ακριβώς ζει **ήδη** στο
primitive. Ενοποίηση παραπάνω από αυτό θα ήταν σύζευξη τριών άσχετων σημασιολογιών.

**Ό,τι ήταν όντως κοινό, εξήχθη**: ο formatter χρόνου έγινε δικό του module
(`bim-3d/animation/timeline-time-format.ts` — `formatTime` + `waypointTimesSec`), ώστε
όταν ο scrubber έγινε ξεχωριστό component να **μη διπλασιαστεί** ο υπολογισμός «πού
κάθεται το waypoint #i» ανάμεσα στην κάθετη λίστα και στα ticks (N.18).

---

## 3. Η απόφαση για πληκτρολογήσιμη τιμή

### 3.1 Το πρόβλημα

Slider με **read-only** τιμή σημαίνει: ο χρήστης **δεν μπορεί να δώσει ακριβή τιμή**.
Θέλει 0.75· σύρει· πετυχαίνει 0.72· ξανασύρει· 0.78. Σε CAD αυτό δεν είναι ατέλεια
εμφάνισης — είναι **αδυναμία εισαγωγής δεδομένων**.

### 3.2 Τι κάνουν οι μεγάλοι παίκτες

Σε **Revit**, **ArchiCAD**, **Cinema 4D**, **Figma** κάθε βαθμωτή παράμετρος έχει
**typed numeric field**, και ο slider είναι το **δευτερεύον** affordance (γρήγορη
εξερεύνηση). Ποτέ το αντίστροφο. Στον C4D κάθε αριθμητικό πεδίο δέχεται και
πληκτρολόγηση και drag· στο Figma το πεδίο δέχεται Arrow/Shift+Arrow nudge.

Άρα υιοθετείται η ίδια ιεραρχία: **αριθμός = πρωτεύον, slider = δευτερεύον**.

### 3.3 Το component

`ui/components/shared/SliderValueField.tsx` — ο αριθμός δίπλα στο label **δεν είναι
`<span>`**, είναι πεδίο:

- **blurred** → δείχνει τη μορφοποιημένη τιμή (π.χ. `20%`, `12:30`)
- **focused** → γίνεται ωμό αριθμητικό κείμενο (χωρίς σύμβολο μονάδας) με **auto-select**
  όλου του κειμένου
- **σταθερό πλάτος** → το layout δεν αναπηδά ενώ ο χρήστης πληκτρολογεί

### 3.4 Keyboard contract (το συμβόλαιο, ρητά)

| Πλήκτρο / γεγονός | Συμπεριφορά |
|---|---|
| **Enter** | parse → `clamp(min,max)` → **στρογγυλοποίηση στο step** → `onChange` + blur |
| **blur** | ίδιο με Enter (commit) |
| **Escape** | **revert** χωρίς commit + blur |
| **ArrowUp / ArrowDown** | ±**1** step |
| **Shift+Arrow** | ±**10** steps (C4D / Figma) |
| άκυρο ή κενό κείμενο | **revert** στην προηγούμενη τιμή, **ΚΑΜΙΑ** `onChange` |
| ίδια τιμή μετά το normalize | **καμία** `onChange` (idempotent — N.7.2 §3) |

Το quantization γίνεται στο **ίδιο πλέγμα με το Radix**: αγκύρωση στο `min`
(`min + quantizeToStep(v - min, step)`), μετά αφαίρεση float θορύβου με βάση τα
δεκαδικά που φέρει το ίδιο το `step`. Άρα **δεν μπορεί** να προκύψει τιμή off-step από
πληκτρολόγηση ενώ ο slider δίνει μόνο on-step — τα δύο affordances παράγουν το **ίδιο**
σύνολο τιμών.

Ένα `skipBlurCommitRef` εμποδίζει το **διπλό commit** όταν το Enter/Escape καλεί
προγραμματικά `blur()`.

### 3.5 i18n

Το `SliderValueField` **δεν κάνει i18n**: δέχεται `label` **ήδη μεταφρασμένο** ως
accessible name. Καμία νέα i18n κλείδα δεν χρειάστηκε — οι καλούντες περνούν τα
υπάρχοντα `t(...)` τους (N.11 ικανοποιημένο εξ ορισμού).

---

## 4. Τι εφαρμόστηκε

| Αρχείο | Αλλαγή |
|---|---|
| `ui/components/shared/SliderValueField.tsx` | **[NEW]** πληκτρολογήσιμο πεδίο + `normalizeSliderValue` |
| `ui/components/shared/SliderInput.tsx` | η τιμή δίπλα στο label έγινε `SliderValueField` (ήταν read-only span)· header διορθώθηκε (`ADR-342-ext` → ADR-682) |
| `ui/components/dxf-settings/controls/LineWidthControl.tsx` | **ΔΙΑΓΡΑΦΗ** — νεκρό sibling clone του `SliderInput`, 0 καλούντες |
| `bim-3d/animation/TimelineScrubber.tsx` | **[NEW]** playhead πάνω στο Radix primitive + waypoint ticks (ήταν ωμό `<input type="range">`) |
| `bim-3d/animation/timeline-time-format.ts` | **[NEW]** `formatTime` + `waypointTimesSec` — κοινά με τη λίστα waypoints |
| `bim-3d/animation/TimelineEditor.tsx` | ο τοπικός `ScrubberRow` **αφαιρέθηκε** → `TimelineScrubber`· η λίστα δέχεται πλέον τους **ίδιους** χρόνους με τα ticks |
| `bim-3d/panels/Lighting3DPanelTab.tsx` | ωμά range inputs → `SliderInput` (η ώρα με `formatValue` → `hh:mm`) |
| `.ssot-registry.json` | **[NEW module]** `slider-primitive` (tier 2) |

**Inline styles**: μία μόνο, δηλωμένη — η οριζόντια θέση κάθε waypoint tick
(`left: ${pct}%`) είναι **συνεχής συνάρτηση του χρόνου**, αδύνατη ως token. Ό,τι άλλο
είναι κλάση.

---

## 5. Enforcement — module `slider-primitive` (CHECK 3.7)

```jsonc
"slider-primitive": {
  "ssotFile": "src/components/ui/slider.tsx",
  "forbiddenPatterns": [
    "^[^*]*<input[^>]*type=[\"']range[\"']",
    "^[[:space:]]*type=[\"']range[\"']",
    "from[[:space:]]+[\"']@radix-ui/react-slider[\"']"
  ],
  "tier": 2
}
```

**Τι μπλοκάρει και γιατί.** Ένα ωμό `<input type="range">` παρακάμπτει **όλα** τα εξής:

1. τα design tokens (χρώματα track/range/thumb, focus ring, disabled) → το control
   βγαίνει γκρι browser-chrome και **σπάει στο dark mode**·
2. το Radix keyboard/ARIA συμβόλαιο (Home/End/PageUp/PageDown, `aria-valuetext`,
   pointer capture στο thumb)·
3. το κοινό clamping step/min/max → η τιμή μπορεί να καταλήξει **off-step** ή εκτός ορίων·
4. το πληκτρολογήσιμο πεδίο του §3 → ο χρήστης **μόνο σύρει, ποτέ δεν πληκτρολογεί**.

Το απευθείας import `@radix-ui/react-slider` απαγορεύεται **εξίσου**: ξαναστήνει το
styling από το μηδέν και **διχάζει** το token contract.

### 5.1 ⚠️ POSIX ERE — γιατί τα patterns μοιάζουν πρωτόγονα

Τα `forbiddenPatterns` καταναλώνονται από `grep -E` (POSIX ERE). **ΑΠΑΓΟΡΕΥΟΝΤΑΙ**
`(?:...)`, lookahead/lookbehind, `\d`, `\s` κ.λπ. — και ο λόγος δεν είναι αισθητικός:

> **Άκυρο ERE = το grep δεν ταιριάζει τίποτα = το check γίνεται ΜΟΝΙΜΩΣ ΠΡΑΣΙΝΟ.**
> Αποτυγχάνει **σιωπηλά**, δηλαδή με τον χειρότερο δυνατό τρόπο για guard.

Αυτή ακριβώς η κλάση σφάλματος (v3.0) καλύπτεται από το
`scripts/__tests__/registry-golden-regex.test.js` (`npm run test:registry-golden`), που
τρέχει τα patterns μέσω **πραγματικού** `grep -E -f`. Δύο σχήματα καλύφθηκαν επίτηδες
γιατί το JSX τα γράφει και τα δύο: μονογραμμικό `<input ... type="range" ...>` και
πολυγραμμικό, όπου το `type="range"` κάθεται μόνο του σε δική του γραμμή. Το
`^[^*]*` κόβει τα σχόλια `*` ώστε να μη μετράει η ίδια η τεκμηρίωση ως παράβαση.

### 5.2 Allowlist — τι μένει έξω και γιατί

| Αρχείο | Λόγος |
|---|---|
| `src/components/ui/slider.tsx` | το ίδιο το SSoT |
| `bim-3d/panels/Section3DPanelTab.tsx` | §6 (α) |
| `bim-3d/panels/section/PlaneListItem.tsx` | §6 (α) |
| `components/shared/files/media/VideoPlayer.tsx` | §6 (β) — εκτός DXF Viewer |
| `subapps/geo-canvas/.../FloorPlanControls.tsx` | §6 (β) — εκτός DXF Viewer |
| `app/demo/floorplan-background-image/page.tsx` | §6 (β) — demo σελίδα |

---

## 6. ΓΝΩΣΤΑ ΚΕΝΑ (ρητά καταγεγραμμένα — δεν κρύβονται)

**(α) `Section3DPanelTab` + `PlaneListItem` παραμένουν ωμά `<input type="range">`.**
**ΔΕΝ** μεταφέρθηκαν στο `SliderInput` σκόπιμα: για επίπεδα κοπής σε 3Δ, το **σωστό
affordance δεν είναι slider σε πάνελ** — είναι **viewport handles** πάνω στο ίδιο το
μοντέλο, à la **Revit section box** (σύρεις το ίδιο το επίπεδο εκεί που το βλέπεις).
Ένα «γρήγορο» πέρασμα στο `SliderInput` θα **κλείδωνε** το λάθος affordance πίσω από
καθαρότερο κώδικα. Είναι **ξεχωριστό redesign**, όχι εκκρεμότητα μορφοποίησης.
Μέχρι τότε ζουν στο allowlist — **δηλωμένα, όχι ξεχασμένα**.

**(β) `VideoPlayer`, `FloorPlanControls`, demo page: εκτός εύρους.** Η εργασία αφορούσε
τον DXF Viewer. Ο VideoPlayer έχει επιπλέον δικό του πρόβλημα (buffered ranges,
scrub-while-playing) που θέλει media-specific σχεδίαση, όχι settings slider.

**(γ) Το `npm run ssot:baseline` ΔΕΝ έχει τρέξει.** Το module `slider-primitive`
προστέθηκε στο registry αλλά το baseline δεν ανανεώθηκε. Μέχρι να τρέξει, το CHECK 3.7
μπορεί να αναφέρει τα allowlisted/υπάρχοντα ως **νέες** παραβάσεις. **Απαιτείται
`npm run ssot:baseline` πριν το πρώτο commit που αγγίζει αυτά τα αρχεία.**

---

## 7. Επαλήθευση

- **ΟΧΙ tsc** (CLAUDE.md **N.17** — ο έλεγχος τύπων γίνεται από Giorgio / pre-commit / CI 3.29).
- **N.11**: μηδέν νέα i18n κλειδιά, μηδέν hardcoded strings — το `SliderValueField`
  δέχεται ήδη μεταφρασμένο `label`, οι μονάδες έρχονται από `formatValue` του καλούντος.
- **N.18**: το μοναδικό πραγματικό clone (`LineWidthControl` ↔ `SliderInput`)
  **εξαλείφθηκε με διαγραφή**, όχι με δεύτερη αφαίρεση· ο formatter χρόνου εξήχθη σε ένα
  module αντί να αντιγραφεί σε scrubber + λίστα.
- **N.7.1**: όλα τα νέα αρχεία < 500 γραμμές, όλες οι συναρτήσεις < 40 γραμμές.
- ⚠️ **Εκκρεμεί**: (i) `npm run ssot:baseline` (§6γ)· (ii) **δεν γράφτηκε unit test** για
  το `normalizeSliderValue` — είναι καθαρή συνάρτηση με σαφή συμβόλαια (clamp/quantize/
  float noise) και **αξίζει** anchor· (iii) οπτική επιβεβαίωση του keyboard contract
  (Enter/Esc/Shift+Arrow) σε πραγματικό πάνελ.

---

## 8. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-20 | Αρχική έκδοση — δήλωση της υπάρχουσας (αλλά αδήλωτης) ιεραρχίας **primitive → 3 semantic wrappers**· διόρθωση της ψευδούς αναφοράς `ADR-342-ext` στο `SliderInput`· **πληκτρολογήσιμη τιμή** (`SliderValueField`, Enter/blur=commit+clamp+step-round, Esc=revert, Arrow ±1, Shift+Arrow ±10) κατά το πρότυπο Revit/ArchiCAD/C4D/Figma· **[NEW]** `TimelineScrubber` + `timeline-time-format` (ωμό range → Radix primitive + waypoint ticks)· `Lighting3DPanelTab` → `SliderInput`· **διαγραφή** νεκρού clone `LineWidthControl`· **[NEW registry module]** `slider-primitive` (CHECK 3.7, tier 2)· γνωστά κενά §6 δηλωμένα ρητά |

# ADR-721 — Ορατότητα επιπέδων: ένα έγγραφο, μία αλήθεια

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **IMPLEMENTED (UNCOMMITTED)** 2026-07-28 — browser-verified σε `47_ergasia.dxf`· 218/218 jest σε 20 suites |
| **Date** | 2026-07-28 |
| **Category** | DXF Viewer — Scene state / Layer visibility / Cross-cutting |
| **Author** | Claude Opus 5 + Γιώργος Παγώνης |
| **Trigger** | Giorgio: «τα ματάκια εμφάνισης/απόκρυψης επιπέδων δεν συμπεριφέρονται σωστά» (screenshot 2026-07-28 15:22) |
| **Companions** | ADR-547 (SceneStore SSoT), ADR-382 (Visibility Resolver), ADR-358 §5.6.bis (LayerStore), ADR-616 (layer commands), ADR-040 (micro-leaf) |
| **Industry alignment** | AutoCAD LAYER table semantics · Revit *Temporary* Hide/Isolate · Cinema 4D Viewport Solo Mode |
| **Risk** | Medium-high — αγγίζει scene reactivity (κάθε consumer), 16 σημεία γραφής, undo/redo |

---

## 1. Το σύμπτωμα και η μετρημένη ρίζα

Το κλικ στο μάτι ενός layer δεν έκανε **τίποτα**: ούτε ο καμβάς άλλαζε, ούτε το εικονίδιο.

Μέτρηση ζωντανά (browser probe μέσω React fiber, `47_ergasia.dxf`, 58 layers / 3107 οντότητες):

| Πηγή | `VT_POINT.visible` μετά το κλικ |
|---|---|
| `SceneStore.getLevelScene(id)` — η SSoT | `true` ✅ |
| `scene` prop σε panel **και** καμβά | `false` ❌ |
| `aria-label` κουμπιού | «Εμφάνιση» (δηλ. UI νόμιζε κρυφό) |

Δύο διαφορετικά αντικείμενα, μόνιμα αποκλίνοντα. Καμία εξαίρεση στην κονσόλα.

**Ρίζα:** το `useCurrentLevelScene` (ADR-557) διάβαζε τη σκηνή με **σκέτο getter κατά το render**,
χωρίς συνδρομή. Πριν το ADR-547 Stage 0 αυτό ήταν ανεκτό — η σκηνή ζούσε σε `useState`, οπότε κάθε
γραφή προκαλούσε από μόνη της cascade. Μετά το Stage 0 μετακόμισε στο zero-React `SceneStore`, και η
μόνη συνδρομή έμεινε μέσα στο `useSceneManager`, του οποίου το αποτέλεσμα **δεν** μπαίνει στα deps
του `LevelsContext` memo (`LevelsSystem.tsx` §contextValue — και το ADR-547 §2 περιγράφει αυτή τη
σταθερότητα ως **επιθυμητή** για perf).

Άρα: `setLevelScene(...)` → το store ενημερωνόταν → **κανένας consumer δεν ειδοποιούνταν**. Η
εφαρμογή έμοιαζε να δουλεύει μόνο επειδή σχεδόν κάθε άλλη ενέργεια (επιλογή, εργαλείο, drag)
πυροδοτεί re-render από άλλο store, οπότε η σκηνή ξαναδιαβαζόταν παρεμπιπτόντως. Μια ενέργεια που
αλλάζει **μόνο** τη σκηνή — ακριβώς το toggle ορατότητας — έμενε αόρατη για πάντα.

## 2. Τι βρέθηκε από κάτω (η πραγματική έκταση)

Η ρίζα έκρυβε τέσσερα ακόμη προβλήματα στο ίδιο μονοπάτι:

| # | Πρόβλημα | Συνέπεια για τον χρήστη |
|---|---|---|
| Α | Το toggle έγραφε `visible` **σε κάθε οντότητα** του layer (`updateEntitiesForLayer`) | Το «εμφάνιση» ξανα-άναβε και όσα ο χρήστης είχε κρύψει **ατομικά**· ανακτήσιμο μόνο με undo |
| Β | Τέσσερα ασύμβατα κατηγορήματα για το ίδιο flag· δύο με truthiness | Σε φρέσκο DXF **58/58** layers έχουν `visible: undefined` ⇒ το UI δήλωνε «όλα κρυμμένα» ενώ ζωγραφίζονταν όλα |
| Γ | 16 σημεία έγραφαν **μόνο** στο `LayerStore` (runtime προβολή) | «Κρύψε από Διαχειριστή → σχεδίασε → επανεμφανίστηκε». Ντετερμινιστική απώλεια, όχι race |
| Δ | Η απομόνωση έγραφε `frozen: true` σε μόνιμο πεδίο | Προσωρινή κατάσταση συνεδρίας μπορούσε να αποθηκευτεί στο αρχείο |

Το Γ **θα χειροτέρευε** από τη διόρθωση της ρίζας: με reactive σκηνή το hydration τρέχει κανονικά,
άρα οι runtime-only γραφές θα σβήνονταν πιο γρήγορα από πριν. Δεν ήταν επιλογή να λυθεί μόνο η ρίζα.

## 3. Τι λέει η βιομηχανία (έρευνα)

**Πού ζει το ON/OFF:** AutoCAD το κρατά στο **LAYER table**, ποτέ στην οντότητα — γι' αυτό ένα σβηστό
layer κρατά τα αντικείμενά του **επιλέξιμα**. Revit/ArchiCAD: override στο δοχέα (view/category),
όχι ιδιότητα του στοιχείου. ⇒ Το Α ήταν αντι-πρακτική.

**Προσωρινό vs μόνιμο** — εδώ οι μεγάλοι παίκτες **διαφωνούν**:

| | Μόνιμοι διακόπτες | Προσωρινή απομόνωση |
|---|---|---|
| **Revit** | V/G overrides, αποθηκεύονται | *Temporary* Hide/Isolate — **χάνεται στο κλείσιμο**, ξεχωριστή ενέργεια για μονιμοποίηση |
| **Cinema 4D** | Layer Manager (View/Render), στο scene file | **Viewport Solo Mode** — ξεχωριστός μηχανισμός |
| **AutoCAD** | LAYON/LAYOFF/LAYFRZ, στο DWG | LAYISO **μεταλλάσσει** τα layer states· γι' αυτό χρειάζεται LAYUNISO |

**Απόφαση:** μοντέλο **Revit/C4D** (μη-καταστροφικό), όχι AutoCAD LAYISO. Το ADR-358 §5.6.bis το
είχε ήδη επιλέξει στα λόγια («session-only, NOT persisted»)· ο κώδικας δεν το τηρούσε.

## 4. Αρχιτεκτονική

```
   SceneModel.layersById   ← ΤΟ ΕΓΓΡΑΦΟ (persisted, auto-save)
            │ hydrate (μονόδρομος, ιδεμποτικός)
            ▼
       LayerStore          ← runtime προβολή· zero-React, event-time reads
            │ subscribe
      ┌─────┴─────┐
      ▼           ▼
   renderer     panels          ⇒ ίδια πηγή ⇒ αδύνατο να αποκλίνουν

   IsolateEffectsStore     ← ΞΕΧΩΡΙΣΤΟ κανάλι, session-only
                             (ο renderer το διαβάζει χωριστά· ποτέ δεν αγγίζει layer flags)
```

**Μία πόρτα γραφής** (`services/layer-flags-writer`): γράφει έγγραφο **και** προβολή **ατομικά**,
είναι **fail-closed** (χωρίς ενεργό έγγραφο δεν γράφει τίποτα και επιστρέφει `false`), και δουλεύει
**και εκτός React** μέσω της `active-document-gateway`.

## 5. Υλοποίηση

| § | Αρχείο | Αλλαγή |
|---|---|---|
| 1 | `config/layer-visibility.ts` **(νέο)** | `isLayerOn` / `isLayerFrozen` / `isLayerRenderable` / `nextLayerOnState` / `resolveLayerGroupOnState`. `undefined ⇒ ορατό` (DXF code 62: απουσία δήλωσης = ON) |
| 2 | `systems/levels/useCurrentLevelScene.ts` | **Η ρίζα.** `useSyncExternalStore` στο **per-level** getter (`getSceneForLevel`), όχι στο record — γραφή σε άλλο level δεν ξυπνά αυτό το leaf |
| 3 | `stores/LayerStore.ts` | `setLayers` + `upsertLayer` **ιδεμποτικά**. Προϋπόθεση ορθότητας, όχι μικρο-βελτιστοποίηση: χωρίς φρουρό, κάθε drag frame θα πετούσε το bitmap cache |
| 4 | `LayerOperationsService` · `layer-operation-utils` | `updateEntitiesForLayer` **αφαιρέθηκε**· τα δύο toggles έφυγαν προς τη μία πόρτα |
| 6 | `systems/levels/active-document-gateway.ts` **(νέο)** | Zero-React θύρα· **ΕΝΑΣ** γραφέας (`LevelsSystem` effect). Καταχωρεί τον **auto-save-aware** writer, όχι τον ωμό `SceneStore` |
| 7 | `services/layer-flags-writer.ts` **(νέο)** | `setLayerFlags` / `setLayerFlagsBatch` / `toggleLayerFlag`. **Και τα 16 σημεία** μετανάστευσαν εδώ |
| 8 | `dxf-entity-layer-skip.ts` · `LayerIsolateCommand` · `layer-command-utils` | Layer-scope isolate ελέγχεται στον **renderer**· `freezeNonIsolatedLayers` **αφαιρέθηκε** |
| 5 | `stores/useLayerStore.ts` **(νέο)** · `LayerItem` · `ColorGroupItem` | Τα panels διαβάζουν τα flags από τον **ίδιο SSoT με τον καμβά** |

### Λεπτομέρειες που δάγκωσαν

- **`GROUP_KEY_SEP = '\u001F'`**: τα ονόματα layer επιτρέπουν κενά (`Visible Elevation`). Ένα
  `join(' ')/split(' ')` θα διέλυε το όνομα σε δύο ανύπαρκτα layers ⇒ σιωπηλά λάθος ομαδικός
  διακόπτης. (Το NUL θα έκανε το αρχείο να μοιάζει binary στο git.)
- **name→id γέφυρα**: ο `LayerStore` είναι id-keyed· `getLayer(<όνομα>)` επιστρέφει πάντα `null`.
  Τα panels κρατούν ονόματα (legacy props), η μετάφραση γίνεται στο σύνορο.
- **Το undo πρέπει να φτάνει όσο το execute**: `restoreLayerEntry` γράφει και στο έγγραφο. Αν η
  εντολή περσιστάρει και το undo όχι, η «ακύρωση» φαίνεται στην οθόνη ενώ το αρχείο κρατά την αλλαγή.

## 6. Αλλαγές συμπεριφοράς (ρητές)

1. **Το toggle layer δεν αγγίζει οντότητες.** Ατομικές αποκρύψεις επιβιώνουν.
2. **Η απομόνωση δεν αφήνει αποτύπωμα.** Συνέπεια: μια «Κατάσταση Επιπέδων» αποθηκευμένη *κατά τη
   διάρκεια* απομόνωσης καταγράφει τα **μόνιμα** flags — η επαναφορά της δεν ξαναπαγώνει. Σωστό: μια
   αποθηκευμένη κατάσταση περιγράφει πώς είναι στημένο το σχέδιο, όχι τι κοίταζε στιγμιαία ο χρήστης.
3. **Fail-closed**: χωρίς ενεργό έγγραφο καμία γραφή. Το αντίθετο θα ανασταίνε το bug.

## 7. Επαλήθευση

**Browser (localhost, `47_ergasia.dxf`)** — μετά τη διόρθωση:

| Έλεγχος | Αποτέλεσμα |
|---|---|
| Απόκρυψη ομάδας «Color #FFFFFF (27 layers)» | Όλη η λευκή γεωμετρία **εξαφανίστηκε** (υπόμνημα, περιγράμματα) |
| `sameObject` (prop vs store) | **`true`** — η απόκλιση εξαφανίστηκε |
| `propHidden` / `storeHidden` | 27/27 → 0/0, συγχρονισμένα |
| `entitiesMutated` πριν/μετά | **316 → 316** — καμία οντότητα δεν μεταλλάχθηκε |
| Απόκρυψη από Διαχειριστή → πλήρης αλλαγή σκηνής | **επιβίωσε** (το σενάριο «επανεμφανίστηκε» έκλεισε) |
| «Ορατά: 58» στον Διαχειριστή | σωστό (με truthiness θα έλεγε 0) |

**Jest:** 218/218 σε 20 suites. Έξι suites χρειάστηκαν ενημέρωση — και **σωστά**: έστηναν μόνο τον
`LayerStore` και ρωτούσαν μόνο την προβολή, δηλαδή έλεγχαν ακριβώς τη μισή αρχιτεκτονική που
παρήγαγε το bug. Νέος harness `active-document-test-harness` + `expectPersisted` (ρωτά **και τις
δύο** πηγές). Νέα suites: `layer-flags-writer` (10), `layer-visibility` (16).

## 8. Γνωστό υπόλοιπο

**Data debt στο `47_ergasia.dxf`:** 316 οντότητες φέρουν `visible: false` — αποτύπωμα του παλιού
toggle (μέρος και από τις δοκιμές αυτής της συνεδρίας). Ο νέος κώδικας δεν παράγει άλλες, αλλά οι
υπάρχουσες παραμένουν κρυμμένες ακόμη κι όταν το layer τους είναι ON. **Δεν καθαρίστηκαν αυτόματα**:
είναι δεδομένα του χρήστη και το `visible: false` είναι διφορούμενο (ατομική απόκρυψη vs αποτύπωμα).
Χρειάζεται ρητή απόφαση/εργαλείο.

## Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-28 | Αρχική έκδοση. Ρίζα εντοπισμένη με browser probe· §1-8 IMPLEMENTED· 218/218 jest· browser-verified. Κώδικας: `9b6b80c3` (SSoT γραφής + gateway), `e1391324` (κάλυψη), `58bf78b8` (ανα-αρίθμηση 719→721 — το 719 ήταν πιασμένο από το ambient-declaration-ssot) |
